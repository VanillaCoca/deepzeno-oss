import "server-only";

import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { serializeDecisionGraph } from "@/lib/decision-serializer";
import { extractionSystemPrompt } from "@/lib/prompting";
import {
  getCandidateByContentHash,
  insertCandidateDecisions,
  listDecisionsByTopicId,
  listEdgesByTopicId,
  listRecentWorkspaceMessagesByConversationId,
} from "@/lib/workspace/queries";
import type { WorkspaceMessageRecord } from "@/lib/workspace/types";

const extractedCandidateSchema = z.object({
  proposed_title: z.string().min(1).max(160).nullable().optional(),
  proposed_content: z.string().min(1).max(4000),
  proposed_rationale: z.string().max(4000).nullable().optional(),
  proposed_kind: z
    .enum(["goal", "constraint", "plan", "hypothesis", "principle"])
    .nullable()
    .optional(),
  proposed_weight: z.enum(["anchor", "key", "normal"]).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  suggested_edges: z
    .array(
      z.object({
        type: z.string().min(1),
        target_decision_id: z.string().uuid().optional(),
      })
    )
    .nullable()
    .optional(),
  relevant_message_ids: z.array(z.string().uuid()).default([]),
});

const extractionResponseSchema = z.object({
  candidates: z.array(extractedCandidateSchema),
});

function computeContentHash({
  conversationId,
  messageId,
  content,
}: {
  conversationId: string;
  messageId: string;
  content: string;
}) {
  return createHash("sha256")
    .update(`${conversationId}:${messageId}:${content.trim().toLowerCase()}`)
    .digest("hex");
}

function summarizeTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function inferKind(
  content: string
): "goal" | "constraint" | "plan" | "hypothesis" | "principle" {
  const text = content.toLowerCase();

  if (
    text.includes("must") ||
    text.includes("cannot") ||
    text.includes("need to") ||
    text.includes("需要") ||
    text.includes("必须")
  ) {
    return "constraint";
  }

  if (
    text.includes("goal") ||
    text.includes("target") ||
    text.includes("aim") ||
    text.includes("目标")
  ) {
    return "goal";
  }

  if (
    text.includes("assume") ||
    text.includes("hypothesis") ||
    text.includes("猜测")
  ) {
    return "hypothesis";
  }

  if (
    text.includes("principle") ||
    text.includes("原则") ||
    text.includes("prefer")
  ) {
    return "principle";
  }

  return "plan" as const;
}

function heuristicExtraction(
  messages: WorkspaceMessageRecord[],
  assistantMessageId: string
): z.infer<typeof extractedCandidateSchema>[] {
  const sourceMessages = messages.slice(-4);
  const assistantMessage = sourceMessages.find(
    (message: WorkspaceMessageRecord) => message.id === assistantMessageId
  );

  if (!assistantMessage?.content.trim()) {
    return [];
  }

  const segments = assistantMessage.content
    .split(/[\n。！？.!?]/)
    .map((segment: string) => segment.trim())
    .filter(Boolean)
    .filter((segment: string) => segment.length > 16)
    .filter((segment: string) =>
      /(will|should|must|need|use|prefer|decide|plan|adopt|需要|采用|决定|计划|应该|将)/i.test(
        segment
      )
    )
    .slice(0, 3);

  return segments.map((segment: string) => ({
    proposed_title: summarizeTitle(segment),
    proposed_content: segment,
    proposed_rationale: "Extracted with the lightweight fallback extractor.",
    proposed_kind: inferKind(segment),
    proposed_weight: "normal" as const,
    confidence: 0.55,
    suggested_edges: [],
    relevant_message_ids: sourceMessages.map(
      (message: WorkspaceMessageRecord) => message.id
    ),
  }));
}

function normalizeCandidates(
  rawCandidates: z.infer<typeof extractedCandidateSchema>[]
) {
  return rawCandidates
    .map((candidate) => ({
      proposedTitle: candidate.proposed_title?.trim() || null,
      proposedContent: candidate.proposed_content.trim(),
      proposedRationale: candidate.proposed_rationale?.trim() || null,
      proposedKind: candidate.proposed_kind ?? "plan",
      proposedWeight: candidate.proposed_weight ?? "normal",
      confidence: candidate.confidence ?? 0.75,
      suggestedEdges:
        candidate.suggested_edges?.map((edge) => ({
          type: edge.type,
          ...(edge.target_decision_id
            ? { targetDecisionId: edge.target_decision_id }
            : {}),
        })) ?? [],
      relevantMessageIds: candidate.relevant_message_ids,
    }))
    .filter((candidate) => candidate.proposedContent.length > 0);
}

export async function extractDecisions({
  conversationId,
  topicId,
  projectId,
  messageId,
}: {
  conversationId: string;
  topicId: string;
  projectId: string;
  messageId: string;
}) {
  try {
    const [messages, decisions, edges] = await Promise.all([
      listRecentWorkspaceMessagesByConversationId(conversationId, 20),
      listDecisionsByTopicId(topicId),
      listEdgesByTopicId(topicId),
    ]);

    if (messages.length === 0) {
      return;
    }

    const serializedGraph = serializeDecisionGraph(decisions, edges);
    const transcript = messages
      .map(
        (message: WorkspaceMessageRecord) =>
          `[${message.id}] ${message.role.toUpperCase()}: ${message.content || "(no text content)"}`
      )
      .join("\n");

    let normalized: ReturnType<typeof normalizeCandidates> = [];

    if (process.env.ANTHROPIC_API_KEY) {
      const result = await generateObject({
        model: getLanguageModel("anthropic:claude-sonnet-4-6"),
        system: extractionSystemPrompt,
        prompt: `Existing decisions:\n${serializedGraph || "(none)"}\n\nConversation:\n${transcript}`,
        schema: extractionResponseSchema,
      });
      normalized = normalizeCandidates(result.object.candidates);
    } else {
      normalized = normalizeCandidates(
        heuristicExtraction(messages, messageId)
      );
    }

    for (const candidate of normalized) {
      const contentHash = computeContentHash({
        conversationId,
        messageId,
        content: candidate.proposedContent,
      });

      const existing = await getCandidateByContentHash({
        conversationId,
        contentHash,
      });

      if (existing) {
        continue;
      }

      await insertCandidateDecisions([
        {
          projectId,
          topicId,
          conversationId,
          messageId,
          proposedTitle: candidate.proposedTitle,
          proposedContent: candidate.proposedContent,
          proposedRationale: candidate.proposedRationale,
          proposedKind: candidate.proposedKind,
          proposedWeight: candidate.proposedWeight,
          confidence: candidate.confidence,
          preSelected: true,
          suggestedEdges: candidate.suggestedEdges,
          relevantMessageIds: candidate.relevantMessageIds,
          contentHash,
          source: "zeno_extraction",
          sourceMetadata: {
            extractor: process.env.ANTHROPIC_API_KEY
              ? "claude-sonnet-4-6"
              : "heuristic-fallback",
          },
        },
      ]);
    }
  } catch (error) {
    console.error("Decision extraction failed", error);
  }
}
