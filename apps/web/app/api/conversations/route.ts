import { NextResponse } from "next/server";
import { repositories } from "@/lib/db";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List conversations for the history sidebar, titled by their first question. */
export async function GET(req: Request) {
  const limited = await rateLimited(req);
  if (limited) return limited;

  const repos = repositories();
  const convs = (await repos.conversations.list()).slice(0, 50);
  const conversations = await Promise.all(
    convs.map(async (c) => {
      const msgs = await repos.messages.listByConversation(c.id);
      const firstUser = msgs.find((m) => m.role === "user");
      return {
        id: c.id,
        datasetId: c.datasetId,
        title: firstUser?.content ?? "New analysis",
        createdAt: c.createdAt,
      };
    }),
  );
  // Only threads that actually have a question.
  return NextResponse.json({ conversations: conversations.filter((c) => c.title !== "New analysis") });
}
