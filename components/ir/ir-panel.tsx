"use client";

import {
  ArrowDownToLineIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  GitBranchIcon,
  ListTreeIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { irNodeKey, useIR } from "@/components/ir/ir-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type {
  IRDetail,
  IREdge,
  IRKind,
  IRNode,
  IRPlanSubtype,
} from "@/lib/ir/types";
import { getIRTypeLabel } from "@/lib/ir/types";
import { cn, fetcher } from "@/lib/utils";

type TruthMode = "type" | "relation";
type EditMode = "confirm" | "supersede" | null;

const TRUTH_GROUPS: Array<{
  key: string;
  kind: IRKind;
  subtype?: IRPlanSubtype | null;
  label: string;
  defaultOpen: boolean;
}> = [
  { key: "goal", kind: "goal", label: "Goals", defaultOpen: false },
  {
    key: "decision",
    kind: "plan",
    subtype: "decision",
    label: "Decisions",
    defaultOpen: true,
  },
  {
    key: "constraint",
    kind: "constraint",
    label: "Constraints",
    defaultOpen: true,
  },
  {
    key: "task",
    kind: "plan",
    subtype: "task",
    label: "Tasks",
    defaultOpen: false,
  },
  {
    key: "milestone",
    kind: "plan",
    subtype: "milestone",
    label: "Milestones",
    defaultOpen: false,
  },
  {
    key: "open_question",
    kind: "open_question",
    label: "Open Questions",
    defaultOpen: false,
  },
  {
    key: "hypothesis",
    kind: "hypothesis",
    label: "Hypotheses",
    defaultOpen: false,
  },
  {
    key: "principle",
    kind: "principle",
    label: "Principles",
    defaultOpen: false,
  },
  {
    key: "rejection",
    kind: "rejection",
    label: "Rejections",
    defaultOpen: false,
  },
  {
    key: "unclassified",
    kind: "unclassified",
    label: "Unclassified",
    defaultOpen: false,
  },
];

function nodeMatchesGroup(node: IRNode, group: (typeof TRUTH_GROUPS)[number]) {
  return (
    node.kind === group.kind &&
    (group.subtype === undefined || node.subtype === group.subtype)
  );
}

function nodeSearchText(node: IRNode) {
  return [
    node.id,
    node.title,
    node.content,
    node.rationale,
    node.kind,
    node.subtype,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function postJSON<T>(path: string, body?: Record<string, unknown>) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.cause ?? payload?.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

function StatusBadge({ status }: { status: IRNode["status"] }) {
  return (
    <span className="text-[11px] lowercase text-[var(--ir-text-secondary)]">
      {status}
    </span>
  );
}

function getNodeTypeLabel(node: IRNode) {
  if (node.kind === "plan") {
    return node.subtype ?? "plan";
  }

  if (node.kind === "unclassified") {
    return "?";
  }

  return node.kind.replace("_", " ");
}

function NodeButton({
  node,
  selected,
  onSelect,
}: {
  node: IRNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={cn(
        "relative block w-full border-b border-[var(--ir-border-default)] px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--ir-bg-hover)]",
        selected &&
          "bg-[var(--ir-bg-hover)] before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-[var(--ir-accent-blue)]"
      )}
      onClick={() => onSelect(node.id)}
      title={node.title}
      type="button"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[11px] lowercase tracking-[0.02em] text-[var(--ir-text-tertiary)]",
            node.kind === "unclassified" && "text-[var(--ir-warning-fg)]"
          )}
        >
          {getNodeTypeLabel(node)}
        </span>
        <span className="font-[var(--ir-font-mono)] text-xs text-[var(--ir-text-secondary)]">
          {node.id}
        </span>
      </div>
      <div
        className={cn(
          "ir-row-title mt-1 text-sm font-normal leading-[1.4] text-[var(--ir-text-primary)]",
          node.status === "superseded" &&
            "text-[var(--ir-text-tertiary)] line-through",
          node.status === "idea" && "text-[var(--ir-text-tertiary)]"
        )}
      >
        {node.title}
      </div>
    </button>
  );
}

function ZoneHeader({
  count,
  expanded,
  hidden,
  label,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  hidden?: boolean;
  label: string;
  onToggle: () => void;
}) {
  if (hidden) {
    return null;
  }

  return (
    <button
      className="flex h-8 w-full items-center gap-2 px-1 text-left text-[13px] font-medium text-[var(--ir-text-secondary)]"
      onClick={onToggle}
      type="button"
    >
      {expanded ? (
        <ChevronDownIcon className="size-3.5" />
      ) : (
        <ChevronRightIcon className="size-3.5" />
      )}
      <span>{label}</span>
      <span className="text-[var(--ir-text-tertiary)]">({count})</span>
    </button>
  );
}

function DetailRelationList({
  detail,
  onSelect,
}: {
  detail: IRDetail;
  onSelect: (nodeId: string) => void;
}) {
  const relatedById = new Map(
    detail.relatedNodes.map((node) => [node.id, node])
  );

  if (detail.edges.length === 0) {
    return (
      <p className="text-sm text-[var(--ir-text-tertiary)]">No relations.</p>
    );
  }

  return (
    <div>
      {detail.edges.map((edge) => {
        const isOutgoing = edge.fromNode === detail.node.id;
        const targetId = isOutgoing ? edge.toNode : edge.fromNode;
        const related = relatedById.get(targetId);

        return (
          <button
            className="flex w-full items-center gap-2 border-b border-[var(--ir-border-default)] px-1 py-2 text-left text-sm hover:bg-[var(--ir-bg-hover)]"
            key={edge.id}
            onClick={() => onSelect(targetId)}
            type="button"
          >
            <span className="text-[11px] lowercase text-[var(--ir-text-tertiary)]">
              {isOutgoing ? edge.relation : `${edge.relation} by`}
            </span>
            <span className="min-w-0 flex-1 text-[var(--ir-text-primary)]">
              {targetId} · {related?.title ?? "Unknown"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function IRPanel() {
  const {
    candidates,
    ideas,
    isLoading,
    refreshIR,
    selectNode,
    selectedNodeId,
    truth,
    truthEdges,
  } = useIR();
  const {
    activeProjectId,
    activeTopicId,
    bringDecisionToSandbox,
    queueReferenceDraft,
  } = useWorkspace();
  const [ideasExpanded, setIdeasExpanded] = useState(false);
  const [candidatesExpanded, setCandidatesExpanded] = useState(true);
  const [listPanePercent, setListPanePercent] = useState(55);
  const [truthMode, setTruthMode] = useState<TruthMode>("type");
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(
      TRUTH_GROUPS.map((group) => [group.key, !group.defaultOpen])
    )
  );
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftRationale, setDraftRationale] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [kindChoice, setKindChoice] = useState("plan:decision");
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: detail, mutate: mutateDetail } = useSWR<IRDetail>(
    irNodeKey(selectedNodeId),
    fetcher,
    { revalidateOnFocus: false }
  );
  const selectedNode =
    detail?.node ??
    [...ideas, ...candidates, ...truth].find(
      (node) => node.id === selectedNodeId
    ) ??
    null;
  const filteredTruth = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return truth;
    }

    return truth.filter((node) => nodeSearchText(node).includes(query));
  }, [search, truth]);

  async function runMutation(
    action: () => Promise<
      { node?: IRNode; new_id?: string } | IRDetail | unknown
    >,
    successMessage: string
  ) {
    setIsMutating(true);

    try {
      const payload = await action();
      await refreshIR();
      await mutateDetail();

      if (payload && typeof payload === "object") {
        const record = payload as { node?: IRNode; new_id?: string };
        const nextId = record.node?.id ?? record.new_id;

        if (nextId) {
          selectNode(nextId);
        }
      }

      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "IR update failed.");
    } finally {
      setIsMutating(false);
    }
  }

  function openEdit(mode: Exclude<EditMode, null>) {
    if (!selectedNode) {
      return;
    }

    setEditMode(mode);
    setDraftTitle(selectedNode.title);
    setDraftContent(selectedNode.content ?? "");
    setDraftRationale(selectedNode.rationale ?? "");
  }

  async function submitEditDialog() {
    if (!selectedNode) {
      return;
    }

    const title = draftTitle.trim();

    if (!title) {
      toast.error("Title is required.");
      return;
    }

    if (editMode === "confirm") {
      await runMutation(
        () =>
          postJSON<IRDetail>(`/api/ir/${selectedNode.id}/confirm`, {
            edits: {
              title,
              content: draftContent.trim() || null,
              rationale: draftRationale.trim() || null,
            },
          }),
        "Candidate confirmed."
      );
    }

    if (editMode === "supersede") {
      await runMutation(
        () =>
          postJSON<IRDetail>(`/api/ir/${selectedNode.id}/supersede`, {
            title,
            content: draftContent.trim() || null,
            rationale: draftRationale.trim() || null,
          }),
        "Replacement candidate drafted."
      );
    }

    setEditMode(null);
  }

  async function handleReclassify(node: IRNode) {
    const [kind, subtype] = kindChoice.split(":") as [
      IRKind,
      string | undefined,
    ];
    await runMutation(
      () =>
        postJSON<{ node: IRNode; new_id: string }>(
          `/api/ir/${node.id}/reclassify`,
          {
            kind,
            subtype: subtype === "_" ? null : subtype,
          }
        ),
      "Kind updated."
    );
  }

  function handleBringToSandbox(node: IRNode) {
    const success = bringDecisionToSandbox({
      decisionId: node.id,
      decisionTitle: node.title,
      kind: getIRTypeLabel(node.kind, node.subtype),
      content: node.content ?? node.title,
      rationale: node.rationale,
    });

    if (success) {
      toast.success("Loaded into sandbox.");
    }
  }

  async function handleCreateNextStep(node: IRNode) {
    if (!activeProjectId) {
      return;
    }

    await runMutation(
      () =>
        postJSON<IRDetail>("/api/ir/draft", {
          project_id: activeProjectId,
          topic_id: node.topicId ?? activeTopicId,
          kind: "plan",
          subtype: "task",
          title: `Next step for ${node.id}`,
          content: `Define the next concrete step for: ${node.title}`,
          rationale: "Drafted from the active truth detail pane.",
          source_layer: "manual",
          created_by: "user",
          initial_status: "pending",
          relations: [{ relation: "depends_on", to_node: node.id }],
        }),
      "Task candidate drafted."
    );
  }

  function handleDividerPointerDown(event: React.PointerEvent<HTMLElement>) {
    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    event.preventDefault();
    const rect = panel.getBoundingClientRect();

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextPercent =
        ((pointerEvent.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
      setListPanePercent(Math.min(72, Math.max(28, nextPercent)));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  const relationModeNodes = useMemo(() => {
    if (!selectedNodeId) {
      return [];
    }

    const relatedIds = new Set<string>();

    for (const edge of truthEdges) {
      if (edge.fromNode === selectedNodeId) {
        relatedIds.add(edge.toNode);
      }

      if (edge.toNode === selectedNodeId) {
        relatedIds.add(edge.fromNode);
      }
    }

    return filteredTruth.filter(
      (node) => node.id === selectedNodeId || relatedIds.has(node.id)
    );
  }, [filteredTruth, selectedNodeId, truthEdges]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[var(--ir-bg-panel)] text-[var(--ir-text-primary)]"
      data-testid="ir-panel"
      ref={panelRef}
    >
      <div className="border-b border-[var(--ir-border-default)] px-3 py-2 text-xs text-[var(--ir-text-tertiary)]">
        Since last visit: {candidates.length} ·{" "}
        {candidates.length > 0 ? "1 warning" : "0 warnings"}
      </div>

      <div
        className="flex min-h-0 flex-col overflow-y-auto px-0 py-2"
        style={{ flexBasis: `${listPanePercent}%` }}
      >
        <ZoneHeader
          count={ideas.length}
          expanded={ideasExpanded}
          hidden={ideas.length === 0}
          label="Ideas"
          onToggle={() => setIdeasExpanded((current) => !current)}
        />
        {ideasExpanded ? (
          <div className="mb-2" data-testid="ir-ideas-zone">
            {ideas.slice(0, 10).map((node) => (
              <NodeButton
                key={node.id}
                node={node}
                onSelect={selectNode}
                selected={selectedNodeId === node.id}
              />
            ))}
            {ideas.length > 10 ? (
              <button
                className="px-3.5 py-2 text-xs text-[var(--ir-text-tertiary)]"
                type="button"
              >
                + {ideas.length - 10} more
              </button>
            ) : null}
          </div>
        ) : null}

        <ZoneHeader
          count={candidates.length}
          expanded={candidatesExpanded}
          label="Candidates"
          onToggle={() => setCandidatesExpanded((current) => !current)}
        />
        {candidatesExpanded ? (
          <div className="mb-3" data-testid="ir-candidates-zone">
            {candidates.length === 0 && !isLoading ? (
              <p className="px-3.5 py-2 text-sm text-[var(--ir-text-tertiary)]">
                No pending candidates.
              </p>
            ) : null}
            {candidates.map((node) => (
              <NodeButton
                key={node.id}
                node={node}
                onSelect={selectNode}
                selected={selectedNodeId === node.id}
              />
            ))}
          </div>
        ) : null}

        <div className="sticky top-0 z-10 border-y border-[var(--ir-border-default)] bg-[var(--ir-bg-panel)] px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-[var(--ir-text-secondary)]">
              Truth{" "}
              <span className="text-[var(--ir-text-tertiary)]">
                ({truth.length})
              </span>
            </p>
            <div className="flex rounded border border-[var(--ir-border-strong)] bg-transparent">
              <Button
                className={cn(
                  "h-7 rounded-none border-0 bg-transparent text-xs hover:bg-[var(--ir-bg-hover)]",
                  truthMode === "type" && "bg-[var(--ir-bg-hover)]"
                )}
                onClick={() => setTruthMode("type")}
                size="xs"
                variant="ghost"
              >
                <ListTreeIcon className="size-3" />
                Type
              </Button>
              <Button
                className={cn(
                  "h-7 rounded-none border-0 bg-transparent text-xs hover:bg-[var(--ir-bg-hover)]",
                  truthMode === "relation" && "bg-[var(--ir-bg-hover)]"
                )}
                onClick={() => setTruthMode("relation")}
                size="xs"
                variant="ghost"
              >
                <GitBranchIcon className="size-3" />
                Relation
              </Button>
            </div>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ir-text-tertiary)]" />
            <Input
              className="h-8 rounded border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] pl-7 text-xs focus-visible:ring-0"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              value={search}
            />
          </div>
        </div>

        <div className="py-2" data-testid="ir-truth-zone">
          {truthMode === "relation" && relationModeNodes.length > 0
            ? relationModeNodes.map((node) => (
                <NodeButton
                  key={node.id}
                  node={node}
                  onSelect={selectNode}
                  selected={selectedNodeId === node.id}
                />
              ))
            : null}

          {truthMode === "relation" && relationModeNodes.length === 0 ? (
            <p className="px-3.5 py-2 text-sm text-[var(--ir-text-tertiary)]">
              Select a truth node to inspect relations.
            </p>
          ) : null}

          {truthMode === "type"
            ? TRUTH_GROUPS.map((group) => {
                const nodes = filteredTruth.filter((node) =>
                  nodeMatchesGroup(node, group)
                );

                if (nodes.length === 0) {
                  return null;
                }

                const collapsed = collapsedGroups[group.key] ?? false;

                return (
                  <div key={group.key}>
                    <button
                      className="flex h-8 w-full items-center gap-2 px-3.5 text-left text-[13px] font-medium text-[var(--ir-text-secondary)]"
                      onClick={() =>
                        setCollapsedGroups((current) => ({
                          ...current,
                          [group.key]: !collapsed,
                        }))
                      }
                      type="button"
                    >
                      {collapsed ? (
                        <ChevronRightIcon className="size-3.5" />
                      ) : (
                        <ChevronDownIcon className="size-3.5" />
                      )}
                      <span>{group.label}</span>
                      <span className="text-[var(--ir-text-tertiary)]">
                        ({nodes.length})
                      </span>
                    </button>
                    {collapsed
                      ? null
                      : nodes.map((node) => (
                          <NodeButton
                            key={node.id}
                            node={node}
                            onSelect={selectNode}
                            selected={selectedNodeId === node.id}
                          />
                        ))}
                  </div>
                );
              })
            : null}
        </div>
      </div>

      <button
        aria-label="Resize IR detail pane"
        className="h-1 cursor-row-resize border-y border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] focus-visible:outline-none"
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            setListPanePercent((current) => Math.max(28, current - 5));
          }

          if (event.key === "ArrowDown") {
            setListPanePercent((current) => Math.min(72, current + 5));
          }
        }}
        onPointerDown={handleDividerPointerDown}
        type="button"
      />

      <div
        className="flex min-h-[220px] flex-1 flex-col overflow-hidden"
        data-testid="ir-detail-pane"
      >
        {selectedNode ? (
          <>
            <div className="flex items-start justify-between gap-2 border-b border-[var(--ir-border-default)] px-3 py-3">
              <div className="min-w-0">
                <p className="font-[var(--ir-font-mono)] text-xs text-[var(--ir-text-secondary)]">
                  {getNodeTypeLabel(selectedNode)} {selectedNode.id}
                </p>
                <h3 className="mt-1 break-words text-base font-medium leading-[1.35] text-[var(--ir-text-primary)]">
                  {selectedNode.title}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ir-text-tertiary)]">
                  <span>
                    {getIRTypeLabel(selectedNode.kind, selectedNode.subtype)}
                  </span>
                  <span>·</span>
                  <StatusBadge status={selectedNode.status} />
                </div>
              </div>
              <Button
                className="rounded border border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                onClick={() => selectNode(null)}
                size="icon-sm"
                variant="outline"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ir-text-tertiary)]">
                  Rationale
                </p>
                <p className="whitespace-pre-wrap text-sm leading-[1.55] text-[var(--ir-text-primary)]">
                  {selectedNode.rationale ||
                    selectedNode.content ||
                    selectedNode.title}
                </p>
              </section>

              <section className="mt-4 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ir-text-tertiary)]">
                  Relations
                </p>
                {detail ? (
                  <DetailRelationList detail={detail} onSelect={selectNode} />
                ) : (
                  <p className="text-sm text-[var(--ir-text-tertiary)]">
                    Loading...
                  </p>
                )}
              </section>

              <section className="mt-4 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ir-text-tertiary)]">
                  Source
                </p>
                <p className="text-sm leading-[1.55] text-[var(--ir-text-secondary)]">
                  {selectedNode.sourceLayer ?? "manual"} ·{" "}
                  {new Date(selectedNode.createdAt).toLocaleString()}
                </p>
              </section>

              {selectedNode.status === "pending" &&
              selectedNode.kind === "unclassified" ? (
                <section className="mt-4 space-y-2 border border-[var(--ir-warning-stripe)] bg-[var(--ir-warning-bg)] p-2">
                  <p className="text-xs font-semibold text-[var(--ir-warning-fg)]">
                    Kind: not yet classified
                  </p>
                  <div className="flex gap-2">
                    <select
                      className="h-8 min-w-0 flex-1 rounded border border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] px-2 text-xs"
                      onChange={(event) => setKindChoice(event.target.value)}
                      value={kindChoice}
                    >
                      <option value="plan:decision">plan / decision</option>
                      <option value="plan:task">plan / task</option>
                      <option value="plan:milestone">plan / milestone</option>
                      <option value="goal:_">goal</option>
                      <option value="constraint:_">constraint</option>
                      <option value="open_question:_">open question</option>
                      <option value="hypothesis:_">hypothesis</option>
                      <option value="principle:_">principle</option>
                      <option value="rejection:_">rejection</option>
                    </select>
                    <Button
                      className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                      disabled={isMutating}
                      onClick={() => handleReclassify(selectedNode)}
                      size="sm"
                      variant="outline"
                    >
                      Use
                    </Button>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--ir-border-default)] px-3 py-3">
              {selectedNode.status === "active" ? (
                <>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    onClick={() => openEdit("supersede")}
                    size="sm"
                    variant="outline"
                  >
                    <ShieldAlertIcon className="size-4" />
                    Supersede
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    disabled={isMutating}
                    onClick={() => handleCreateNextStep(selectedNode)}
                    size="sm"
                    variant="outline"
                  >
                    <PlusIcon className="size-4" />
                    Create next step
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    onClick={() =>
                      queueReferenceDraft(
                        `> [${selectedNode.id}] ${selectedNode.title}\n> ${selectedNode.content ?? selectedNode.title}`
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <MessageSquareTextIcon className="size-4" />
                    Ask AI
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    onClick={() => handleBringToSandbox(selectedNode)}
                    size="sm"
                    variant="outline"
                  >
                    <ArrowDownToLineIcon className="size-4" />
                    Bring to sandbox
                  </Button>
                </>
              ) : null}

              {selectedNode.status === "pending" ? (
                <>
                  {detail?.edges.some(
                    (edge: IREdge) =>
                      edge.fromNode === selectedNode.id &&
                      edge.relation === "supersedes"
                  ) ? (
                    <div className="flex w-full items-start gap-2 border border-[var(--ir-warning-stripe)] bg-[var(--ir-warning-bg)] px-2 py-2 text-xs text-[var(--ir-warning-fg)]">
                      <ShieldAlertIcon className="mt-0.5 size-3.5" />
                      Confirming this will mark an older truth as superseded.
                    </div>
                  ) : null}
                  <Button
                    className="rounded border-[var(--ir-accent-blue-border)] bg-transparent text-[var(--ir-accent-blue)] hover:bg-[var(--ir-bg-hover)]"
                    disabled={isMutating}
                    onClick={() =>
                      runMutation(
                        () =>
                          postJSON<IRDetail>(
                            `/api/ir/${selectedNode.id}/confirm`
                          ),
                        "Candidate confirmed."
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <CheckIcon className="size-4" />
                    Confirm
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    onClick={() => openEdit("confirm")}
                    size="sm"
                    variant="outline"
                  >
                    <PencilIcon className="size-4" />
                    Edit & Confirm
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    disabled={isMutating}
                    onClick={() =>
                      runMutation(
                        () => postJSON(`/api/ir/${selectedNode.id}/dismiss`),
                        "Candidate ignored."
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    Ignore
                  </Button>
                </>
              ) : null}

              {selectedNode.status === "idea" ? (
                <>
                  <Button
                    className="rounded border-[var(--ir-accent-blue-border)] bg-transparent text-[var(--ir-accent-blue)] hover:bg-[var(--ir-bg-hover)]"
                    disabled={isMutating}
                    onClick={() =>
                      runMutation(
                        () => postJSON(`/api/ir/${selectedNode.id}/promote`),
                        "Idea promoted."
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <CircleDotIcon className="size-4" />
                    Promote
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    disabled={isMutating}
                    onClick={() =>
                      runMutation(
                        () => postJSON(`/api/ir/${selectedNode.id}/dismiss`),
                        "Idea dismissed."
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    Dismiss
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    onClick={() => handleBringToSandbox(selectedNode)}
                    size="sm"
                    variant="outline"
                  >
                    Bring to sandbox
                  </Button>
                </>
              ) : null}

              {selectedNode.status === "superseded" ? (
                <>
                  <Button disabled size="sm" variant="outline">
                    Restore
                  </Button>
                  <Button
                    className="rounded border-[var(--ir-border-strong)] bg-transparent hover:bg-[var(--ir-bg-hover)]"
                    onClick={() => handleBringToSandbox(selectedNode)}
                    size="sm"
                    variant="outline"
                  >
                    Bring to sandbox
                  </Button>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center px-4 text-sm text-[var(--ir-text-tertiary)]">
            <p className="font-medium text-[var(--ir-text-primary)]">Detail</p>
            <p>Select an idea, candidate, truth node, or inline reference.</p>
          </div>
        )}
      </div>

      <Dialog
        onOpenChange={(open) => !open && setEditMode(null)}
        open={Boolean(editMode)}
      >
        <DialogContent className="rounded-lg border border-[var(--ir-border-default)] bg-[var(--ir-bg-panel)]">
          <DialogHeader>
            <DialogTitle>
              {editMode === "supersede"
                ? "Draft replacement"
                : "Edit and confirm"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              className="rounded border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] focus-visible:ring-0"
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Title"
              value={draftTitle}
            />
            <Textarea
              className="min-h-28 rounded border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] focus-visible:ring-0"
              onChange={(event) => setDraftContent(event.target.value)}
              placeholder="Content"
              value={draftContent}
            />
            <Textarea
              className="min-h-20 rounded border-[var(--ir-border-default)] bg-[var(--ir-bg-elevated)] focus-visible:ring-0"
              onChange={(event) => setDraftRationale(event.target.value)}
              placeholder="Rationale"
              value={draftRationale}
            />
          </div>
          <DialogFooter>
            <Button
              className="rounded border-[var(--ir-accent-blue-border)] bg-transparent text-[var(--ir-accent-blue)] hover:bg-[var(--ir-bg-hover)]"
              disabled={isMutating}
              onClick={submitEditDialog}
              variant="outline"
            >
              {editMode === "supersede" ? "Draft candidate" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
