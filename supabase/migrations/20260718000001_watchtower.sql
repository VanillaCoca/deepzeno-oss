-- Watchtower V1 (autonomy ladder L3, spec 2026-06-10-watchtower-l3-design.md,
-- scoped slice): per-node watches Zeno patrols on a cadence, re-verifying the
-- external grounding of assumptions. Patrols are research runs (run_type =
-- 'patrol'); their alerts land as pending open_question candidates with
-- source_layer 'watchtower' — never truth writes (Iron Law 0/4).

-- 1. Admit the 'watchtower' source layer for ir_nodes.
alter table public.ir_nodes
  drop constraint if exists ir_nodes_source_layer_check;

alter table public.ir_nodes
  add constraint ir_nodes_source_layer_check
  check (source_layer in ('inline', 'sweep', 'manual', 'mcp', 'kickoff', 'research', 'watchtower'));

-- 2. Watches. One per node (no floating watches — E2-isomorphic). Pausing is
-- the off switch (no 'off' cadence: one field owns the on/off state).
create table public.ir_watches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  node_id text not null references public.ir_nodes (id) on delete cascade,
  origin text not null check (origin in ('zeno_suggested', 'user_requested')),
  -- Why Zeno (or the user) watches this — agenda transparency (§2d).
  reason text not null,
  cadence text not null default 'daily'
    check (cadence in ('daily', 'every_3_days', 'weekly')),
  status text not null default 'active'
    check (status in ('active', 'paused')),
  -- Per-watch model override; null = the project's research model setting.
  model_id text,
  last_patrol_at timestamptz,
  last_signal_at timestamptz,
  -- Alert scarcity bookkeeping (cooldown lives on the watch, weekly cap is
  -- counted from watchtower-sourced ir_nodes).
  last_alert_at timestamptz,
  next_due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (node_id)
);

create index ir_watches_due_idx
  on public.ir_watches (next_due_at)
  where status = 'active';
create index ir_watches_project_idx on public.ir_watches (project_id);

alter table public.ir_watches enable row level security;
alter table public.ir_watches force row level security;

create policy ir_watches_owner_read on public.ir_watches
  for select using (public.owns_project(project_id));

-- 3. Patrols are research runs.
alter table public.research_run
  add column if not exists run_type text not null default 'research'
    check (run_type in ('research', 'patrol')),
  add column if not exists watch_id uuid
    references public.ir_watches (id) on delete set null;

-- 4. Project-level research agent settings (patrol switch, default cadence,
-- research model). Nullable jsonb — parsed and defaulted in code.
alter table public.projects
  add column if not exists agent_settings jsonb;
