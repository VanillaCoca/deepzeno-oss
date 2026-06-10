/**
 * ZENO brand mark.
 *
 * Rendered as a CSS mask over `currentColor` so a SINGLE asset serves both
 * themes: set the text color on the element (we use `text-sidebar-foreground`)
 * and the mark is black in light mode / white in dark mode — no second asset.
 *
 * The mask is the clean vector silhouette `public/zeno-logo.svg` (a single
 * filled path on a transparent background, so its alpha is the shape). Being a
 * vector it stays crisp at any size and has no cut-out artifacts. To change the
 * logo, drop in a new silhouette SVG (filled shape, transparent background) —
 * the component wiring below never changes.
 */
const MASK_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/zeno-logo.svg`;

export function ZenoLogo({ className }: { className?: string }) {
  return (
    <span
      aria-label="ZENO"
      className={className}
      role="img"
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url("${MASK_URL}")`,
        maskImage: `url("${MASK_URL}")`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
