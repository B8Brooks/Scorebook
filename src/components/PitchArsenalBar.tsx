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

function arcPath(startAngle: number, endAngle: number, cx = 50, cy = 50, r = 45): string {
  // Full-circle edge case: browsers won't render an arc where start === end.
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

  let cursor = 0;
  const slices = arsenal.map(pitch => {
    const sweep = (pitch.usagePct / total) * 360;
    const slice = {
      pitch,
      startAngle: cursor,
      endAngle: cursor + sweep,
      color: pitchColor(pitch.pitchType),
    };
    cursor += sweep;
    return slice;
  });

  const pieSize = compact ? 80 : 120;

  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 100 100"
        width={pieSize}
        height={pieSize}
        className="shrink-0"
        aria-label="Pitch arsenal distribution"
      >
        {slices.map(slice => (
          <path
            key={slice.pitch.pitchType}
            d={arcPath(slice.startAngle, slice.endAngle)}
            fill={slice.color.fill}
            stroke="white"
            strokeWidth="0.75"
          >
            <title>{`${slice.pitch.pitchName} ${slice.pitch.usagePct.toFixed(1)}%`}</title>
          </path>
        ))}
      </svg>
      <div className={`flex-1 min-w-0 grid grid-cols-1 ${compact ? 'gap-y-0.5' : 'gap-y-1'}`}>
        {arsenal.map(pitch => {
          const color = pitchColor(pitch.pitchType);
          return (
            <div
              key={pitch.pitchType}
              className={`flex items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-xs'}`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${color.bg}`}></span>
              <span className="font-semibold text-gray-800 w-6 shrink-0">{pitch.pitchType}</span>
              <span className="text-gray-500 truncate">{pitch.pitchName}</span>
              <span className="ml-auto font-medium text-gray-700 tabular-nums whitespace-nowrap">
                {pitch.usagePct.toFixed(1)}%
                {pitch.avgVelo ? ` · ${pitch.avgVelo.toFixed(1)} mph` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
