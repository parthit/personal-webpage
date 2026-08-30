"use client";

import { useCallback, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** One-line explanation of what picking this option does. */
  hint?: string;
};

/**
 * Single-choice control for demo modes (sync vs async, LWW vs union merge…).
 *
 * Modes are deliberately not rendered as `Button`s: a filled Button already
 * means "primary action" in these figures, so a filled/outlined pair reads as
 * two actions rather than one selected state. A grooved track with a sliding
 * thumb makes the current choice obvious at a glance, and radiogroup semantics
 * give keyboard users arrow-key selection.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  hint,
  orientation = "stacked",
  size = "md",
  className,
  "data-testid": testId,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  /** Show the selected option's hint under the track. */
  hint?: boolean;
  /** `stacked` puts the label above the track, `inline` beside it. */
  orientation?: "stacked" | "inline";
  size?: "sm" | "md";
  className?: string;
  "data-testid"?: string;
}) {
  const labelId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const selected = options[selectedIndex];

  const focusOption = useCallback((index: number) => {
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
      "[data-segmented-option]"
    );
    buttons?.[index]?.focus();
  }, []);

  const move = useCallback(
    (nextIndex: number) => {
      const wrapped = (nextIndex + options.length) % options.length;
      onValueChange(options[wrapped].value);
      focusOption(wrapped);
    },
    [focusOption, onValueChange, options]
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(selectedIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(selectedIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      className={cn(
        "flex min-w-0 gap-1.5",
        orientation === "inline"
          ? "flex-row flex-wrap items-center gap-x-2.5"
          : "flex-col",
        className
      )}
      data-segmented-control={testId ?? label}
      data-segmented-value={value}
    >
      <span
        id={labelId}
        className="text-xs font-medium text-gray-600 dark:text-gray-400"
      >
        {label}
      </span>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className={cn(
          "relative grid w-fit max-w-full gap-0 rounded-lg bg-gray-200/80 dark:bg-gray-800",
          size === "sm" ? "p-0.5" : "p-1",
          disabled && "opacity-60"
        )}
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        <span
          aria-hidden="true"
          data-segmented-thumb
          className={cn(
            "pointer-events-none absolute rounded-md border border-gray-300 bg-white shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out dark:border-gray-600 dark:bg-gray-950",
            size === "sm" ? "inset-y-0.5 left-0.5" : "inset-y-1 left-1"
          )}
          style={{
            width: `calc((100% - ${size === "sm" ? "0.25rem" : "0.5rem"}) / ${options.length})`,
            transform: `translateX(calc(${selectedIndex} * 100%))`,
          }}
        />
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              data-segmented-option={option.value}
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              disabled={disabled}
              onClick={() => onValueChange(option.value)}
              className={cn(
                "relative z-10 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-gray-200 disabled:cursor-not-allowed dark:focus-visible:ring-offset-gray-800",
                size === "sm"
                  ? "px-2 py-1 text-[11px] tabular-nums"
                  : "px-3 py-1.5 text-xs",
                isSelected
                  ? "text-gray-900 dark:text-gray-50"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p
          className="text-xs leading-relaxed text-gray-500 dark:text-gray-400"
          data-segmented-hint
        >
          {selected?.hint}
        </p>
      ) : null}
    </div>
  );
}
