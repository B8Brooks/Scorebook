import type { PitchArsenalItem } from '../types';
import { pitchColor } from '../utils/pitchColors';

// Sparkline-grade pitch mix: a thin segmented bar plus a one-line caption
// ("FF 55 (96) · SL 31 · CH 14"). The caption carries the information in
// black-and-white print; the full breakdown lives in the tooltip.

interface PitchMixBarProps {
  arsenal: PitchArsenalItem[];
  compact?: boolean;
}

function fullBreakdown(arsenal: PitchArsenalItem[]): string {
  return arsenal
    .map(p => {
      const velo = p.avgVelo != null ? ` ${p.avgVelo.toFixed(1)}mph` : '';
      return `${p.pitchName} ${p.usagePct.toFixed(1)}%${velo}`;
    })
    .join(', ');
}

export function PitchMixBar({ arsenal, compact = false }: PitchMixBarProps) {
  if (arsenal.length === 0) {
    return <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} italic text-gray-400`}>no mix data</span>;
  }

  const total = arsenal.reduce((sum, p) => sum + p.usagePct, 0) || 100;
  const top = arsenal.slice(0, 3);
  const extra = arsenal.length - top.length;

  return (
    <div title={fullBreakdown(arsenal)} className="min-w-0">
      <div className={`flex ${compact ? 'h-2' : 'h-2.5'} rounded overflow-hidden border border-gray-200`}>
        {arsenal.map(pitch => (
          <div
            key={pitch.pitchType}
            className={pitchColor(pitch.pitchType).bg}
            style={{ width: `${(pitch.usagePct / total) * 100}%` }}
          />
        ))}
      </div>
      <div className={`mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'} text-gray-600 whitespace-nowrap tabular-nums`}>
        {top.map((pitch, i) => (
          <span key={pitch.pitchType}>
            {i > 0 && <span className="text-gray-300"> · </span>}
            <span className="font-semibold text-gray-800">{pitch.pitchType}</span>{' '}
            {Math.round(pitch.usagePct)}
            {i === 0 && pitch.avgVelo != null && (
              <span className="text-gray-400"> ({Math.round(pitch.avgVelo)})</span>
            )}
          </span>
        ))}
        {extra > 0 && <span className="text-gray-400"> +{extra}</span>}
      </div>
    </div>
  );
}
