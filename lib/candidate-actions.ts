import "server-only";

import { ChatbotError } from "@/lib/errors";
import {
  getTopicByIdForUser,
  insertDecision,
  insertDecisionLog,
  insertEdge,
  listPendingCandidatesByTopicId,
  updateCandidateResolution,
  updateDecisionStatus,
} from "@/lib/workspace/queries";

function supersedesTarget(edgeType: string) {
  return edgeType === "supersedes" || edgeType === "replaces";
}

export async function confirmCandidates({
  userId,
  topicId,
  selectedCandidateIds,
}: {
  userId: string;
  topicId: string;
  selectedCandidateIds: string[];
}) {
  const topic = await getTopicByIdForUser(topicId, userId);

  if (!topic) {
    throw new ChatbotError("forbidden:chat", "Topic not found");
  }

  const pendingCandidates = await listPendingCandidatesByTopicId(topicId);
  const selectedSet = new Set(selectedCandidateIds);

  for (const candidate of pendingCandidates) {
    if (!selectedSet.has(candidate.id)) {
      await updateCandidateResolution({
        candidateId: candidate.id,
        status: "rejected",
      });
      await insertDecisionLog({
        candidateId: candidate.id,
        action: "candidate_rejected",
        actorType: "user",
      });
      continue;
    }

    const createdDecision = await insertDecision({
      projectId: candidate.projectId,
      topicId: candidate.topicId,
      title: candidate.proposedTitle ?? "Untitled decision",
      content: candidate.proposedContent,
      rationale: candidate.proposedRationale,
      kind: candidate.proposedKind ?? "plan",
      weight: candidate.proposedWeight ?? "normal",
      status: "active",
      relevantMessageIds: candidate.relevantMessageIds,
      createdFromMessageId: candidate.messageId,
      confirmedByUserId: userId,
    });

    await updateCandidateResolution({
      candidateId: candidate.id,
      status: "accepted",
      resolvedDecisionId: createdDecision.id,
    });

    await insertDecisionLog({
      decisionId: createdDecision.id,
      candidateId: candidate.id,
      action: "created",
      actorType: "user",
    });

    for (const suggestedEdge of candidate.suggestedEdges ?? []) {
      if (!suggestedEdge.targetDecisionId) {
        continue;
      }

      await insertEdge({
        projectId: candidate.projectId,
        topicId: candidate.topicId,
        sourceDecisionId: createdDecision.id,
        targetDecisionId: suggestedEdge.targetDecisionId,
        type: suggestedEdge.type,
      });

      if (supersedesTarget(suggestedEdge.type)) {
        await updateDecisionStatus({
          decisionId: suggestedEdge.targetDecisionId,
          status: "superseded",
        });
        await insertDecisionLog({
          decisionId: suggestedEdge.targetDecisionId,
          candidateId: candidate.id,
          action: "superseded",
          actorType: "user",
          metadata: {
            supersededByDecisionId: createdDecision.id,
          },
        });
      }
    }
  }
}

export async function dismissAllCandidates({
  userId,
  topicId,
}: {
  userId: string;
  topicId: string;
}) {
  const topic = await getTopicByIdForUser(topicId, userId);

  if (!topic) {
    throw new ChatbotError("forbidden:chat", "Topic not found");
  }

  const pendingCandidates = await listPendingCandidatesByTopicId(topicId);

  for (const candidate of pendingCandidates) {
    await updateCandidateResolution({
      candidateId: candidate.id,
      status: "rejected",
    });
    await insertDecisionLog({
      candidateId: candidate.id,
      action: "candidate_rejected",
      actorType: "user",
    });
  }
}
