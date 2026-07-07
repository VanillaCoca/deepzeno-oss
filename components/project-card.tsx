"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WorkspaceProjectSummary } from "@/lib/workspace/types";

// A small palette of tasteful, theme-aware accents. Each project gets a stable
// one (hashed from its id) so the grid is scannable by color + monogram rather
// than a wall of identical bordered rows. Full class strings (no interpolation)
// so Tailwind keeps them.
const ACCENTS = [
  "bg-blue-500/12 text-blue-600 ring-blue-500/20 dark:text-blue-300",
  "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
  "bg-violet-500/12 text-violet-600 ring-violet-500/20 dark:text-violet-300",
  "bg-amber-500/12 text-amber-600 ring-amber-500/20 dark:text-amber-300",
  "bg-rose-500/12 text-rose-600 ring-rose-500/20 dark:text-rose-300",
  "bg-cyan-500/12 text-cyan-600 ring-cyan-500/20 dark:text-cyan-300",
];

function accentFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length];
}

export function ProjectCard({
  href,
  project,
}: {
  href: string;
  project: WorkspaceProjectSummary;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(
        `${base}/api/workspace/projects?projectId=${project.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Request failed");
      }

      toast.success(t("dialog.projectCard.deletedToast"));
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Delete project failed", error);
      toast.error(t("dialog.projectCard.deleteFailedToast"));
    } finally {
      setIsDeleting(false);
    }
  }

  const monogram = (project.name.trim()[0] ?? "?").toUpperCase();
  const accent = accentFor(project.id);

  return (
    <div className="group/card relative">
      <Link
        className="flex h-full min-h-[7.5rem] cursor-pointer flex-col justify-between rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:border-border hover:bg-card hover:shadow-[var(--shadow-float-sm)]"
        href={href}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-inset",
              accent
            )}
          >
            {monogram}
          </span>
          <span
            className="pt-1 text-right text-xs text-muted-foreground/80"
            suppressHydrationWarning
          >
            {formatDistanceToNowStrict(new Date(project.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        <div className="mt-3">
          <p className="truncate pr-6 font-medium text-foreground">
            {project.name}
          </p>
          <p
            className="mt-0.5 text-sm text-muted-foreground"
            suppressHydrationWarning
          >
            {project.topicCount}{" "}
            {project.topicCount === 1
              ? t("dialog.projectCard.topicSingular")
              : t("dialog.projectCard.topicPlural")}
          </p>
        </div>
      </Link>

      <div className="absolute right-2.5 bottom-2.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("dialog.projectCard.actionsFor", {
                name: project.name,
              })}
              className="size-7 text-muted-foreground hover:text-foreground"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
              variant="destructive"
            >
              <Trash2Icon />
              {t("dialog.projectCard.deleteProject")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dialog.projectCard.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.projectCard.confirmDescription", {
                name: project.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("dialog.projectCard.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {t("dialog.projectCard.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
