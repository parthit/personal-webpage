"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

type Edges = { overflowing: boolean; atStart: boolean; atEnd: boolean };

const NONE: Edges = { overflowing: false, atStart: true, atEnd: true };

/**
 * Diagrams are often wider than the writing column, so they scroll sideways.
 * A cropped node with no affordance reads as a rendering bug, so track which
 * edges have content hidden behind them.
 */
export function useOverflowEdges(
  ref: RefObject<HTMLElement | null>,
  revision?: unknown
): Edges {
  const [edges, setEdges] = useState<Edges>(NONE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({
        overflowing: max > 1,
        atStart: el.scrollLeft <= 1,
        atEnd: el.scrollLeft >= max - 1,
      });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [ref, revision]);

  return edges;
}

export function ScrollableFigure({
  scrollRef,
  revision,
  className,
  fadeClassName = "from-gray-50 dark:from-gray-900",
  label,
  children,
  ...rest
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Changes when the content width changes, forcing a re-measure. */
  revision?: unknown;
  className?: string;
  /** Gradient start colour; should match the surrounding surface. */
  fadeClassName?: string;
  /** Announced hint shown while content is hidden off-screen. */
  label?: string;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const edges = useOverflowEdges(scrollRef, revision);

  return (
    <div className="min-w-0">
      <div className="relative min-w-0">
        <div
          ref={scrollRef}
          className={cn(
            "min-w-0 w-full overflow-x-auto overscroll-x-contain touch-pan-x",
            className
          )}
          data-scroll-overflowing={edges.overflowing ? "true" : "false"}
          {...rest}
        >
          {children}
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-px left-px w-8 bg-gradient-to-r to-transparent transition-opacity duration-200",
            fadeClassName,
            edges.overflowing && !edges.atStart ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-px right-px w-8 bg-gradient-to-l to-transparent transition-opacity duration-200",
            fadeClassName,
            edges.overflowing && !edges.atEnd ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
      {label && edges.overflowing ? (
        <p
          className="mt-1.5 text-center text-[11px] text-gray-400 dark:text-gray-500"
          data-scroll-hint
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
