"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  WorkspaceCandidateDecision,
  WorkspaceTruthSnapshot,
} from "@/lib/workspace/types";

function kindTone(kind: string | null) {
  switch (kind) {
    case "goal":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "constraint":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "principle":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "hypothesis":
      return "bg-sky-500/10 text-sky-700 border-sky-500/20";
    default:
      return "bg-violet-500/10 text-violet-700 border-violet-500/20";
  }
}

export function CandidatePool({
  topicId,
  candidates,
  isLoading,
  onUpdated,
}: {
  topicId: string | null;
  candidates: WorkspaceCandidateDecision[];
  isLoading: boolean;
  onUpdated: (data?: WorkspaceTruthSnapshot) => Promise<unknown>;
}) {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    setCheckedIds(
      Object.fromEntries(
        candidates.map((candidate) => [candidate.id, candidate.preSelected])
      )
    );
  }, [candidates]);

  const selectedCandidateIds = useMemo(
    () =>
      candidates
        .filter((candidate) => checkedIds[candidate.id] !== false)
        .map((candidate) => candidate.id),
    [candidates, checkedIds]
  );

  async function post(path: string, body: Record<string, unknown>) {
    setIsMutating(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const payload = (await response.json()) as WorkspaceTruthSnapshot;
      await onUpdated(payload);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update candidate decisions.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="flex min-h-[220px] shrink-0 flex-col rounded-2xl border border-border/60 bg-background/85 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Candidate Pool
          </p>
          <p className="text-xs text-muted-foreground">
            {candidates.length > 0
              ? `${candidates.length} pending candidate${candidates.length === 1 ? "" : "s"}`
              : "No pending candidates"}
          </p>
        </div>
        <Badge className="rounded-full" variant="outline">
          {candidates.length}
        </Badge>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {isLoading && candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              Loading candidates...
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              New extracted candidates will appear here.
            </div>
          ) : (
            candidates.map((candidate) => {
              const expanded = expandedId === candidate.id;

              return (
                <div
                  className="rounded-2xl border border-border/60 bg-card/70 p-3 transition-colors hover:border-border"
                  key={candidate.id}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      checked={checkedIds[candidate.id] !== false}
                      className="mt-1 h-4 w-4 rounded border-border"
                      onChange={(event) =>
                        setCheckedIds((current) => ({
                          ...current,
                          [candidate.id]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {candidate.proposedTitle ?? "Untitled candidate"}
                        </p>
                        <Badge
                          className={kindTone(candidate.proposedKind)}
                          variant="outline"
                        >
                          {candidate.proposedKind ?? "plan"}
                        </Badge>
                      </div>
                      <button
                        className="mt-2 text-left text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() =>
                          setExpandedId((current) =>
                            current === candidate.id ? null : candidate.id
                          )
                        }
                        type="button"
                      >
                        <span className={expanded ? "" : "line-clamp-2"}>
                          {candidate.proposedContent}
                        </span>
                      </button>
                    </div>
                  </label>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border/50 px-4 py-3">
          <Button
            className="flex-1"
            disabled={!topicId || candidates.length === 0 || isMutating}
            onClick={() =>
              topicId &&
              post("/api/workspace/candidates/confirm", {
                topicId,
                selectedCandidateIds,
              })
            }
            size="sm"
          >
            <CheckIcon className="size-4" />
            Confirm Selected
          </Button>
          <Button
            className="flex-1"
            disabled={!topicId || candidates.length === 0 || isMutating}
            onClick={() =>
              topicId &&
              post("/api/workspace/candidates/dismiss", {
                topicId,
              })
            }
            size="sm"
            variant="outline"
          >
            <XIcon className="size-4" />
            Dismiss All
          </Button>
        </div>
      </div>
    </section>
  );
}
