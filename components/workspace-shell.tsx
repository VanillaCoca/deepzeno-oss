"use client";

import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { IRPanel } from "@/components/ir/ir-panel";
import { IRProvider } from "@/components/ir/ir-provider";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ProjectSidebar } from "./project-sidebar";

const DEFAULT_TRUTH_PANEL_WIDTH = 480;
const MIN_TRUTH_PANEL_WIDTH = 360;
const MAX_TRUTH_PANEL_WIDTH = 640;

function clampTruthPanelWidth(width: number) {
  return Math.min(
    MAX_TRUTH_PANEL_WIDTH,
    Math.max(MIN_TRUTH_PANEL_WIDTH, Math.round(width))
  );
}

export function WorkspaceShell({
  children,
  defaultSidebarOpen,
  userEmail,
}: {
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
  userEmail: string | null;
}) {
  const [isTruthPanelOpen, setIsTruthPanelOpen] = useLocalStorage(
    "truth-panel-open",
    true
  );
  const [truthPanelWidth, setTruthPanelWidth] = useLocalStorage(
    "truth-panel-width",
    DEFAULT_TRUTH_PANEL_WIDTH
  );
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const showTruthPanel = hasMounted ? isTruthPanelOpen : true;
  const panelWidth = hasMounted
    ? clampTruthPanelWidth(truthPanelWidth)
    : DEFAULT_TRUTH_PANEL_WIDTH;

  useEffect(() => {
    if (hasMounted && truthPanelWidth !== panelWidth) {
      setTruthPanelWidth(panelWidth);
    }
  }, [hasMounted, panelWidth, setTruthPanelWidth, truthPanelWidth]);

  function handlePanelResizePointerDown(
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    event.preventDefault();

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextWidth = window.innerWidth - pointerEvent.clientX;
      setTruthPanelWidth(clampTruthPanelWidth(nextWidth));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  return (
    <SidebarProvider
      className="bg-sidebar"
      defaultOpen={defaultSidebarOpen}
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      <ProjectSidebar userEmail={userEmail} />

      <SidebarInset className="min-h-dvh bg-sidebar">
        <IRProvider>
          <div className="relative flex h-dvh min-w-0">
            <div className="min-w-0 flex-1">{children}</div>

            <aside
              className={cn(
                "relative hidden h-dvh min-h-0 shrink-0 border-l border-[var(--ir-border-default)] bg-[var(--ir-bg-panel)] xl:flex xl:flex-col",
                !showTruthPanel && "xl:hidden"
              )}
              data-testid="truth-panel"
              style={{
                width: `${panelWidth}px`,
                minWidth: "var(--ir-right-panel-min-width)",
                maxWidth: `${MAX_TRUTH_PANEL_WIDTH}px`,
              }}
            >
              <button
                aria-label="Resize IR panel"
                className="absolute left-0 top-0 h-full w-1 -translate-x-1/2 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ir-border-focus)]"
                onPointerDown={handlePanelResizePointerDown}
                type="button"
              />
              <div className="flex items-center justify-between border-b border-[var(--ir-border-default)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--ir-text-primary)]">
                    IR Panel
                  </p>
                  <p className="text-xs text-[var(--ir-text-tertiary)]">
                    Ideas, candidates, truth, and detail
                  </p>
                </div>
                <Button
                  className="rounded border border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                  onClick={() => setIsTruthPanelOpen(false)}
                  size="icon-sm"
                  variant="outline"
                >
                  <PanelRightCloseIcon className="size-4" />
                </Button>
              </div>

              <IRPanel />
            </aside>

            {!showTruthPanel && (
              <Button
                className="absolute right-4 top-4 z-30 hidden rounded border-[var(--ir-border-strong)] bg-[var(--ir-bg-panel)] hover:bg-[var(--ir-bg-hover)] xl:inline-flex"
                onClick={() => setIsTruthPanelOpen(true)}
                size="sm"
                variant="outline"
              >
                <PanelRightOpenIcon className="size-4" />
                IR Panel
              </Button>
            )}
          </div>
        </IRProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
