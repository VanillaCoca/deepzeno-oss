"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { CandidatePool } from "@/components/candidate-pool";
import { DecisionDetail } from "@/components/decision-detail";
import { DecisionTree } from "@/components/decision-tree";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  createClient as createSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { fetcher } from "@/lib/utils";
import type { WorkspaceTruthSnapshot } from "@/lib/workspace/types";

export function TruthPanel() {
  const {
    activeTopicId,
    selectedDecisionId,
    setSelectedDecisionId,
    setPendingCount,
  } = useWorkspace();

  const { data, mutate, isLoading } = useSWR<WorkspaceTruthSnapshot>(
    activeTopicId
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/workspace/decisions?topicId=${activeTopicId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: activeTopicId ? 4000 : 0,
    }
  );

  useEffect(() => {
    if (!activeTopicId || !data) {
      return;
    }

    setPendingCount(activeTopicId, data.pendingCandidates.length);
  }, [activeTopicId, data, setPendingCount]);

  useEffect(() => {
    if (!activeTopicId || !isSupabaseConfigured()) {
      return;
    }

    const supabase = createSupabaseClient();
    const channel = supabase
      .channel(`truth-panel:${activeTopicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidate_decisions",
          filter: `topic_id=eq.${activeTopicId}`,
        },
        () => {
          mutate().catch(console.error);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "decisions",
          filter: `topic_id=eq.${activeTopicId}`,
        },
        () => {
          mutate().catch(console.error);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "edges",
          filter: `topic_id=eq.${activeTopicId}`,
        },
        () => {
          mutate().catch(console.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [activeTopicId, mutate]);

  const selectedDecision =
    data?.decisions.find((decision) => decision.id === selectedDecisionId) ??
    null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden p-4">
        <CandidatePool
          candidates={data?.pendingCandidates ?? []}
          isLoading={isLoading}
          onUpdated={(next) => mutate(next, false)}
          topicId={activeTopicId}
        />

        <DecisionTree
          decisions={data?.decisions ?? []}
          edges={data?.edges ?? []}
          isLoading={isLoading}
        />
      </div>

      <DecisionDetail
        decision={selectedDecision}
        decisions={data?.decisions ?? []}
        edges={data?.edges ?? []}
        onClose={() => setSelectedDecisionId(null)}
      />
    </div>
  );
}
