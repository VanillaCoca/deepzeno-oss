"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  createClient as createSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { fetcher } from "@/lib/utils";
import type {
  PendingCandidateCounts,
  WorkspaceBootstrap,
  WorkspaceConversation,
  WorkspaceMessageRecord,
  WorkspaceProject,
  WorkspaceSelectionParams,
  WorkspaceTopic,
} from "@/lib/workspace/types";

type DraftInsertion = {
  nonce: number;
  text: string;
};

type RestoredSandboxContext = {
  nonce: number;
  decisionTitle: string;
  messageIds: string[];
  messages: WorkspaceMessageRecord[];
  consumeOnNextSend: boolean;
};

type WorkspaceContextValue = {
  isLoading: boolean;
  workspace: WorkspaceBootstrap | null;
  projects: WorkspaceProject[];
  topics: WorkspaceTopic[];
  conversations: WorkspaceConversation[];
  activeProjectId: string | null;
  activeTopicId: string | null;
  currentConversationId: string | null;
  activeTopic: WorkspaceTopic | null;
  isArchivedTopicReadonly: boolean;
  selectedDecisionId: string | null;
  setSelectedDecisionId: (decisionId: string | null) => void;
  pendingCandidateCounts: PendingCandidateCounts;
  selectProject: (projectId: string) => Promise<void>;
  selectTopic: (topicId: string) => Promise<void>;
  selectConversation: (conversationId: string) => void;
  createProject: (name: string) => Promise<void>;
  createTopic: (label: string) => Promise<void>;
  archiveTopic: (topicId: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  refreshWorkspace: (selection?: WorkspaceSelectionParams) => Promise<void>;
  referenceDraft: DraftInsertion | null;
  queueReferenceDraft: (text: string) => void;
  consumeReferenceDraft: () => DraftInsertion | null;
  restoredSandboxContext: RestoredSandboxContext | null;
  bringDecisionToSandbox: (params: {
    decisionTitle: string;
    messageIds: string[];
  }) => Promise<boolean>;
  clearRestoredSandboxContext: () => void;
  consumeRestoredContextMessageIds: () => string[];
  setPendingCount: (topicId: string, count: number) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function extractConversationId(pathname: string) {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

function buildBootstrapUrl(selection: WorkspaceSelectionParams) {
  const params = new URLSearchParams();

  if (selection.projectId) {
    params.set("projectId", selection.projectId);
  }

  if (selection.topicId) {
    params.set("topicId", selection.topicId);
  }

  if (selection.conversationId) {
    params.set("conversationId", selection.conversationId);
  }

  const query = params.toString();
  const prefix = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/workspace/bootstrap`;

  return query ? `${prefix}?${query}` : prefix;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const selectionRef = useRef<WorkspaceSelectionParams>({
    conversationId: extractConversationId(pathname),
  });
  const [selection, setSelection] = useState<WorkspaceSelectionParams>(() => ({
    conversationId: extractConversationId(pathname),
  }));
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(
    null
  );
  const [referenceDraft, setReferenceDraft] = useState<DraftInsertion | null>(
    null
  );
  const [restoredSandboxContext, setRestoredSandboxContext] =
    useState<RestoredSandboxContext | null>(null);
  const [pendingCandidateCounts, setPendingCandidateCounts] =
    useState<PendingCandidateCounts>({});

  const { data, isLoading, mutate } = useSWR<{ workspace: WorkspaceBootstrap }>(
    buildBootstrapUrl(selection),
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const workspace = data?.workspace ?? null;
  const projects = workspace?.projects ?? [];
  const topics = workspace?.topics ?? [];
  const conversations = workspace?.conversations ?? [];
  const activeProjectId = workspace?.activeProjectId ?? null;
  const activeTopicId = workspace?.activeTopicId ?? null;
  const currentConversationId = workspace?.currentConversationId ?? null;
  const activeTopic =
    topics.find((topic) => topic.id === activeTopicId) ?? null;

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    if (workspace) {
      setPendingCandidateCounts(workspace.pendingCandidateCounts);
    }
  }, [workspace]);

  useEffect(() => {
    if (!activeProjectId || !isSupabaseConfigured()) {
      return;
    }

    const supabase = createSupabaseClient();
    const channel = supabase
      .channel(`workspace-project:${activeProjectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidate_decisions",
          filter: `project_id=eq.${activeProjectId}`,
        },
        async () => {
          const selectionSnapshot = { ...selectionRef.current };
          const selectionUrl = buildBootstrapUrl(selectionSnapshot);
          const nextWorkspace = await fetcher(selectionUrl);

          if (selectionUrl !== buildBootstrapUrl(selectionRef.current)) {
            return;
          }

          await mutate(nextWorkspace, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [activeProjectId, mutate]);

  async function refreshWorkspace(nextSelection?: WorkspaceSelectionParams) {
    if (nextSelection) {
      selectionRef.current = {
        ...selectionRef.current,
        ...nextSelection,
      };
      setSelection((current) => ({
        ...current,
        ...nextSelection,
      }));
      return;
    }

    await mutate();
  }

  async function postWorkspaceUpdate(
    path: string,
    body?: Record<string, unknown>
  ) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : "{}",
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.cause ?? payload?.error ?? "Request failed");
    }

    return response.json();
  }

  async function selectProject(projectId: string) {
    await refreshWorkspace({ projectId, topicId: null, conversationId: null });
    setSelectedDecisionId(null);
  }

  async function selectTopic(topicId: string) {
    await refreshWorkspace({
      projectId: activeProjectId,
      topicId,
      conversationId: null,
    });
    setSelectedDecisionId(null);
  }

  function selectConversation(conversationId: string) {
    selectionRef.current = {
      ...selectionRef.current,
      projectId: activeProjectId,
      topicId: activeTopicId,
      conversationId,
    };
    setSelection((current) => ({
      ...current,
      projectId: activeProjectId,
      topicId: activeTopicId,
      conversationId,
    }));
    setSelectedDecisionId(null);
  }

  async function createProject(name: string) {
    const payload = await postWorkspaceUpdate("/api/workspace/projects", {
      name,
    });
    await mutate(payload, false);
    selectionRef.current = {
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    };
    setSelection({
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    });
  }

  async function createTopic(label: string) {
    if (!activeProjectId) {
      throw new Error("Workspace project is not ready yet.");
    }

    const payload = await postWorkspaceUpdate("/api/workspace/topics", {
      projectId: activeProjectId,
      label,
    });
    await mutate(payload, false);
    selectionRef.current = {
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    };
    setSelection({
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    });
  }

  async function archiveTopic(topicId: string) {
    const payload = await postWorkspaceUpdate(
      `/api/workspace/topics/${topicId}/archive`
    );
    await mutate(payload, false);
    selectionRef.current = {
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    };
    setSelection({
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    });
  }

  async function clearConversation() {
    if (!activeTopicId) {
      return;
    }

    const payload = await postWorkspaceUpdate(
      "/api/workspace/conversations/clear",
      {
        topicId: activeTopicId,
        conversationId: currentConversationId,
      }
    );
    await mutate(payload, false);
    selectionRef.current = {
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    };
    setSelection({
      projectId: payload.workspace.activeProjectId,
      topicId: payload.workspace.activeTopicId,
      conversationId: payload.workspace.currentConversationId,
    });
  }

  const currentConversationIndex = conversations.findIndex(
    (conversation) => conversation.id === currentConversationId
  );
  const canGoBack = currentConversationIndex > 0;
  const canGoForward =
    currentConversationIndex >= 0 &&
    currentConversationIndex < conversations.length - 1;

  function goBack() {
    if (!canGoBack) {
      return;
    }

    selectConversation(conversations[currentConversationIndex - 1].id);
  }

  function goForward() {
    if (!canGoForward) {
      return;
    }

    selectConversation(conversations[currentConversationIndex + 1].id);
  }

  function queueReferenceDraft(text: string) {
    setReferenceDraft({
      nonce: Date.now(),
      text,
    });
  }

  function consumeReferenceDraft() {
    const currentDraft = referenceDraft;
    setReferenceDraft(null);
    return currentDraft;
  }

  async function bringDecisionToSandbox({
    decisionTitle,
    messageIds,
  }: {
    decisionTitle: string;
    messageIds: string[];
  }) {
    if (messageIds.length === 0) {
      toast.error("This node does not have linked source messages yet.");
      return false;
    }

    const params = new URLSearchParams();

    for (const messageId of messageIds) {
      params.append("ids", messageId);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/workspace/messages?${params.toString()}`
    );

    if (!response.ok) {
      toast.error("Failed to restore the related workspace context.");
      return false;
    }

    const payload = await response.json();
    const messages = payload.messages as WorkspaceMessageRecord[];

    setRestoredSandboxContext({
      nonce: Date.now(),
      decisionTitle,
      messageIds,
      messages,
      consumeOnNextSend: true,
    });

    return true;
  }

  function clearRestoredSandboxContext() {
    setRestoredSandboxContext(null);
  }

  function consumeRestoredContextMessageIds() {
    if (!restoredSandboxContext?.consumeOnNextSend) {
      return [];
    }

    setRestoredSandboxContext((current) =>
      current
        ? {
            ...current,
            consumeOnNextSend: false,
          }
        : null
    );

    return restoredSandboxContext.messageIds;
  }

  function setPendingCount(topicId: string, count: number) {
    setPendingCandidateCounts((current) => ({
      ...current,
      [topicId]: count,
    }));
  }

  const value: WorkspaceContextValue = {
    isLoading,
    workspace,
    projects,
    topics,
    conversations,
    activeProjectId,
    activeTopicId,
    currentConversationId,
    activeTopic,
    isArchivedTopicReadonly: workspace?.isArchivedTopicReadonly ?? false,
    selectedDecisionId,
    setSelectedDecisionId,
    pendingCandidateCounts,
    selectProject,
    selectTopic,
    selectConversation,
    createProject,
    createTopic,
    archiveTopic,
    clearConversation,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    refreshWorkspace,
    referenceDraft,
    queueReferenceDraft,
    consumeReferenceDraft,
    restoredSandboxContext,
    bringDecisionToSandbox,
    clearRestoredSandboxContext,
    consumeRestoredContextMessageIds,
    setPendingCount,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }

  return context;
}
