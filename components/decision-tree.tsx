"use client";

import { ChevronDownIcon, GitBranchIcon, Layers3Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { cn } from "@/lib/utils";
import type { WorkspaceDecision, WorkspaceEdge } from "@/lib/workspace/types";

type ViewMode = "type" | "relation";

function kindOrder(kind: string) {
  return ["goal", "constraint", "plan", "hypothesis", "principle"].indexOf(
    kind
  );
}

function DecisionNode({
  decision,
  depth = 0,
  dimmed = false,
}: {
  decision: WorkspaceDecision;
  depth?: number;
  dimmed?: boolean;
}) {
  const { selectedDecisionId, setSelectedDecisionId } = useWorkspace();

  return (
    <button
      className={cn(
        "flex w-full items-start gap-2 rounded-xl border border-border/50 bg-card/70 px-3 py-2 text-left transition-colors hover:border-border hover:bg-card",
        selectedDecisionId === decision.id &&
          "border-foreground/20 bg-accent/40",
        dimmed && "opacity-55"
      )}
      onClick={() => setSelectedDecisionId(decision.id)}
      style={{ marginLeft: depth * 12 }}
      type="button"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "truncate text-sm font-medium",
              decision.status === "superseded" && "line-through"
            )}
          >
            {decision.title}
          </p>
          <Badge variant="outline">{decision.kind}</Badge>
          <Badge
            variant={decision.status === "active" ? "secondary" : "outline"}
          >
            {decision.status}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {decision.content}
        </p>
      </div>
    </button>
  );
}

export function DecisionTree({
  decisions,
  edges,
  isLoading,
}: {
  decisions: WorkspaceDecision[];
  edges: WorkspaceEdge[];
  isLoading: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("type");
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [collapsedKinds, setCollapsedKinds] = useState<Record<string, boolean>>(
    {}
  );

  const visibleDecisions = useMemo(
    () =>
      decisions.filter(
        (decision) => showSuperseded || decision.status !== "superseded"
      ),
    [decisions, showSuperseded]
  );
  const decisionById = useMemo(
    () => new Map(visibleDecisions.map((decision) => [decision.id, decision])),
    [visibleDecisions]
  );
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          decisionById.has(edge.sourceDecisionId) &&
          decisionById.has(edge.targetDecisionId)
      ),
    [decisionById, edges]
  );

  const groupedByKind = useMemo(() => {
    const groups = new Map<string, WorkspaceDecision[]>();

    for (const decision of visibleDecisions) {
      const key = decision.kind;
      const current = groups.get(key) ?? [];
      current.push(decision);
      groups.set(key, current);
    }

    return [...groups.entries()].sort(
      ([leftKind], [rightKind]) => kindOrder(leftKind) - kindOrder(rightKind)
    );
  }, [visibleDecisions]);

  const relationChildren = useMemo(() => {
    const children = new Map<string, WorkspaceDecision[]>();
    const attachedIds = new Set<string>();
    const childIds = new Set<string>();

    for (const edge of visibleEdges) {
      if (edge.type !== "depends_on") {
        continue;
      }

      const parent = decisionById.get(edge.targetDecisionId);
      const child = decisionById.get(edge.sourceDecisionId);

      if (!parent || !child) {
        continue;
      }

      attachedIds.add(parent.id);
      attachedIds.add(child.id);
      childIds.add(child.id);
      children.set(parent.id, [...(children.get(parent.id) ?? []), child]);
    }

    const roots = visibleDecisions
      .filter(
        (decision) => attachedIds.has(decision.id) && !childIds.has(decision.id)
      )
      .sort((left, right) => {
        if (left.weight === "anchor" && right.weight !== "anchor") {
          return -1;
        }

        if (right.weight === "anchor" && left.weight !== "anchor") {
          return 1;
        }

        return right.createdAt.localeCompare(left.createdAt);
      });

    const standalone = visibleDecisions.filter(
      (decision) => !attachedIds.has(decision.id)
    );

    return {
      children,
      roots,
      standalone,
    };
  }, [decisionById, visibleDecisions, visibleEdges]);

  function renderRelationNode(
    decision: WorkspaceDecision,
    depth = 0
  ): React.ReactNode {
    const children = relationChildren.children.get(decision.id) ?? [];

    return (
      <div className="flex flex-col gap-2" key={decision.id}>
        <DecisionNode
          decision={decision}
          depth={depth}
          dimmed={decision.status === "superseded"}
        />
        {children.map((child) => renderRelationNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/60 bg-background/85 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Decision Tree</p>
          <p className="text-xs text-muted-foreground">
            Confirmed truth for the current topic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border/60 bg-card/70 p-1">
            <Button
              onClick={() => setViewMode("type")}
              size="sm"
              variant={viewMode === "type" ? "secondary" : "ghost"}
            >
              <Layers3Icon className="size-4" />
              By Type
            </Button>
            <Button
              onClick={() => setViewMode("relation")}
              size="sm"
              variant={viewMode === "relation" ? "secondary" : "ghost"}
            >
              <GitBranchIcon className="size-4" />
              By Relation
            </Button>
          </div>
          <Button
            onClick={() => setShowSuperseded((current) => !current)}
            size="sm"
            variant="outline"
          >
            {showSuperseded ? "Hide superseded" : "Show superseded"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {isLoading && visibleDecisions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Loading decisions...
          </div>
        ) : visibleDecisions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Confirmed decisions will appear here.
          </div>
        ) : viewMode === "type" ? (
          groupedByKind.map(([kind, entries]) => {
            const isCollapsed = collapsedKinds[kind] === true;

            return (
              <div className="flex flex-col gap-2" key={kind}>
                <button
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-left text-sm font-medium"
                  onClick={() =>
                    setCollapsedKinds((current) => ({
                      ...current,
                      [kind]: !current[kind],
                    }))
                  }
                  type="button"
                >
                  <span className="capitalize">
                    {kind} ({entries.length})
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "size-4 transition-transform",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-2">
                    {entries.map((decision) => (
                      <DecisionNode
                        decision={decision}
                        dimmed={decision.status === "superseded"}
                        key={decision.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <>
            {relationChildren.roots.map((decision) =>
              renderRelationNode(decision)
            )}
            {relationChildren.standalone.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Standalone
                </p>
                {relationChildren.standalone.map((decision) => (
                  <DecisionNode
                    decision={decision}
                    dimmed={decision.status === "superseded"}
                    key={decision.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
