import type { HandednessSplit } from '../types';

interface SplitsTableProps {
  vsRHB: HandednessSplit | null;
  vsLHB: HandednessSplit | null;
  compact?: boolean;
}

function opsClass(ops: string): string {
  const n = parseFloat(ops);
  if (!Number.isFinite(n) || n === 0) return 'bg-gray-50 border-gray-200 text-gray-500';
  if (n >= 0.8) return 'bg-red-50 border-red-200 text-red-900';
  if (n >= 0.7) return 'bg-amber-50 border-amber-300 text-amber-900';
  return 'bg-green-50 border-green-200 text-green-900';
}

function SplitPanel({ split, label, compact }: { split: HandednessSplit | null; label: string; compact: boolean }) {
  if (!split) {
    return (
      <div className="flex-1 border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-400">
        <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
        <div className="mt-1 text-xs italic">No data</div>
      </div>
    );
  }

  const smallSample = split.pa < 15;
  const tone = smallSample ? 'bg-gray-50 border-gray-200 text-gray-600' : opsClass(split.ops);

  return (
    <div className={`flex-1 border rounded-lg ${compact ? 'p-2' : 'p-3'} ${tone}`}>
      <div className="flex items-baseline justify-between">
        <div className={`font-semibold uppercase tracking-wide ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {label}
        </div>
        <div className={`${compact ? 'text-lg' : 'text-2xl'} font-bold tabular-nums leading-none`}>
          {split.ops}
        </div>
      </div>
      <div className={`mt-1 tabular-nums ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {split.avg} / {split.obp} / {split.slg}
      </div>
      <div className={`mt-1 flex gap-2 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-700`}>
        <span>PA {split.pa}</span>
        <span>K {split.so}</span>
        <span>BB {split.bb}</span>
        <span>HR {split.hr}</span>
      </div>
      {smallSample && (
        <div className={`mt-1 italic text-gray-500 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          small sample
        </div>
      )}
    </div>
  );
}

export function SplitsTable({ vsRHB, vsLHB, compact = false }: SplitsTableProps) {
  return (
    <div className={`flex gap-2 ${compact ? '' : 'gap-3'}`}>
      <SplitPanel split={vsRHB} label="vs RHB" compact={compact} />
      <SplitPanel split={vsLHB} label="vs LHB" compact={compact} />
    </div>
  );
}
