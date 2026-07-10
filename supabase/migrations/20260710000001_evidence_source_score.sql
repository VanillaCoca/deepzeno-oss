-- Source-reliability scoring (lib/research/source-score.ts): every evidence
-- row records the reliability prior of its source URL at collection time.
-- Nullable: rows collected before scoring landed have no score.

alter table public.evidence
  add column if not exists source_score real
  check (source_score is null or (source_score >= 0 and source_score <= 1));
