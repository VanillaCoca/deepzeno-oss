"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { IRDetailPane } from "@/components/ir/ir-detail";
import { irNodeKey, useIR } from "@/components/ir/ir-provider";
import { TruthGraph, type TruthGraphMode } from "@/components/ir/truth-graph";
import { useIRActions } from "@/components/ir/use-ir-actions";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { IRDetail, IREdge, IRNode } from "@/lib/ir/types";
import { fetcher } from "@/lib/utils";

export function TruthGraphStage() {
  const { truth, truthEdges, ideas, candidates, selectedNodeId, selectNode } =
    useIR();
  const { topics, activeProjectId } = useWorkspace();
  const [graphMode, setGraphMode] = useState<TruthGraphMode>("truth");
  // null = top level; otherwise we've drilled into a parent's sub-nodes.
  const [focusParentId, setFocusParentId] = useState<string | null>(null);

  const { data: detail, mutate: mutateDetail } = useSWR<IRDetail>(
    irNodeKey(selectedNodeId),
    fetcher,
    { revalidateOnFocus: false }
  );

  // In "all" mode we draw cross-stage edges, so we fetch every project edge and
  // filter to the visible node set. Only fetched while the mode is active.
  const { data: allEdgesData } = useSWR<{ edges: IREdge[] }>(
    graphMode === "all" && activeProjectId
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/ir/edges?project_id=${activeProjectId}`
      : null,
    fetcher
  );

  // Full node set for the current scope, before drill filtering. "Truth" shows
  // confirmed truths only; "All" overlays candidates + ideas.
  const baseNodes = useMemo<IRNode[]>(() => {
    if (graphMode !== "all") {
      return truth;
    }

    const seen = new Set<string>();
    return [...truth, ...candidates, ...ideas].filter((node) => {
      if (seen.has(node.id)) {
        return false;
      }
      seen.add(node.id);
      return true;
    });
  }, [graphMode, truth, candidates, ideas]);

  // How many children each node has within the current scope (for the count chip).
  const childCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of baseNodes) {
      if (node.parentId) {
        counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [baseNodes]);

  // Top level shows roots (no parent); drilling shows one parent's children.
  const graphNodes = useMemo(
    () => baseNodes.filter((node) => (node.parentId ?? null) === focusParentId),
    [baseNodes, focusParentId]
  );

  const graphEdges = useMemo<IREdge[]>(() => {
    const ids = new Set(graphNodes.map((node) => node.id));
    const base = graphMode === "all" ? (allEdgesData?.edges ?? []) : truthEdges;
    return base.filter(
      (edge) => ids.has(edge.fromNode) && ids.has(edge.toNode)
    );
  }, [graphMode, truthEdges, allEdgesData, graphNodes]);

  // The detail/action pane works for whatever node is selected (found in the
  // full set, so it stays open even when drilled), enabling inline promote/confirm.
  const selectedNode =
    baseNodes.find((node) => node.id === selectedNodeId) ?? null;
  const focusParent = focusParentId
    ? (baseNodes.find((node) => node.id === focusParentId) ?? null)
    : null;
  const actions = useIRActions(selectedNode, mutateDetail);
  const truthGraphTopics = useMemo(
    () => topics.map((topic) => ({ id: topic.id, label: topic.label })),
    [topics]
  );

  // Switching scope can invalidate the drilled parent — return to top level.
  function handleModeChange(mode: TruthGraphMode) {
    setGraphMode(mode);
    setFocusParentId(null);
  }

  return (
    <div className="flex h-full flex-col pt-16" data-testid="truth-graph-stage">
      <div className="min-h-0 flex-1 overflow-auto">
        <TruthGraph
          childCounts={childCounts}
          edges={graphEdges}
          focusParentTitle={focusParent?.title ?? null}
          mode={graphMode}
          nodes={graphNodes}
          onDrill={setFocusParentId}
          onModeChange={handleModeChange}
          onSelect={selectNode}
          selectedNodeId={selectedNodeId}
          topics={truthGraphTopics}
        />
      </div>
      {selectedNode ? (
        <div className="h-2/5 min-h-[220px] overflow-auto border-t border-[var(--ir-border-default)]">
          <IRDetailPane
            actions={actions}
            detail={detail}
            selectedNode={selectedNode}
          />
        </div>
      ) : null}
    </div>
  );
}
