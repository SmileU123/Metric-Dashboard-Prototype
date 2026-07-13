// Lightweight, dependency-free SVG chart kit. Every color is driven by the
// white-label CSS tokens (rgb(var(--...))) via inline styles, so charts re-skin
// with the tenant theme. All primitives are deterministic (circles / rects /
// polylines) and scale to their container.

import type { ComplianceState, MetricDirection } from "@/data/types";

export type TrendPoint = { label: string; value: number };

const stateColor = (s: ComplianceState) => `rgb(var(--state-${s}))`;
const TRACK = "rgb(var(--line))";
const clampFrac = (v: number, max: number) =>
  Math.max(0, Math.min(1, max > 0 ? v / max : 0));
// One-decimal display — identical rounding to the card's formatted value, so
// the number inside a dial always matches the number beside it.
const fmt1 = (v: number) => String(Math.round(v * 10) / 10);

// 0 = top, angle increases clockwise (SVG y-down).
function pt(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}
function arc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const s = pt(cx, cy, r, startAngle);
  const e = pt(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/* ---- Full donut ring ------------------------------------------------------ */
export function Ring({
  value,
  max,
  state,
  size = 128,
  label,
  centerText,
  color,
}: {
  value: number;
  max: number;
  state: ComplianceState;
  size?: number;
  label?: string;
  centerText?: string; // overrides the numeric center (e.g. a "3/17" fraction)
  color?: string; // overrides the state color (e.g. the brand accent)
}) {
  const f = clampFrac(value, max);
  const r = size / 2 - 10;
  const c = size / 2;
  const stroke = color ?? stateColor(state);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={TRACK} strokeWidth={10} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        style={{ stroke }}
        strokeWidth={10}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${f * 100} 100`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text
        x={c}
        y={label ? c - size * 0.04 : c}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink"
        style={{ fontSize: centerText ? size * 0.22 : size * 0.2, fontWeight: 700 }}
      >
        {centerText ?? fmt1(value)}
      </text>
      {label && (
        <text
          x={c}
          y={c + size * 0.16}
          textAnchor="middle"
          className="fill-muted"
          style={{ fontSize: size * 0.1 }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

/* ---- Semicircle gauge (unified 180° dial) --------------------------------- */
// The single dial design for all four multi-option KPIs. Unified stroke, color
// profile and draw animation; a threshold marker line sits at the "green / high
// outcome" point, and the numeric score rests on the baseline of the half-arc.
const GAUGE_STROKE = 14;
export function Gauge({
  value,
  max,
  state,
  width = 180,
  threshold,
  amberThreshold,
}: {
  value: number;
  max: number;
  state: ComplianceState;
  width?: number;
  threshold?: number; // green / high-outcome boundary, in value units
  amberThreshold?: number; // amber / risk boundary, in value units
}) {
  const f = clampFrac(value, max);
  const r = width / 2 - 14;
  const cx = width / 2;
  const cy = width / 2;
  const height = width / 2 + 20;
  const full = arc(cx, cy, r, -90, 90);

  // A dashed radial tick at a boundary, confined to the arc band (mirrors the
  // linear gauge's dashed reference lines). A small dot just inside the ring
  // colour-codes it: green = high-outcome, amber = risk floor.
  const tickAt = (val: number, dot: string, key: string) => {
    const ta = -90 + clampFrac(val, max) * 180;
    const inner = pt(cx, cy, r - GAUGE_STROKE / 2, ta);
    const outer = pt(cx, cy, r + GAUGE_STROKE / 2, ta);
    const chip = pt(cx, cy, r - GAUGE_STROKE / 2 - 4, ta);
    return (
      <g key={key}>
        <line
          x1={inner.x}
          y1={inner.y}
          x2={outer.x}
          y2={outer.y}
          style={{ stroke: "rgb(var(--ink))" }}
          strokeWidth={2}
          strokeDasharray="2.5 2"
          strokeLinecap="butt"
        />
        <circle cx={chip.x} cy={chip.y} r={2.2} style={{ fill: dot }} />
      </g>
    );
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={full}
        fill="none"
        stroke={TRACK}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="butt"
      />
      <path
        d={full}
        fill="none"
        pathLength={100}
        strokeDasharray={`${f * 100} 100`}
        style={{
          stroke: stateColor(state),
          transition: "stroke-dasharray 0.6s ease",
        }}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="butt"
      />
      {amberThreshold != null && tickAt(amberThreshold, stateColor("amber"), "amber")}
      {threshold != null && tickAt(threshold, stateColor("green"), "green")}
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        className="fill-ink"
        style={{ fontSize: width * 0.17, fontWeight: 700 }}
      >
        {fmt1(value)}
      </text>
    </svg>
  );
}

/* ---- Horizontal zone bar (red/amber/green bands + value marker) ----------- */
export function ZoneBar({
  value,
  max,
  greenAt,
  amberAt,
  direction,
  unit = "",
}: {
  value: number;
  max: number;
  greenAt: number;
  amberAt: number;
  direction: MetricDirection;
  unit?: string;
}) {
  const pct = (n: number) => `${clampFrac(n, max) * 100}%`;
  // Build the three colored bands along the axis, ordered by direction.
  const bands =
    direction === "higher_better"
      ? [
          { from: 0, to: amberAt, s: "red" as const },
          { from: amberAt, to: greenAt, s: "amber" as const },
          { from: greenAt, to: max, s: "green" as const },
        ]
      : [
          { from: 0, to: greenAt, s: "green" as const },
          { from: greenAt, to: amberAt, s: "amber" as const },
          { from: amberAt, to: max, s: "red" as const },
        ];
  return (
    <div className="w-full">
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        {bands.map((b, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{
              left: pct(b.from),
              width: `${clampFrac(b.to - b.from, max) * 100}%`,
              backgroundColor: stateColor(b.s),
              opacity: 0.25,
            }}
          />
        ))}
        {/* value marker */}
        <div
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded"
          style={{ left: pct(value), backgroundColor: "rgb(var(--ink))" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0{unit}</span>
        <span>
          {Math.round(max)}
          {unit}
        </span>
      </div>
    </div>
  );
}

/* ---- Monthly trend columns ------------------------------------------------ */
export function TrendColumns({
  points,
  state,
  max = 100,
  height = 96,
}: {
  points: TrendPoint[];
  state: ComplianceState;
  max?: number;
  height?: number;
}) {
  const w = 200;
  const gap = 8;
  const bw = (w - gap * (points.length - 1)) / Math.max(points.length, 1);
  const barH = height - 18;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {points.map((p, i) => {
        const h = clampFrac(p.value, max) * barH;
        const x = i * (bw + gap);
        return (
          <g key={i}>
            <rect
              x={x}
              y={barH - h}
              width={bw}
              height={Math.max(h, 1)}
              rx={2}
              style={{ fill: stateColor(state) }}
              opacity={0.85}
            />
            <text
              x={x + bw / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-muted"
              style={{ fontSize: 9 }}
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---- Trend area / sparkline ----------------------------------------------- */
export function TrendArea({
  points,
  state,
  max = 100,
  height = 96,
}: {
  points: TrendPoint[];
  state: ComplianceState;
  max?: number;
  height?: number;
}) {
  const w = 200;
  const plotH = height - 16;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const xy = points.map((p, i) => ({
    x: i * step,
    y: plotH - clampFrac(p.value, max) * plotH,
  }));
  const line = xy.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${plotH} ${line} ${w},${plotH}`;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <polygon points={area} style={{ fill: stateColor(state) }} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        style={{ stroke: stateColor(state) }}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {xy.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} style={{ fill: stateColor(state) }} />
      ))}
      {points.map((p, i) => (
        <text
          key={`l${i}`}
          x={xy[i].x}
          y={height - 2}
          textAnchor="middle"
          className="fill-muted"
          style={{ fontSize: 9 }}
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/* ---- Horizontal bar with target + risk reference lines -------------------- */
export function BarTarget({
  value,
  max,
  target,
  amber,
  state,
  unit = "",
}: {
  value: number;
  max: number;
  target: number; // green / high-outcome boundary
  amber?: number; // amber / risk boundary
  state: ComplianceState;
  unit?: string;
}) {
  // A dashed vertical reference line with a colour-coded cap on top.
  const refLine = (val: number, dot: string, label: string) => (
    <div
      className="absolute top-0 h-full border-l-2 border-dashed"
      style={{ left: `${clampFrac(val, max) * 100}%`, borderColor: "rgb(var(--ink))" }}
      title={label}
    >
      <span
        className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dot }}
      />
    </div>
  );

  return (
    <div className="w-full">
      <div className="relative h-6 w-full overflow-hidden rounded-md bg-canvas">
        <div
          className="h-full rounded-md"
          style={{ width: `${clampFrac(value, max) * 100}%`, backgroundColor: stateColor(state) }}
        />
        {amber != null && refLine(amber, stateColor("amber"), `Risk floor ${amber}${unit}`)}
        {refLine(target, stateColor("green"), `Target ${target}${unit}`)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0{unit}</span>
        <span>
          {amber != null && (
            <>
              risk {amber}
              {unit} ·{" "}
            </>
          )}
          target {target}
          {unit}
        </span>
        <span>
          {Math.round(max)}
          {unit}
        </span>
      </div>
    </div>
  );
}
