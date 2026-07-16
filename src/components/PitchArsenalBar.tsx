import type { PitchArsenalItem } from '../types';
import { pitchColor } from '../utils/pitchColors';

interface PitchArsenalProps {
  arsenal: PitchArsenalItem[];
  compact?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(startAngle: number, endAngle: number, cx: number, cy: number, r: number): string {
  if (endAngle - startAngle >= 359.999) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function PitchArsenalBar({ arsenal, compact = false }: PitchArsenalProps) {
  if (arsenal.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">No pitch arsenal data available</div>
    );
  }

  const total = arsenal.reduce((sum, a) => sum + a.usagePct, 0) || 100;

  // Layout constants — scaled for compact vs full.
  const W = compact ? 260 : 320;
  const r = compact ? 40 : 50;
  const rowHeight = compact ? 22 : 26;
  const legendHeight = rowHeight * arsenal.length + (compact ? 10 : 14);
  // The viewBox must fit whichever is taller: the legend rows or the pie itself.
  // Legend-only sizing clipped the pie for 2-3 pitch arsenals (most relievers).
  const H = Math.max(legendHeight, 2 * r + 8);
  const cx = compact ? 50 : 60;
  const cy = H / 2;
  const legendX = compact ? 120 : 140;
  const lineEndX = legendX - 8;
  const legendTop = (H - rowHeight * arsenal.length) / 2 + rowHeight / 2;
  const codeFont = compact ? 9 : 11;
  const nameFont = compact ? 9 : 10;
  const statFont = compact ? 9 : 10;

  let cursor = 0;
  const slices = arsenal.map((pitch, i) => {
    const sweep = (pitch.usagePct / total) * 360;
    const startAngle = cursor;
    const endAngle = cursor + sweep;
    cursor += sweep;
    const mid = (startAngle + endAngle) / 2;
    const outer = polarToCartesian(cx, cy, r, mid);
    // Elbow point slightly beyond the pie edge so lines leave radially
    // before turning toward the legend, which keeps them from crossing.
    const elbow = polarToCartesian(cx, cy, r + 6, mid);
    const legendY = legendTop + i * rowHeight;
    return {
      pitch,
      startAngle,
      endAngle,
      color: pitchColor(pitch.pitchType),
      outer,
      elbow,
      legendY,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: W, height: 'auto' }}
      aria-label="Pitch arsenal distribution"
    >
      {/* Pie slices */}
      {slices.map(slice => (
        <path
          key={`slice-${slice.pitch.pitchType}`}
          d={arcPath(slice.startAngle, slice.endAngle, cx, cy, r)}
          fill={slice.color.fill}
          stroke="white"
          strokeWidth="0.75"
        >
          <title>{`${slice.pitch.pitchName} ${slice.pitch.usagePct.toFixed(1)}%`}</title>
        </path>
      ))}

      {/* Leader lines: slice edge → legend dot */}
      {slices.map(slice => (
        <polyline
          key={`line-${slice.pitch.pitchType}`}
          points={`${slice.outer.x},${slice.outer.y} ${slice.elbow.x},${slice.elbow.y} ${lineEndX - 4},${slice.legendY} ${lineEndX},${slice.legendY}`}
          fill="none"
          stroke="#6b7280"
          strokeWidth="0.6"
        />
      ))}

      {/* Legend rows (dot + pitch code + name on one line, % + velo on the right) */}
      {slices.map(slice => (
        <g key={`legend-${slice.pitch.pitchType}`}>
          <circle cx={lineEndX + 3} cy={slice.legendY} r={3} fill={slice.color.fill} />
          <text
            x={lineEndX + 10}
            y={slice.legendY + codeFont / 3}
            fontSize={codeFont}
            fontWeight="700"
            fill="#111827"
          >
            {slice.pitch.pitchType}
          </text>
          <text
            x={lineEndX + 10 + codeFont * 1.8}
            y={slice.legendY + nameFont / 3}
            fontSize={nameFont}
            fill="#4b5563"
          >
            {slice.pitch.pitchName}
          </text>
          <text
            x={W - 2}
            y={slice.legendY + statFont / 3}
            fontSize={statFont}
            fontWeight="600"
            fill="#374151"
            textAnchor="end"
          >
            {slice.pitch.usagePct.toFixed(1)}%
            {slice.pitch.avgVelo ? ` · ${slice.pitch.avgVelo.toFixed(1)}` : ''}
          </text>
        </g>
      ))}
    </svg>
  );
}
