import type { PitchArsenalItem } from '../types';
import { pitchColor } from '../utils/pitchColors';

interface PitchArsenalBarProps {
  arsenal: PitchArsenalItem[];
  compact?: boolean;
}

export function PitchArsenalBar({ arsenal, compact = false }: PitchArsenalBarProps) {
  if (arsenal.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">No pitch arsenal data available</div>
    );
  }

  const total = arsenal.reduce((sum, a) => sum + a.usagePct, 0) || 100;

  return (
    <div>
      <div className={`flex ${compact ? 'h-4' : 'h-6'} rounded overflow-hidden border border-gray-300`}>
        {arsenal.map(pitch => {
          const widthPct = (pitch.usagePct / total) * 100;
          const color = pitchColor(pitch.pitchType);
          const showLabel = widthPct >= 10;
          return (
            <div
              key={pitch.pitchType}
              className={`${color.bg} flex items-center justify-center text-white font-semibold ${compact ? 'text-[9px]' : 'text-xs'}`}
              style={{ width: `${widthPct}%` }}
              title={`${pitch.pitchName} ${pitch.usagePct.toFixed(1)}%`}
            >
              {showLabel && (compact ? pitch.pitchType : `${pitch.pitchType} ${pitch.usagePct.toFixed(0)}%`)}
            </div>
          );
        })}
      </div>
      <div className={`mt-2 grid ${compact ? 'grid-cols-2 gap-x-3 gap-y-0.5' : 'grid-cols-2 gap-x-4 gap-y-1'}`}>
        {arsenal.map(pitch => {
          const color = pitchColor(pitch.pitchType);
          return (
            <div
              key={pitch.pitchType}
              className={`flex items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-xs'}`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color.bg}`}></span>
              <span className="font-semibold text-gray-800">{pitch.pitchType}</span>
              <span className="text-gray-500 truncate">{pitch.pitchName}</span>
              <span className="ml-auto font-medium text-gray-700 tabular-nums">
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
