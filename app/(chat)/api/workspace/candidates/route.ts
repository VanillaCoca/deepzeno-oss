import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";
import {
  listCandidatesByMessageId,
  listPendingCandidatesByTopicId,
} from "@/lib/workspace/queries";
import { getTopicTruthSnapshot } from "@/lib/workspace/service";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const messageId = searchParams.get("messageId");

    if (messageId) {
      const candidates = await listCandidatesByMessageId(messageId);

      if (candidates.length > 0) {
        await getTopicTruthSnapshot({
          userId: session.user.id,
          topicId: candidates[0].topicId,
        });
      }

      return Response.json({ candidates });
    }

    if (!topicId) {
      return new ChatbotError(
        "bad_request:api",
        "topicId or messageId is required"
      ).toResponse();
    }

    const snapshot = await getTopicTruthSnapshot({
      userId: session.user.id,
      topicId,
    });
    const candidates =
      snapshot.pendingCandidates ??
      (await listPendingCandidatesByTopicId(topicId));
    return Response.json({ candidates });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Load candidates failed", error);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
