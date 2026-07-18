"use client";

// Quiet dependency edges over the semantic-lanes overview (rules amendment
// №2). An absolutely-positioned SVG inside the lanes container draws
// orthogonal arrows from each premise / earlier event to the rows that build
// on it — visible without selecting anything, quiet enough to never read as a
// hairball: gutter channels, --z-line strokes, labels only on hover or when
// the edge belongs to the selected chain.

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  QUIET_EDGE_RELATIONS,
  relationKey,
  type TruthGraphModel,
} from "./data";
import {
  computeLaneEdgePaths,
  type LaneEdgeInput,
  type LaneRowBox,
} from "./lane-edges-geometry";

export type LaneEdgesOverlayProps = {
  chainNodeIds: Set<string>;
  containerRef: RefObject<HTMLDivElement | null>;
  hoveredNodeId: string | null;
  // Bumped by the lanes on fold toggles — layout changes the container's
  // ResizeObserver can miss (e.g. equal-height swaps) still re-measure.
  layoutVersion: number;
  model: TruthGraphModel;
  selectedNodeId: string | null;
};

// Geometry knobs mirror the CSS tokens (--z-lane-gutter / --z-lane-channel-gap
// / --z-corner-radius). Kept as numbers because SVG path math cannot read CSS
// variables; the tokens file documents them as the source of truth.
const GEOMETRY = {
  gutterWidth: 40,
  channelGap: 9,
  cornerRadius: 6,
  entrySpread: 8,
  arrowLength: 5,
};

const ARROW_HALF_HEIGHT = 3;
const LABEL_HEIGHT = 16;
const CJK_PATTERN = /[　-鿿豈-﫿]/;

// Width estimate for the hover label pill (10.5px font): CJK glyphs are
// roughly square, latin runs much narrower.
function labelPillWidth(label: string) {
  let width = 12;
  for (const char of label) {
    width += CJK_PATTERN.test(char) ? 11 : 6.5;
  }
  return width;
}

type MeasuredRows = {
  rows: LaneRowBox[];
  height: number;
  width: number;
  signature: string;
};

function measureRows(container: HTMLDivElement): MeasuredRows {
  const containerRect = container.getBoundingClientRect();
  const rows: LaneRowBox[] = [];

  for (const element of container.querySelectorAll<HTMLElement>(
    '[data-testid^="truth-graph-node-"]'
  )) {
    const id = element.dataset.testid?.slice("truth-graph-node-".length);
    if (!id) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    // Hidden endpoints (inside a collapsed <details>) are not drawable.
    // checkVisibility catches Chrome's content-visibility-hidden fold
    // contents, whose rects still report their last layout size.
    const hidden =
      typeof element.checkVisibility === "function"
        ? !element.checkVisibility()
        : rect.height === 0;
    if (hidden || rect.height === 0) {
      continue;
    }
    rows.push({
      id,
      top: rect.top - containerRect.top,
      height: rect.height,
      left: rect.left - containerRect.left,
    });
  }

  return {
    rows,
    height: container.scrollHeight,
    width: container.clientWidth,
    signature: rows
      .map(
        (row) =>
          `${row.id}:${Math.round(row.top)}:${Math.round(row.left)}:${Math.round(row.height)}`
      )
      .join("|"),
  };
}

export function LaneEdgesOverlay({
  chainNodeIds,
  containerRef,
  hoveredNodeId,
  layoutVersion,
  model,
  selectedNodeId,
}: LaneEdgesOverlayProps) {
  const { t } = useLocale();
  const [measured, setMeasured] = useState<MeasuredRows | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Only same-topic prerequisite/sequence edges between top-level nodes draw
  // (amendment №2 scope). Sub-nodes and cross-topic edges never do.
  const quietEdges = useMemo(() => {
    const edges: LaneEdgeInput[] = [];
    for (const flowEdge of model.flowEdges) {
      if (!QUIET_EDGE_RELATIONS.has(flowEdge.edge.relation)) {
        continue;
      }
      const parent = model.nodeById.get(flowEdge.parentId);
      const child = model.nodeById.get(flowEdge.childId);
      if (!(parent && child) || parent.parentId || child.parentId) {
        continue;
      }
      if ((parent.topicId ?? null) !== (child.topicId ?? null)) {
        continue;
      }
      edges.push({
        id: flowEdge.id,
        parentId: flowEdge.parentId,
        childId: flowEdge.childId,
      });
    }
    return edges;
  }, [model]);

  const flowEdgeById = useMemo(
    () => new Map(model.flowEdges.map((flowEdge) => [flowEdge.id, flowEdge])),
    [model]
  );

  const remeasure = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const next = measureRows(container);
    setMeasured((prev) =>
      prev &&
      prev.signature === next.signature &&
      prev.height === next.height &&
      prev.width === next.width
        ? prev
        : next
    );
  }, [containerRef]);

  // Re-measure after every commit of the lanes (row set / order / fold state
  // changes all flow through React renders), plus on any container resize
  // (fonts, viewport, drawer). rAF-throttled so observer bursts cost one pass.
  useEffect(() => {
    remeasure();
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(remeasure);
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef, remeasure]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a data change (new/removed edges) or a fold toggle must trigger a measurement pass even when the container itself did not resize.
  useEffect(() => {
    remeasure();
  }, [quietEdges, layoutVersion, remeasure]);

  const paths = useMemo(() => {
    if (!measured || quietEdges.length === 0) {
      return [];
    }
    return computeLaneEdgePaths({
      rows: measured.rows,
      edges: quietEdges,
      options: GEOMETRY,
    });
  }, [measured, quietEdges]);

  if (paths.length === 0) {
    return null;
  }

  const hasSelection = Boolean(selectedNodeId);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      data-testid="truth-graph-lane-edges"
      height={measured?.height}
      style={{ overflow: "visible" }}
      width={measured?.width}
    >
      {paths.map((path) => {
        const parentNode = model.nodeById.get(path.parentId);
        const flowEdge = flowEdgeById.get(path.edgeId);
        const onChain =
          chainNodeIds.has(path.parentId) && chainNodeIds.has(path.childId);
        const isHovered =
          hoveredEdgeId === path.edgeId ||
          hoveredNodeId === path.parentId ||
          hoveredNodeId === path.childId;
        const active = isHovered || (hasSelection && onChain);
        const dimmed = hasSelection && !onChain && !isHovered;
        // A hypothesis premise is by nature unsettled → dashed (v1 §4.3);
        // sequence/constraint dependencies stay solid.
        const dashed = parentNode?.kind === "hypothesis";
        const stroke = active ? "var(--z-arrow)" : "var(--z-line)";
        const customLabel = flowEdge?.edge.label?.trim();
        const fallbackKey = flowEdge ? relationKey(flowEdge.edge.relation) : null;
        const label = customLabel || (fallbackKey ? t(fallbackKey) : null);
        const badgeX = path.arrow.x - GEOMETRY.arrowLength - 8;

        return (
          <g
            key={path.edgeId}
            style={{
              opacity: dimmed ? "var(--z-focus-edge-faint)" : 1,
              transition: "opacity var(--z-transition)",
            }}
          >
            <path
              className={dashed ? "z-lane-edge-fade" : "z-lane-edge-draw"}
              d={path.path}
              fill="none"
              pathLength={dashed ? undefined : 1}
              stroke={stroke}
              style={{
                strokeDasharray: dashed ? "var(--z-dash)" : undefined,
                strokeWidth: "var(--z-line-w)",
                transition: "stroke var(--z-transition)",
              }}
            />
            <polygon
              fill={stroke}
              points={`${path.arrow.x},${path.arrow.y} ${path.arrow.x - GEOMETRY.arrowLength},${path.arrow.y - ARROW_HALF_HEIGHT} ${path.arrow.x - GEOMETRY.arrowLength},${path.arrow.y + ARROW_HALF_HEIGHT}`}
              style={{ transition: "fill var(--z-transition)" }}
            />
            {path.entryIndex !== null ? (
              // Convergence numbering (v1 §5.3): parallel premises entering
              // one node read ①② top-to-bottom — visible without selection.
              <g>
                <circle
                  cx={badgeX}
                  cy={path.arrow.y}
                  fill="var(--z-edge-label-bg)"
                  r={6}
                  stroke={stroke}
                  style={{
                    strokeWidth: "var(--z-line-w)",
                    transition: "stroke var(--z-transition)",
                  }}
                />
                <text
                  fill={active ? "var(--z-edge-label)" : "var(--z-text-3)"}
                  style={{ fontSize: "var(--z-font-badge)" }}
                  textAnchor="middle"
                  x={badgeX}
                  y={path.arrow.y + 3.5}
                >
                  {path.entryIndex}
                </text>
              </g>
            ) : null}
            {label && active ? (
              <g>
                <rect
                  fill="var(--z-edge-label-bg)"
                  height={LABEL_HEIGHT}
                  rx={4}
                  stroke="var(--z-line)"
                  style={{ strokeWidth: 0.5 }}
                  width={labelPillWidth(label)}
                  x={path.labelAt.x}
                  y={path.labelAt.y - LABEL_HEIGHT + 4}
                />
                <text
                  fill="var(--z-edge-label)"
                  style={{ fontSize: "var(--z-font-edge)" }}
                  x={path.labelAt.x + 6}
                  y={path.labelAt.y}
                >
                  {label}
                </text>
              </g>
            ) : null}
            {/* Invisible wide twin — the hover target for the edge itself. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only affordance that reveals the edge label; the relationship stays reachable via the chain card for keyboard users. */}
            <path
              className="pointer-events-auto"
              d={path.path}
              fill="none"
              onMouseEnter={() => setHoveredEdgeId(path.edgeId)}
              onMouseLeave={() =>
                setHoveredEdgeId((prev) => (prev === path.edgeId ? null : prev))
              }
              stroke="transparent"
              strokeWidth={10}
            />
          </g>
        );
      })}
    </svg>
  );
}
