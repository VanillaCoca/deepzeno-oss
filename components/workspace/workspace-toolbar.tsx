"use client";

import { MessagesSquareIcon, NetworkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceView = "conversation" | "truth-graph";

export function WorkspaceToolbar({
  candidateCount,
  ideaCount,
  onOpenDrawer,
  onViewChange,
  view,
}: {
  candidateCount: number;
  ideaCount: number;
  onOpenDrawer: () => void;
  onViewChange: (view: WorkspaceView) => void;
  view: WorkspaceView;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--ir-border-default)] px-4 py-2">
      <div className="flex rounded-lg border border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] p-0.5">
        {(["conversation", "truth-graph"] as const).map((value) => (
          <Button
            aria-pressed={view === value}
            className={cn(
              "h-7 rounded-md px-2 text-xs",
              view === value
                ? "bg-[var(--ir-bg-panel)] text-[var(--ir-text-primary)]"
                : "bg-transparent text-[var(--ir-text-tertiary)]"
            )}
            key={value}
            onClick={() => onViewChange(value)}
            size="xs"
            variant="ghost"
          >
            {value === "conversation" ? (
              <MessagesSquareIcon className="size-3" />
            ) : (
              <NetworkIcon className="size-3" />
            )}
            {value === "conversation" ? "Conversation" : "Truth Graph"}
          </Button>
        ))}
      </div>
      <Button
        className="h-7 rounded-md border border-[var(--ir-border-strong)] bg-transparent px-2 text-xs hover:bg-[var(--ir-bg-hover)]"
        data-testid="ir-drawer-trigger"
        onClick={onOpenDrawer}
        size="xs"
        variant="outline"
      >
        Ideas ({ideaCount}) · Candidates ({candidateCount})
      </Button>
    </div>
  );
}
