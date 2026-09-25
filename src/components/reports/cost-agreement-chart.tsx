"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn, EmptyState, Tooltip } from "@/components/ui";
import { formatUsd } from "@/lib/ai/provider-meta";
import type {
  CostAgreementChart as CostAgreementChartData,
  CostAgreementPoint,
} from "@/lib/submissions/reports";

import { ChartCard } from "./chart-card";
import { formatUsdTick, niceTicks, pluralize } from "./report-format";

const DEFAULT_WIDTH = 560;
const MARGIN = { bottom: 44, left: 44, right: 12, top: 28 };
const DOT_RADIUS = 5;
const HIT_SIZE = 24;
const LABEL_GAP = 14;
const LABEL_OFFSET = 9;
/** Approximate advance of a 12 px UI-font character, for collision checks. */
const CHAR_WIDTH = 6.8;

type LabelAnchor = "start" | "middle" | "end";

type PlacedLabel = {
  anchor: LabelAnchor;
  /** True when the label sits away from its dot and needs a leader line. */
  leader: boolean;
  point: CostAgreementPoint;
  px: number;
  py: number;
  width: number;
  x: number;
  y: number;
};

function useElementWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const update = () => {
      const next = Math.round(element.getBoundingClientRect().width);

      if (next > 0) {
        setWidth(next);
      }
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/**
 * Places each direct label at the first candidate position (right, left,
 * above, below, then further out with a leader line) that stays inside the
 * chart and clears every dot and every label placed so far. The default
 * model is placed first so it gets the best spot. Labels end up at least
 * 14 px apart vertically whenever they share horizontal space.
 */
function placeLabels(
  points: Array<{ point: CostAgreementPoint; px: number; py: number }>,
  bounds: { bottom: number; left: number; right: number; top: number },
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const ordered = [...points].sort(
    (left, right) =>
      Number(right.point.isDefault) - Number(left.point.isDefault) || left.py - right.py,
  );
  const half = LABEL_GAP / 2;

  const boxOf = (label: Pick<PlacedLabel, "anchor" | "width" | "x" | "y">) => {
    const left =
      label.anchor === "start"
        ? label.x
        : label.anchor === "end"
          ? label.x - label.width
          : label.x - label.width / 2;

    return { bottom: label.y + half, left, right: left + label.width, top: label.y - half };
  };

  for (const entry of ordered) {
    const width = entry.point.label.length * CHAR_WIDTH;
    const candidates: Array<Pick<PlacedLabel, "anchor" | "leader" | "x" | "y">> = [
      { anchor: "start", leader: false, x: entry.px + LABEL_OFFSET, y: entry.py },
      { anchor: "end", leader: false, x: entry.px - LABEL_OFFSET, y: entry.py },
      { anchor: "middle", leader: false, x: entry.px, y: entry.py - LABEL_GAP },
      { anchor: "middle", leader: false, x: entry.px, y: entry.py + LABEL_GAP },
    ];

    for (const step of [1, -1, 2, -2, 3, -3, 4, -4]) {
      const y = entry.py + step * LABEL_GAP;

      candidates.push(
        { anchor: "start", leader: true, x: entry.px + LABEL_OFFSET, y },
        { anchor: "end", leader: true, x: entry.px - LABEL_OFFSET, y },
      );

      if (Math.abs(step) >= 2) {
        candidates.push({ anchor: "middle", leader: true, x: entry.px, y });
      }
    }

    const scored = candidates.map((candidate, index) => {
      const box = boxOf({ ...candidate, width });
      let conflicts = 0;

      if (
        box.left < bounds.left ||
        box.right > bounds.right ||
        box.top < bounds.top - half ||
        box.bottom > bounds.bottom
      ) {
        // Spilling into the axis margin is better than touching another mark.
        conflicts += 1;
      }

      for (const other of points) {
        const pad = DOT_RADIUS + 2;

        if (
          other.px + pad > box.left &&
          other.px - pad < box.right &&
          other.py + pad > box.top &&
          other.py - pad < box.bottom
        ) {
          conflicts += 3;
        }
      }

      for (const other of placed) {
        const otherBox = boxOf(other);

        if (
          otherBox.left < box.right + 4 &&
          otherBox.right + 4 > box.left &&
          otherBox.top < box.bottom &&
          otherBox.bottom > box.top
        ) {
          conflicts += 4;
        }
      }

      return { candidate, conflicts, index };
    });
    const best = scored.sort(
      (left, right) => left.conflicts - right.conflicts || left.index - right.index,
    )[0].candidate;

    placed.push({ ...best, point: entry.point, px: entry.px, py: entry.py, width });
  }

  return placed;
}
/** Leader from the dot's edge to the near edge of its displaced label. */
function leaderLine(label: PlacedLabel) {
  if (label.anchor === "middle") {
    const direction = label.y > label.py ? 1 : -1;

    return {
      x1: label.px,
      x2: label.px,
      y1: label.py + direction * (DOT_RADIUS + 1),
      y2: label.y - direction * (LABEL_GAP / 2),
    };
  }

  const side = label.anchor === "start" ? 1 : -1;

  return {
    x1: label.px + side * (DOT_RADIUS + 1),
    x2: label.x - side * 2,
    y1: label.py,
    y2: label.y,
  };
}

function describePoint(point: CostAgreementPoint) {
  return `${point.label}: ${point.averageAgreement}% agreement, ${formatUsd(point.averageCostUsd)} average cost per run${point.isDefault ? ", default model" : ""}`;
}

function PointTooltip({ point }: { point: CostAgreementPoint }) {
  return (
    <span className="flex flex-col gap-0.5 py-0.5">
      <span className="font-medium tabular-nums">
        {point.averageAgreement}% agreement · {formatUsd(point.averageCostUsd)} per run
      </span>
      <span className="text-text-muted">
        {point.label}
        {point.isDefault ? " (default)" : ""} · {pluralize(point.agreementRuns, "scored run")}
      </span>
    </span>
  );
}

function ScatterPlot({ chart }: { chart: CostAgreementChartData }) {
  const [containerRef, width] = useElementWidth(DEFAULT_WIDTH);
  const height = width < 480 ? 240 : 280;
  const plot = {
    bottom: height - MARGIN.bottom,
    left: MARGIN.left,
    right: width - MARGIN.right,
    top: MARGIN.top,
  };
  const xTicks = niceTicks(chart.xMax, 3);
  const xMax = xTicks.at(-1) ?? 1;
  const yMin = chart.yMin;
  const scaleX = (value: number) =>
    plot.left + (value / xMax) * (plot.right - plot.left);
  const scaleY = (value: number) =>
    plot.bottom - ((value - yMin) / (100 - yMin)) * (plot.bottom - plot.top);
  const positioned = chart.points.map((point) => ({
    point,
    px: scaleX(point.averageCostUsd),
    py: scaleY(point.averageAgreement),
  }));
  const labels = placeLabels(positioned, {
    bottom: plot.bottom - 2,
    left: plot.left + 2,
    right: width - 2,
    top: plot.top,
  });
  // Draw the default last so it sits on top of neutral marks.
  const drawOrder = [...positioned].sort(
    (left, right) => Number(left.point.isDefault) - Number(right.point.isDefault),
  );

  return (
    <div className="relative w-full" ref={containerRef} style={{ height }}>
      <svg
        aria-hidden="true"
        className="block h-full w-full overflow-visible"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <text className="fill-text-muted text-caption" x={0} y={12}>
          Agreement
        </text>
        {chart.yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              className={tick === yMin ? "stroke-border-strong" : "stroke-border-subtle"}
              shapeRendering="crispEdges"
              strokeWidth={1}
              x1={plot.left}
              x2={plot.right}
              y1={Math.round(scaleY(tick)) + 0.5}
              y2={Math.round(scaleY(tick)) + 0.5}
            />
            <text
              className="fill-text-muted text-caption tabular-nums"
              dominantBaseline="middle"
              textAnchor="end"
              x={plot.left - 8}
              y={scaleY(tick)}
            >
              {tick}%
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            {tick > 0 ? (
              <line
                className="stroke-border-subtle"
                shapeRendering="crispEdges"
                strokeWidth={1}
                x1={Math.round(scaleX(tick)) + 0.5}
                x2={Math.round(scaleX(tick)) + 0.5}
                y1={plot.top}
                y2={plot.bottom}
              />
            ) : null}
            <text
              className="fill-text-muted text-caption tabular-nums"
              textAnchor={tick === 0 ? "start" : tick === xMax ? "end" : "middle"}
              x={scaleX(tick)}
              y={plot.bottom + 18}
            >
              {formatUsdTick(tick)}
            </text>
          </g>
        ))}
        <text
          className="fill-text-muted text-caption"
          textAnchor="end"
          x={plot.right}
          y={height - 4}
        >
          Avg cost per run
        </text>
        {labels.map((label) =>
          label.leader ? (
            <line
              className="stroke-border-strong"
              key={`leader-${label.point.key}`}
              strokeWidth={1}
              {...leaderLine(label)}
            />
          ) : null,
        )}
        {drawOrder.map(({ point, px, py }) => (
          <circle
            className={point.isDefault ? "fill-accent" : "fill-chart-neutral-strong"}
            cx={px}
            cy={py}
            key={point.key}
            r={DOT_RADIUS}
          />
        ))}
        {labels.map((label) => (
          <text
            className={cn(
              "text-caption",
              label.point.isDefault ? "fill-text font-medium" : "fill-text-muted",
            )}
            dominantBaseline="middle"
            key={`label-${label.point.key}`}
            textAnchor={label.anchor}
            x={label.x}
            y={label.y}
          >
            {label.point.label}
          </text>
        ))}
      </svg>
      {/* Focusable images, not buttons: a point only reveals its tooltip. */}
      {positioned.map(({ point, px, py }) => (
        <Tooltip content={<PointTooltip point={point} />} describeChild={false} key={point.key}>
          <span
            aria-label={describePoint(point)}
            className="absolute rounded-pill hover:bg-surface-hover"
            role="img"
            style={{
              height: HIT_SIZE,
              left: px - HIT_SIZE / 2,
              top: py - HIT_SIZE / 2,
              width: HIT_SIZE,
            }}
            tabIndex={0}
          />
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * Cost vs agreement scatter (spec §6.2.2): one point per model·effort with
 * scored agreement runs and cost data. The default model·effort is the only
 * accent mark; everything else is neutral.
 */
export function CostAgreementChart({
  chart,
  filtered = false,
}: {
  chart: CostAgreementChartData;
  /** A filter is active, so empty means "nothing matches" rather than "nothing yet". */
  filtered?: boolean;
}) {
  const hasPoints = chart.points.length > 0;
  const defaultPoint = chart.points.find((point) => point.isDefault) ?? null;

  return (
    <ChartCard
      description="Agreement vs average cost per run"
      footnote={
        hasPoints ? (
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            {defaultPoint ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-pill bg-accent" />
                Default ({defaultPoint.label})
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-pill bg-chart-neutral-strong" />
              {defaultPoint ? "Other models" : "Models (the default is not in this view)"}
            </span>
          </span>
        ) : null
      }
      table={
        hasPoints
          ? {
              caption: "Average agreement and cost per model and effort",
              columns: [
                { label: "Model and effort" },
                { label: "Agreement", numeric: true },
                { label: "Avg cost per run", numeric: true },
                { label: "Scored runs", numeric: true },
                { label: "Runs with cost", numeric: true },
              ],
              rows: chart.points.map((point) => ({
                cells: [
                  point.isDefault ? `${point.label} (default)` : point.label,
                  `${point.averageAgreement}%`,
                  formatUsd(point.averageCostUsd),
                  point.agreementRuns,
                  point.costRuns,
                ],
                key: point.key,
              })),
            }
          : null
      }
      title="Cost vs. agreement"
    >
      {hasPoints ? (
        <ScatterPlot chart={chart} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            className="py-8"
            description={
              filtered
                ? "Clear a filter to see results."
                : "Run another model on a reviewed datasheet to compare models."
            }
            title={filtered ? "No scored runs in this view" : "No scored runs yet"}
            titleAs="p"
          />
        </div>
      )}
    </ChartCard>
  );
}
