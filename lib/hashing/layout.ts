import { RING_SIZE, clockwiseDelta } from "./model";

export const RING_LAYOUT = {
  size: 420,
  cx: 210,
  cy: 210,
  tokenR: 156,
  keyR: 122,
  walkR: 139,
} as const;

export type Point = { x: number; y: number };

/** 0 is the top of the circle; increasing position walks clockwise. */
export function angleFor(position: number, ringSize = RING_SIZE): number {
  return (position / ringSize) * Math.PI * 2 - Math.PI / 2;
}

export function polar(
  position: number,
  radius: number,
  cx = RING_LAYOUT.cx,
  cy = RING_LAYOUT.cy,
  ringSize = RING_SIZE
): Point {
  const angle = angleFor(position, ringSize);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

/**
 * SVG arc from `from` toward `to` clockwise, possibly partial via `progress`.
 * Sweep flag 1 is clockwise in SVG user space (y grows downward).
 */
export function clockwiseArcPath(
  from: number,
  to: number,
  radius: number,
  progress = 1,
  cx = RING_LAYOUT.cx,
  cy = RING_LAYOUT.cy,
  ringSize = RING_SIZE
): string | null {
  const end = ((from + clockwiseDelta(from, to, ringSize) * progress) % ringSize + ringSize) % ringSize;
  const travelled = clockwiseDelta(from, end, ringSize);
  if (travelled < 0.5 && progress < 1) return null;
  if (travelled < 0.5 && from !== to) {
    // Landed on the same slot after wrapping a full ring.
  }
  const startPt = polar(from, radius, cx, cy, ringSize);
  const endPt = polar(end, radius, cx, cy, ringSize);
  if (Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y) < 0.75) {
    return null;
  }
  const large = travelled > ringSize / 2 ? 1 : 0;
  return `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;
}
