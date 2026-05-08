"use client";

/**
 * TreeRow — single-row renderer for Truth Tree v1.3.
 * See docs/ir-ui-interaction-v1.3.md §2 for the visual grammar.
 *
 * One row format (monospace):
 *
 *   {ancestor_indents}{junction}{edge_glyph}  {status} {kind_glyph} {code:4}  {short_id:4}  {title}    {shadow_marker}
 *
 * Pure presentation — no state, no fetch. Click forwards to onSelect.
 */

import type { IREdge, IRKind, IRNode } from "@/lib/ir/types";
import { cn } from "@/lib/utils";
import {
  getEdgeColorVar,
  getEdgeGlyph,
  getKindCode,
  getKindColorVar,
  getKindGlyph,
  getStatusGlyph,
  STATUS_OPACITY,
} from "./glyphs";

export type TreeRowProps = {
  node: IRNode;
  /** Depth in the tree (0 = root). Used for indentation count. */
  depth: number;
  /**
   * For each ancestor level (0..depth-1), whether that ancestor still has
   * more siblings below. Used to draw `│` (true) or blank (false).
   * Length should equal depth.
   */
  ancestorHasMoreSiblings: boolean[];
  /** Whether this row is the last sibling under its parent. */
  isLastSibling: boolean;
  /** Edge from parent to this node (null for roots). */
  edgeFromParent: IREdge | null;
  /** Parent's kind, used for (relation × parent.kind) glyph specialization. */
  parentKind: IRKind | null;
  /** Total parent count for `↑N` marker (rendered if > 1). */
  totalParentCount: number;
  /** Primary parent's id for shadow rows' "(also under …)" note. */
  primaryParentShortId: string | null;
  /** True iff this row is a shadow rendering (under a non-primary parent). */
  isShadow: boolean;
  /** Currently selected node id from outer state. */
  selectedNodeId: string | null;
  /** Forwarded click handler. */
  onSelect: (nodeId: string) => void;
};

const INDENT_CELL = "inline-block w-3 text-center align-middle"; // 12px = w-3
const GLYPH_CELL = "inline-block w-3 text-center align-middle";

export function TreeRow({
  node,
  depth,
  ancestorHasMoreSiblings,
  isLastSibling,
  edgeFromParent,
  parentKind,
  totalParentCount,
  primaryParentShortId,
  isShadow,
  selectedNodeId,
  onSelect,
}: TreeRowProps) {
  const isSelected = selectedNodeId === node.id;
  const statusGlyph = getStatusGlyph(node.status);
  const kindGlyph = getKindGlyph(node.kind, node.subtype);
  const kindCode = getKindCode(node.kind, node.subtype);
  const kindColorVar = getKindColorVar(node.kind, node.subtype);

  const edgeGlyph = edgeFromParent
    ? getEdgeGlyph(edgeFromParent.relation, parentKind)
    : "";
  const edgeColorVar = edgeFromParent
    ? getEdgeColorVar(edgeFromParent.relation)
    : null;

  const shortId = node.id.padEnd(4);
  const opacity = isShadow ? 0.6 : (STATUS_OPACITY[node.status] ?? 1);

  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "group flex h-6 w-full items-center font-mono text-[13px] leading-none",
        "border-l-2 border-transparent",
        "hover:bg-[rgba(255,255,255,0.04)]",
        isSelected &&
          "border-l-[var(--ir-text-primary,#fff)] bg-transparent",
        node.status === "superseded" && "line-through"
      )}
      data-testid={`tree-row-${node.id}`}
      onClick={() => onSelect(node.id)}
      style={{ opacity }}
      type="button"
    >
      {/* Ancestor indent guides */}
      {ancestorHasMoreSiblings.map((hasMore, i) => (
        <span
          className={cn(INDENT_CELL, "text-[var(--ir-text-tertiary)]")}
          key={`anc-${i}`}
        >
          {hasMore ? "│" : " "}
        </span>
      ))}

      {/* Junction (├ or └) — only if this row has a parent */}
      {depth > 0 && (
        <span
          className={cn(INDENT_CELL, "text-[var(--ir-text-tertiary)]")}
        >
          {isLastSibling ? "└" : "├"}
        </span>
      )}

      {/* Edge connector glyph (relation × parent.kind specialization) */}
      {edgeGlyph && (
        <span
          className={GLYPH_CELL}
          style={
            edgeColorVar
              ? { color: `var(${edgeColorVar})` }
              : undefined
          }
        >
          {edgeGlyph}
        </span>
      )}

      {/* Spacing before status (1ch) */}
      <span className="inline-block w-2" />

      {/* Status glyph */}
      <span className={cn(GLYPH_CELL, "text-[var(--ir-text-primary)]")}>
        {statusGlyph}
      </span>

      <span className="inline-block w-1" />

      {/* Kind glyph */}
      <span
        className={GLYPH_CELL}
        style={kindColorVar ? { color: `var(${kindColorVar})` } : undefined}
      >
        {kindGlyph}
      </span>

      <span className="inline-block w-1" />

      {/* Kind code (4ch) */}
      <span className="inline-block w-[4ch] text-[var(--ir-text-tertiary)]">
        {kindCode}
      </span>

      <span className="inline-block w-2" />

      {/* Short id (4ch) */}
      <span className="inline-block w-[4ch] text-[var(--ir-text-secondary)]">
        {shortId}
      </span>

      <span className="inline-block w-2" />

      {/* Title — flex-grow, truncated */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left font-sans text-[var(--ir-text-primary)]",
          isShadow && "italic"
        )}
        title={node.title}
      >
        {node.title}
        {isShadow && primaryParentShortId && (
          <span className="ml-2 text-[var(--ir-text-tertiary)]">
            (also under {primaryParentShortId})
          </span>
        )}
      </span>

      {/* Trailing meta — multi-parent marker */}
      {totalParentCount > 1 && !isShadow && (
        <span className="ml-2 shrink-0 font-mono text-[11px] text-[var(--ir-text-tertiary)]">
          ↑{totalParentCount - 1}
        </span>
      )}
    </button>
  );
}
