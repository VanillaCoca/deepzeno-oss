"use client";

import {
  FolderKanbanIcon,
  Layers3Icon,
  LogOutIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  createClient as createSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ProjectSidebar({
  userEmail,
}: {
  userEmail: string | null;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (!isSupabaseConfigured()) {
      router.push("/login");
      return;
    }

    setIsSigningOut(true);

    try {
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Sidebar className="border-r border-sidebar-border/60" collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary/10 text-sidebar-primary ring-1 ring-sidebar-border/60">
              <SparklesIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground">
                Zeno
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                Phase 1 Workspace
              </p>
            </div>
          </div>
          <SidebarTrigger className="md:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/60">
            Projects
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-10 rounded-xl bg-sidebar-accent/70 text-sidebar-accent-foreground hover:bg-sidebar-accent">
                  <FolderKanbanIcon className="size-4" />
                  <span className="font-medium">My Project</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/60">
            Topics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-10 rounded-xl border border-sidebar-border/60 bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent">
                  <Layers3Icon className="size-4" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate font-medium">General</span>
                    <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-accent-foreground">
                      Active
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 px-4 py-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground">
              Signed in
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {userEmail ?? "Authenticated user"}
            </p>
          </div>

          <Button
            className={cn(
              "justify-start rounded-xl",
              isSigningOut && "pointer-events-none opacity-70"
            )}
            onClick={handleSignOut}
            size="sm"
            variant="outline"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
