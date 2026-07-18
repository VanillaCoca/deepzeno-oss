// Pure helpers — no server-only import so node:test can import this directly.
//
// Project-level research-agent settings, stored as nullable jsonb on
// projects.agent_settings. Parsing is defensive: unknown shapes fall back to
// defaults field-by-field, so a stale or hand-edited blob can never wedge the
// patrol scheduler.

export const PATROL_CADENCES = ["daily", "every_3_days", "weekly"] as const;

export type PatrolCadence = (typeof PATROL_CADENCES)[number];

export type AgentSettings = {
  // Master switch for autonomous patrols in this project.
  patrolEnabled: boolean;
  // Cadence applied to newly created watches (each watch keeps its own).
  defaultCadence: PatrolCadence;
  // Stored research-model preference; null = product default chain
  // (DeepSeek when configured — lib/research/model-preference.ts).
  researchModelId: string | null;
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  patrolEnabled: true,
  defaultCadence: "daily",
  researchModelId: null,
};

export function isPatrolCadence(value: unknown): value is PatrolCadence {
  return (
    typeof value === "string" &&
    (PATROL_CADENCES as readonly string[]).includes(value)
  );
}

export function parseAgentSettings(raw: unknown): AgentSettings {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_AGENT_SETTINGS };
  }
  const record = raw as Record<string, unknown>;
  return {
    patrolEnabled:
      typeof record.patrolEnabled === "boolean"
        ? record.patrolEnabled
        : DEFAULT_AGENT_SETTINGS.patrolEnabled,
    defaultCadence: isPatrolCadence(record.defaultCadence)
      ? record.defaultCadence
      : DEFAULT_AGENT_SETTINGS.defaultCadence,
    researchModelId:
      typeof record.researchModelId === "string" && record.researchModelId
        ? record.researchModelId
        : null,
  };
}
