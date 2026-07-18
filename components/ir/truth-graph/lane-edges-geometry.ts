// Pure geometry for the semantic-lanes quiet dependency edges (rules
// amendment №2). No React, no DOM — node:test covers it directly.
//
// The overview keeps its "position carries structure" layout; these edges are
// a bounded exception to v1 §1.1 (no lines by default): only depends_on /
// implies edges between two visible top-level rows of the same topic are
// routed as quiet orthogonal lines through the left gutter (v1 §4.4 —
// independent vertical channels, short spans on the inner tracks, rounded
// corners, arrowhead entering the child row).

export type LaneRowBox = {
  id: string;
  // Container-relative box of the rendered row/card for this node.
  top: number;
  height: number;
  left: number;
};

export type LaneEdgeInput = {
  id: string;
  // Graph parent = the premise / earlier event the child builds on.
  parentId: string;
  childId: string;
};

export type LaneEdgePath = {
  edgeId: string;
  parentId: string;
  childId: string;
  // SVG path from the parent row's left edge, through a gutter channel, to
  // the arrow base just left of the child row.
  path: string;
  // Arrow tip (points right, into the child row).
  arrow: { x: number; y: number };
  // Anchor for the hover label pill (just above the entry, inside content).
  labelAt: { x: number; y: number };
  // 1-based convergence number when the child has ≥2 drawn in-edges
  // (v1 §5.3 — parallel premises get ①②); null for single entries.
  entryIndex: number | null;
  entryCount: number;
  channel: number;
};

export type LaneEdgeGeometryOptions = {
  // Width of the reserved left gutter the channels live in.
  gutterWidth: number;
  // Horizontal distance between adjacent vertical channels.
  channelGap: number;
  cornerRadius: number;
  // Vertical spread between multiple edges entering (or leaving) one row.
  entrySpread: number;
  arrowLength: number;
};

const CHANNEL_OVERLAP_PAD = 4;
const ROW_EDGE_INSET = 2;

type PlacedEdge = {
  edge: LaneEdgeInput;
  startY: number;
  entryY: number;
  startX: number;
  endX: number;
  entryIndex: number | null;
  entryCount: number;
};

// Spread N attachment points around a row's vertical center so several edges
// touching one row never overlap. Clamped inside the row.
function attachmentY(
  box: LaneRowBox,
  index: number,
  count: number,
  spread: number
) {
  const center = box.top + box.height / 2;
  const maxSpan = Math.max(box.height - 8, 0);
  const step = count > 1 ? Math.min(spread, maxSpan / (count - 1)) : 0;
  return center + (index - (count - 1) / 2) * step;
}

function roundedOrthogonalPath(
  startX: number,
  startY: number,
  channelX: number,
  entryY: number,
  endX: number,
  cornerRadius: number
): string {
  const dir = entryY >= startY ? 1 : -1;
  const r = Math.min(
    cornerRadius,
    Math.abs(entryY - startY) / 2,
    Math.max((startX - channelX) / 2, 0)
  );

  if (r < 0.5) {
    // Degenerate (near-horizontal) — a straight connector reads better than
    // a zero-radius zigzag.
    return `M ${startX} ${startY} L ${endX} ${entryY}`;
  }

  return [
    `M ${startX} ${startY}`,
    `L ${channelX + r} ${startY}`,
    `Q ${channelX} ${startY} ${channelX} ${startY + dir * r}`,
    `L ${channelX} ${entryY - dir * r}`,
    `Q ${channelX} ${entryY} ${channelX + r} ${entryY}`,
    `L ${endX} ${entryY}`,
  ].join(" ");
}

export function computeLaneEdgePaths({
  rows,
  edges,
  options,
}: {
  rows: LaneRowBox[];
  edges: LaneEdgeInput[];
  options: LaneEdgeGeometryOptions;
}): LaneEdgePath[] {
  const boxById = new Map(rows.map((row) => [row.id, row]));

  // Only edges whose two endpoints are actually rendered (a collapsed
  // <details> reports zero-height boxes and drops out here).
  const drawable = edges.filter((edge) => {
    const parent = boxById.get(edge.parentId);
    const child = boxById.get(edge.childId);
    return (
      parent !== undefined &&
      child !== undefined &&
      parent.height > 0 &&
      child.height > 0 &&
      edge.parentId !== edge.childId
    );
  });

  // Group by child (for convergence numbering + entry spreading) and by
  // parent (for exit spreading). Orders follow the rows' vertical order so
  // ①② read top-to-bottom.
  const byChild = new Map<string, LaneEdgeInput[]>();
  const byParent = new Map<string, LaneEdgeInput[]>();
  for (const edge of drawable) {
    byChild.set(edge.childId, [...(byChild.get(edge.childId) ?? []), edge]);
    byParent.set(edge.parentId, [
      ...(byParent.get(edge.parentId) ?? []),
      edge,
    ]);
  }
  const topOf = (id: string) => boxById.get(id)?.top ?? 0;
  for (const list of byChild.values()) {
    list.sort((a, b) => topOf(a.parentId) - topOf(b.parentId));
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => topOf(a.childId) - topOf(b.childId));
  }

  const placed: PlacedEdge[] = drawable.map((edge) => {
    const parentBox = boxById.get(edge.parentId) as LaneRowBox;
    const childBox = boxById.get(edge.childId) as LaneRowBox;
    const entrySiblings = byChild.get(edge.childId) ?? [];
    const exitSiblings = byParent.get(edge.parentId) ?? [];
    const entryCount = entrySiblings.length;
    const entryOrder = entrySiblings.indexOf(edge);
    const exitOrder = exitSiblings.indexOf(edge);

    return {
      edge,
      startY: attachmentY(
        parentBox,
        exitOrder,
        exitSiblings.length,
        options.entrySpread
      ),
      entryY: attachmentY(childBox, entryOrder, entryCount, options.entrySpread),
      startX: parentBox.left - ROW_EDGE_INSET,
      endX: childBox.left - ROW_EDGE_INSET,
      entryIndex: entryCount >= 2 ? entryOrder + 1 : null,
      entryCount,
    };
  });

  // Channel assignment (v1 §4.4): shortest spans claim the innermost tracks;
  // a track is reusable when the vertical intervals don't overlap.
  const sorted = [...placed].sort(
    (a, b) =>
      Math.abs(a.entryY - a.startY) - Math.abs(b.entryY - b.startY) ||
      a.edge.id.localeCompare(b.edge.id)
  );
  const channels: [number, number][][] = [];
  const channelByEdgeId = new Map<string, number>();

  for (const item of sorted) {
    const lo =
      Math.min(item.startY, item.entryY) - CHANNEL_OVERLAP_PAD;
    const hi = Math.max(item.startY, item.entryY) + CHANNEL_OVERLAP_PAD;
    let channel = channels.findIndex((intervals) =>
      intervals.every(([a, b]) => hi < a || lo > b)
    );
    if (channel === -1) {
      channel = channels.length;
      channels.push([]);
    }
    channels[channel].push([lo, hi]);
    channelByEdgeId.set(item.edge.id, channel);
  }

  const maxChannels = Math.max(
    Math.floor((options.gutterWidth - 8) / options.channelGap),
    1
  );

  return placed.map((item) => {
    const channel = Math.min(
      channelByEdgeId.get(item.edge.id) ?? 0,
      maxChannels - 1
    );
    // Innermost channel sits just inside the gutter's right edge; deeper
    // channels step left toward the container edge.
    const channelX = Math.max(
      options.gutterWidth - 6 - channel * options.channelGap,
      3
    );
    const arrowBaseX = item.endX - options.arrowLength;

    return {
      edgeId: item.edge.id,
      parentId: item.edge.parentId,
      childId: item.edge.childId,
      path: roundedOrthogonalPath(
        item.startX,
        item.startY,
        channelX,
        item.entryY,
        arrowBaseX,
        options.cornerRadius
      ),
      arrow: { x: item.endX, y: item.entryY },
      labelAt: { x: item.endX + 4, y: item.entryY - 12 },
      entryIndex: item.entryIndex,
      entryCount: item.entryCount,
      channel,
    };
  });
}
