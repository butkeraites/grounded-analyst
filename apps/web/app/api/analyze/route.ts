import { getService } from "@/lib/core";
import { getAnalytics } from "@/lib/analytics";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The loop spins up an E2B sandbox and calls the LLM twice; give it room so a
// serverless timeout doesn't cut a legitimate analysis short.
export const maxDuration = 60;

/**
 * Streams an analysis turn as Server-Sent Events: `phase` events as the loop
 * generates → executes → interprets, then a final `result` (prose + chart +
 * table + code) or an `error`. The heavy work (real sandboxed execution) runs
 * server-side; the client just renders the stream.
 */
export async function POST(req: Request) {
  const limited = await rateLimited(req);
  if (limited) return limited;

  const { datasetId, question, conversationId } = await req.json();
  if (!datasetId || !question) {
    return new Response(JSON.stringify({ error: "datasetId and question are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const service = getService();
  const analytics = getAnalytics();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      analytics.capture("question_asked", { datasetId });
      try {
        const result = await service.analyze(
          { datasetId, question, conversationId },
          { onPhase: (e) => send("phase", e) },
        );
        analytics.capture("analysis_completed", {
          datasetId,
          repairAttempts: result.execution.repairAttempts,
          artifacts: result.artifacts.map((a) => a.kind),
        });
        send("result", {
          runId: result.runId,
          conversationId: result.conversationId,
          interpretation: result.interpretation,
          artifacts: result.artifacts,
          code: result.execution.code,
          stdout: result.execution.stdout,
          repairAttempts: result.execution.repairAttempts,
        });
      } catch (err) {
        analytics.capture("analysis_failed", { datasetId });
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
