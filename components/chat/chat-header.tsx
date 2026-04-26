"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EraserIcon,
  PanelLeftIcon,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { VercelIcon } from "./icons";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const {
    activeTopic,
    canGoBack,
    canGoForward,
    clearConversation,
    goBack,
    goForward,
  } = useWorkspace();

  if (state === "collapsed" && !isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 flex h-14 items-center gap-2 bg-sidebar px-3">
      <Button
        className="md:hidden"
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
      >
        <PanelLeftIcon className="size-4" />
      </Button>

      <Link
        className="flex size-8 items-center justify-center rounded-lg md:hidden"
        href="https://vercel.com/templates/next.js/chatbot"
        rel="noopener noreferrer"
        target="_blank"
      >
        <VercelIcon size={14} />
      </Link>

      {!isReadonly && (
        <>
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
          <div className="hidden items-center gap-1 md:flex">
            <Button
              disabled={!canGoBack}
              onClick={goBack}
              size="sm"
              variant="ghost"
            >
              <ArrowLeftIcon className="size-4" />
              Back
            </Button>
            <Button
              disabled={!canGoForward}
              onClick={goForward}
              size="sm"
              variant="ghost"
            >
              <ArrowRightIcon className="size-4" />
              Forward
            </Button>
            <Button
              onClick={() => {
                clearConversation().catch(console.error);
              }}
              size="sm"
              variant="outline"
            >
              <EraserIcon className="size-4" />
              Clear
            </Button>
          </div>
        </>
      )}

      <div className="ml-2 hidden min-w-0 md:block">
        <p className="truncate text-sm font-medium text-foreground">
          {activeTopic?.label ?? "Workspace"}
        </p>
        <p className="text-xs text-muted-foreground">
          {activeTopic?.archivedAt ? "Archived topic" : "Active topic"}
        </p>
      </div>

      <Button
        asChild
        className="hidden rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90 md:ml-auto md:flex"
      >
        <Link
          href="https://vercel.com/templates/next.js/chatbot"
          rel="noopener noreferrer"
          target="_blank"
        >
          <VercelIcon size={16} />
          Deploy with Vercel
        </Link>
      </Button>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
