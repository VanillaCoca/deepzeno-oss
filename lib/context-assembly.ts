import "server-only";

import { serializeDecisionGraph } from "@/lib/decision-serializer";
import {
  listDecisionsByTopicId,
  listEdgesByTopicId,
} from "@/lib/workspace/queries";
import type { WorkspaceDecision, WorkspaceEdge } from "@/lib/workspace/types";

const MAX_CONTEXT_CHARS = 18_000;

function prioritizeDecisionIds(
  decisions: WorkspaceDecision[],
  edges: WorkspaceEdge[]
) {
  const byId = new Map(
    decisions.map((decision: WorkspaceDecision) => [decision.id, decision])
  );
  const orderedIds: string[] = [];
  const seen = new Set<string>();

  function pushDecision(id: string) {
    if (!seen.has(id) && byId.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  }

  const anchors = decisions.filter((decision) => decision.weight === "anchor");
  const keys = decisions.filter((decision) => decision.weight === "key");
  const normals = decisions.filter(
    (decision) => decision.weight !== "anchor" && decision.weight !== "key"
  );

  for (const anchor of anchors) {
    pushDecision(anchor.id);
  }

  const pending = [...anchors];
  while (pending.length > 0) {
    const current = pending.pop();

    if (!current) {
      continue;
    }

    for (const edge of edges) {
      if (edge.type !== "depends_on") {
        continue;
      }

      const nextId =
        edge.sourceDecisionId === current.id
          ? edge.targetDecisionId
          : edge.targetDecisionId === current.id
            ? edge.sourceDecisionId
            : null;

      if (nextId && !seen.has(nextId) && byId.has(nextId)) {
        const nextDecision = byId.get(nextId);
        if (nextDecision) {
          pushDecision(nextId);
          pending.push(nextDecision);
        }
      }
    }
  }

  for (const decision of keys.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )) {
    pushDecision(decision.id);
  }

  for (const decision of normals.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )) {
    pushDecision(decision.id);
  }

  return orderedIds;
}

export async function assembleContext(topicId: string, _projectId: string) {
  const [decisions, edges] = await Promise.all([
    listDecisionsByTopicId(topicId),
    listEdgesByTopicId(topicId),
  ]);

  if (decisions.length === 0) {
    return "";
  }

  const orderedIds = prioritizeDecisionIds(decisions, edges);
  const decisionById = new Map(
    decisions.map((decision: WorkspaceDecision) => [decision.id, decision])
  );
  const selected: typeof decisions = [];

  for (const decisionId of orderedIds) {
    const decision = decisionById.get(decisionId);

    if (!decision) {
      continue;
    }

    const serialized = serializeDecisionGraph([...selected, decision], edges);

    if (serialized.length > MAX_CONTEXT_CHARS) {
      break;
    }

    selected.push(decision);
  }

  return serializeDecisionGraph(selected, edges);
}
