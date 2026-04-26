"use client";

import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { cn } from "@/lib/utils";
import type { WorkspaceDecision, WorkspaceEdge } from "@/lib/workspace/types";

export function DecisionDetail({
  decision,
  decisions,
  edges,
  onClose,
}: {
  decision: WorkspaceDecision | null;
  decisions: WorkspaceDecision[];
  edges: WorkspaceEdge[];
  onClose: () => void;
}) {
  const { bringDecisionToSandbox, queueReferenceDraft, setSelectedDecisionId } =
    useWorkspace();
  const [restored, setRestored] = useState(false);
  const [referenced, setReferenced] = useState(false);
  const decisionById = useMemo(
    () => new Map(decisions.map((entry) => [entry.id, entry])),
    [decisions]
  );

  const relations = useMemo(() => {
    if (!decision) {
      return [];
    }

    return edges.flatMap((edge) => {
      if (edge.sourceDecisionId === decision.id) {
        return [
          {
            label: `${edge.type} ${decisionById.get(edge.targetDecisionId)?.title ?? edge.targetDecisionId}`,
            targetId: edge.targetDecisionId,
          },
        ];
      }

      if (edge.targetDecisionId === decision.id) {
        return [
          {
            label: `${edge.type} from ${decisionById.get(edge.sourceDecisionId)?.title ?? edge.sourceDecisionId}`,
            targetId: edge.sourceDecisionId,
          },
        ];
      }

      return [];
    });
  }, [decision, decisionById, edges]);

  const sourceAvailable = Boolean(
    decision?.createdFromMessageId &&
      typeof document !== "undefined" &&
      document.getElementById(`message-${decision.createdFromMessageId}`)
  );

  if (!decision) {
    return (
      <aside className="pointer-events-none absolute inset-y-0 right-0 w-full translate-x-full border-l border-border/60 bg-background/95 transition-transform duration-200 ease-out" />
    );
  }

  const currentDecision = decision;

  async function handleBringToSandbox() {
    const success = await bringDecisionToSandbox({
      decisionTitle: currentDecision.title,
      messageIds:
        currentDecision.relevantMessageIds &&
        currentDecision.relevantMessageIds.length > 0
          ? currentDecision.relevantMessageIds
          : currentDecision.createdFromMessageId
            ? [currentDecision.createdFromMessageId]
            : [],
    });

    if (success) {
      setRestored(true);
      window.setTimeout(() => setRestored(false), 1000);
    }
  }

  function handleReferenceNode() {
    queueReferenceDraft(
      `> [Decision: ${currentDecision.title}] ${currentDecision.content}`
    );
    setReferenced(true);
    window.setTimeout(() => setReferenced(false), 1000);
  }

  return (
    <aside
      className={cn(
        "absolute inset-y-0 right-0 z-20 w-full border-l border-border/60 bg-background/95 shadow-[-18px_0_40px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-200 ease-out",
        decision ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/50 bg-background/95 px-4 py-4 backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Decision Detail
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">
            {decision.title}
          </h3>
        </div>
        <Button onClick={onClose} size="icon-sm" variant="ghost">
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex h-[calc(100%-72px)] flex-col gap-5 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{decision.kind}</Badge>
            <Badge
              variant={decision.status === "active" ? "secondary" : "outline"}
            >
              {decision.status}
            </Badge>
            <Badge variant="outline">{decision.weight}</Badge>
          </div>
          <p className="text-sm leading-6 text-foreground">
            {decision.content}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Because
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {decision.rationale ?? "No rationale captured yet."}
          </p>
          {decision.createdFromMessageId ? (
            sourceAvailable ? (
              <button
                className="flex items-center gap-2 text-sm text-foreground underline underline-offset-4"
                onClick={() => {
                  const target = document.getElementById(
                    `message-${decision.createdFromMessageId}`
                  );
                  target?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
                type="button"
              >
                <ExternalLinkIcon className="size-4" />
                View source message
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Source conversation archived
              </p>
            )
          ) : null}
          <p className="text-xs text-muted-foreground">
            Confirmed {new Date(decision.createdAt).toLocaleString()}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Relations
          </p>
          {relations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No linked relations yet.
            </p>
          ) : (
            relations.map((relation) => (
              <button
                className="rounded-xl border border-border/50 px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-card/70"
                key={`${decision.id}-${relation.targetId}-${relation.label}`}
                onClick={() => setSelectedDecisionId(relation.targetId)}
                type="button"
              >
                {relation.label}
              </button>
            ))
          )}
        </section>

        <section className="mt-auto flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Actions
          </p>
          <Button
            className={cn(
              restored && "bg-emerald-600 text-white hover:bg-emerald-600"
            )}
            onClick={() => {
              handleBringToSandbox().catch(console.error);
            }}
            size="sm"
          >
            {restored ? <CheckIcon className="size-4" /> : null}
            Bring to sandbox
          </Button>
          <Button
            className={cn(referenced && "ring-2 ring-foreground/20")}
            onClick={handleReferenceNode}
            size="sm"
            variant="outline"
          >
            Reference node
          </Button>
        </section>
      </div>
    </aside>
  );
}
