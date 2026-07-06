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
}: {
  value: number;
  max: number;
  state: ComplianceState;
  size?: number;
  label?: string;
}) {
  const f = clampFrac(value, max);
  const r = size / 2 - 10;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={TRACK} strokeWidth={10} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        style={{ stroke: stateColor(state) }}
        strokeWidth={10}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${f * 100} 100`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text
        x={c}
        y={c - 2}
        textAnchor="middle"
        className="fill-ink"
        style={{ fontSize: size * 0.2, fontWeight: 700 }}
      >
        {fmt1(value)}
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

/* ---- Semicircle gauge ----------------------------------------------------- */
export function Gauge({
  value,
  max,
  state,
  width = 180,
}: {
  value: number;
  max: number;
  state: ComplianceState;
  width?: number;
}) {
  const f = clampFrac(value, max);
  const r = width / 2 - 12;
  const cx = width / 2;
  const cy = width / 2;
  const height = width / 2 + 16;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={arc(cx, cy, r, -90, 90)}
        fill="none"
        stroke={TRACK}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <path
        d={arc(cx, cy, r, -90, -90 + f * 180)}
        fill="none"
        style={{ stroke: stateColor(state) }}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-ink"
        style={{ fontSize: width * 0.15, fontWeight: 700 }}
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

/* ---- Horizontal bar with a target line ------------------------------------ */
export function BarTarget({
  value,
  max,
  target,
  state,
  unit = "",
}: {
  value: number;
  max: number;
  target: number;
  state: ComplianceState;
  unit?: string;
}) {
  return (
    <div className="w-full">
      <div className="relative h-6 w-full overflow-hidden rounded-md bg-canvas">
        <div
          className="h-full rounded-md"
          style={{ width: `${clampFrac(value, max) * 100}%`, backgroundColor: stateColor(state) }}
        />
        <div
          className="absolute top-0 h-full border-l-2 border-dashed"
          style={{ left: `${clampFrac(target, max) * 100}%`, borderColor: "rgb(var(--ink))" }}
          title={`Target ${target}${unit}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0{unit}</span>
        <span>
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
