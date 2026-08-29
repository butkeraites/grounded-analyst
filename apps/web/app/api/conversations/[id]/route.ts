import { NextResponse } from "next/server";
import { repositories } from "@/lib/db";
import { getService } from "@/lib/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Load a conversation's full turns — joining runs so charts/tables/code return on reload. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = repositories();
  const conv = await repos.conversations.get(id);
  if (!conv) return NextResponse.json({ error: "conversation not found" }, { status: 404 });

  const [msgs, runs] = await Promise.all([
    repos.messages.listByConversation(id),
    repos.runs.listByConversation(id),
  ]);
  const runByMessage = new Map(runs.filter((r) => r.messageId).map((r) => [r.messageId, r]));

  const messages = msgs.map((m) => {
    if (m.role === "user") return { id: m.id, role: "user" as const, content: m.content };
    const run = runByMessage.get(m.id);
    return {
      id: m.id,
      role: "assistant" as const,
      result: {
        conversationId: id,
        interpretation: m.content,
        artifacts: run?.artifacts ?? [],
        code: run?.code ?? "",
        stdout: run?.stdout ?? "",
        repairAttempts: run?.repairAttempts ?? 0,
      },
    };
  });

  const [dataset, suggestions] = await Promise.all([
    repos.datasets.get(conv.datasetId),
    getService().suggestQuestions(conv.datasetId).catch(() => []),
  ]);

  return NextResponse.json({ conversationId: id, dataset, suggestions, messages });
}
