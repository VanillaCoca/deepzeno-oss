import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeLaneEdgePaths,
  type LaneEdgeGeometryOptions,
  type LaneRowBox,
} from "../../components/ir/truth-graph/lane-edges-geometry.ts";

const OPTIONS: LaneEdgeGeometryOptions = {
  gutterWidth: 40,
  channelGap: 9,
  cornerRadius: 6,
  entrySpread: 8,
  arrowLength: 5,
};

function row(id: string, top: number, left = 40, height = 32): LaneRowBox {
  return { id, top, height, left };
}

describe("computeLaneEdgePaths", () => {
  it("drops edges whose endpoints are missing or collapsed (zero height)", () => {
    const paths = computeLaneEdgePaths({
      rows: [row("a", 0), { ...row("b", 100), height: 0 }],
      edges: [
        { id: "e1", parentId: "a", childId: "b" },
        { id: "e2", parentId: "a", childId: "missing" },
      ],
      options: OPTIONS,
    });
    assert.equal(paths.length, 0);
  });

  it("numbers convergence entries top-to-bottom when a child has ≥2 premises", () => {
    const paths = computeLaneEdgePaths({
      rows: [row("p-low", 200), row("p-high", 0), row("child", 400)],
      edges: [
        { id: "e-low", parentId: "p-low", childId: "child" },
        { id: "e-high", parentId: "p-high", childId: "child" },
      ],
      options: OPTIONS,
    });
    const byId = new Map(paths.map((p) => [p.edgeId, p]));
    // p-high sits above p-low, so its edge is ① regardless of input order.
    assert.equal(byId.get("e-high")?.entryIndex, 1);
    assert.equal(byId.get("e-low")?.entryIndex, 2);
    assert.equal(byId.get("e-high")?.entryCount, 2);
    // Entries are spread so the two arrows never overlap.
    assert.notEqual(byId.get("e-high")?.arrow.y, byId.get("e-low")?.arrow.y);
  });

  it("gives single-entry edges no convergence number", () => {
    const [path] = computeLaneEdgePaths({
      rows: [row("a", 0), row("b", 100)],
      edges: [{ id: "e1", parentId: "a", childId: "b" }],
      options: OPTIONS,
    });
    assert.equal(path.entryIndex, null);
    assert.equal(path.entryCount, 1);
  });

  it("routes short spans on inner channels and long spans further out", () => {
    // Two overlapping spans: a↦b (short) nests inside a↦c (long).
    const paths = computeLaneEdgePaths({
      rows: [row("a", 0), row("b", 80), row("c", 400)],
      edges: [
        { id: "long", parentId: "a", childId: "c" },
        { id: "short", parentId: "a", childId: "b" },
      ],
      options: OPTIONS,
    });
    const byId = new Map(paths.map((p) => [p.edgeId, p]));
    assert.equal(byId.get("short")?.channel, 0);
    assert.equal(byId.get("long")?.channel, 1);
  });

  it("reuses a channel when vertical intervals do not overlap", () => {
    const paths = computeLaneEdgePaths({
      rows: [row("a", 0), row("b", 60), row("c", 300), row("d", 360)],
      edges: [
        { id: "top", parentId: "a", childId: "b" },
        { id: "bottom", parentId: "c", childId: "d" },
      ],
      options: OPTIONS,
    });
    assert.ok(paths.every((p) => p.channel === 0));
  });

  it("emits an orthogonal path ending at the arrow base", () => {
    const [path] = computeLaneEdgePaths({
      rows: [row("a", 0), row("b", 200)],
      edges: [{ id: "e1", parentId: "a", childId: "b" }],
      options: OPTIONS,
    });
    assert.match(path.path, /^M 38 16/);
    // Ends left of the child row edge by arrowLength.
    assert.match(path.path, /L 33 216$/);
    assert.deepEqual(path.arrow, { x: 38, y: 216 });
  });

  it("draws upward edges (child above parent) without NaN coordinates", () => {
    const [path] = computeLaneEdgePaths({
      rows: [row("late", 300), row("early", 0)],
      edges: [{ id: "up", parentId: "late", childId: "early" }],
      options: OPTIONS,
    });
    assert.ok(!path.path.includes("NaN"));
    assert.ok(path.arrow.y < 300);
  });
});
