"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type ViewportNode = { id: string; x: number; width: number };

/**
 * Horizontal viewport for the B-tree SVG panes.
 *
 * Two jobs: start centered (the root sits at the middle of a wide tree, so a
 * scroller left at 0 hides it), and keep the node the animation is visiting on
 * screen. Scrolling is instant on purpose — smooth scrolling competes with the
 * step clock and reads as jank.
 */
export function useTreeViewport({
  layoutWidth,
  nodes,
  focusNodeId,
}: {
  layoutWidth: number;
  nodes: ViewportNode[];
  focusNodeId?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const centeredWidthRef = useRef<number | null>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, ViewportNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const center = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const overflow = scroller.scrollWidth - scroller.clientWidth;
    if (overflow <= 0) return;
    scroller.scrollLeft = overflow / 2;
  }, []);

  useEffect(() => {
    if (centeredWidthRef.current === layoutWidth) return;
    centeredWidthRef.current = layoutWidth;
    // Mid-walk the focus effect below owns the scroll position.
    if (focusNodeId) return;
    center();
  }, [center, focusNodeId, layoutWidth]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !focusNodeId) return;
    const node = nodeById.get(focusNodeId);
    if (!node) return;

    const pad = 28;
    const left = node.x - node.width / 2 - pad;
    const right = node.x + node.width / 2 + pad;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;

    if (left < viewLeft) {
      scroller.scrollLeft = Math.max(0, left);
    } else if (right > viewRight) {
      scroller.scrollLeft = Math.max(0, right - scroller.clientWidth);
    }
  }, [focusNodeId, nodeById]);

  return scrollRef;
}
