import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_AGENT_SETTINGS,
  parseAgentSettings,
} from "../../lib/research/agent-settings.ts";

describe("parseAgentSettings", () => {
  it("returns defaults for null / non-object blobs", () => {
    assert.deepEqual(parseAgentSettings(null), DEFAULT_AGENT_SETTINGS);
    assert.deepEqual(parseAgentSettings("junk"), DEFAULT_AGENT_SETTINGS);
    assert.deepEqual(parseAgentSettings(42), DEFAULT_AGENT_SETTINGS);
  });

  it("keeps valid fields and defaults invalid ones independently", () => {
    const parsed = parseAgentSettings({
      patrolEnabled: false,
      defaultCadence: "hourly", // invalid → default
      researchModelId: "deepseek:default",
    });
    assert.equal(parsed.patrolEnabled, false);
    assert.equal(parsed.defaultCadence, "daily");
    assert.equal(parsed.researchModelId, "deepseek:default");
  });

  it("normalizes empty model id to null (default chain)", () => {
    assert.equal(
      parseAgentSettings({ researchModelId: "" }).researchModelId,
      null
    );
  });

  it("accepts every documented cadence", () => {
    for (const cadence of ["daily", "every_3_days", "weekly"] as const) {
      assert.equal(
        parseAgentSettings({ defaultCadence: cadence }).defaultCadence,
        cadence
      );
    }
  });
});
