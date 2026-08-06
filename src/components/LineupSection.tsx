import type { TeamLineup, BatterLineupEntry } from '../types';
import type { PitcherCardMode } from './PitcherCard';

interface LineupSectionProps {
  lineup: TeamLineup;
  mode: PitcherCardMode;
  opposingStarterHand?: 'L' | 'R' | 'S';
}

const badgePad = (compact: boolean) => (compact ? 'px-1 py-0' : 'px-1.5 py-0.5');

function opsClass(opsStr: string): string {
  const ops = parseFloat(opsStr);
  if (!Number.isFinite(ops) || ops === 0) return 'text-gray-400';
  if (ops >= 0.8) return 'bg-green-100 text-green-900 font-bold';
  if (ops >= 0.7) return 'bg-amber-100 text-amber-900 font-semibold';
  return 'bg-red-100 text-red-900';
}

function opsPlusClass(opsPlus?: number): string {
  if (opsPlus == null) return 'text-gray-400';
  if (opsPlus >= 110) return 'bg-green-100 text-green-900 font-bold';
  if (opsPlus >= 90) return 'bg-amber-100 text-amber-900 font-semibold';
  return 'bg-red-100 text-red-900';
}

function BatSideChip({ side }: { side: 'L' | 'R' | 'S' }) {
  const tone =
    side === 'L'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : side === 'R'
        ? 'bg-red-100 text-red-800 border-red-200'
        : 'bg-purple-100 text-purple-800 border-purple-200';
  return (
    <span className={`inline-flex items-center justify-center text-[9px] font-bold px-1 py-0 rounded border ${tone}`}>
      {side}
    </span>
  );
}

function platoonAdvantage(batSide: 'L' | 'R' | 'S', pitchHand?: 'L' | 'R' | 'S'): boolean {
  if (!pitchHand) return false;
  if (batSide === 'S') return true;
  return batSide !== pitchHand;
}

export function LineupSection({ lineup, mode, opposingStarterHand }: LineupSectionProps) {
  const compact = mode === 'print';

  if (!lineup.posted || lineup.battingOrder.length === 0) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 ${compact ? 'p-3' : 'p-4 shadow-sm'}`}>
        <div className={`${compact ? 'text-xs' : 'text-sm'} italic text-gray-500`}>
          Lineup not yet posted — MLB usually publishes about 2 hours before first pitch.
        </div>
      </div>
    );
  }

  const textSize = compact ? 'text-[10px]' : 'text-xs';
  const padY = compact ? 'py-px' : 'py-1';
  const padX = compact ? 'px-1' : 'px-2';

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className={`bg-white rounded-xl border border-gray-200 overflow-x-auto ${compact ? '' : 'shadow-sm'}`}>
        <table className={`${textSize} border-collapse w-auto`}>
          <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
            <tr>
              <th className={`text-center ${padX} ${padY}`}>#</th>
              <th className={`text-left ${padX} ${padY}`}>Batter</th>
              <th className={`text-center ${padX} ${padY}`}>Pos</th>
              <th className={`text-center ${padX} ${padY}`}>B</th>
              <th className={`text-right ${padX} ${padY}`}>AVG/OBP/SLG</th>
              <th className={`text-center ${padX} ${padY}`}>OPS</th>
              <th className={`text-center ${padX} ${padY}`}>OPS+</th>
              <th className={`text-right ${padX} ${padY}`}>PA</th>
              <th className={`text-right ${padX} ${padY}`}>HR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineup.battingOrder.map(batter => (
              <BatterRow
                key={batter.id}
                batter={batter}
                padX={padX}
                padY={padY}
                hasPlatoonAdvantage={platoonAdvantage(batter.batSide, opposingStarterHand)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {lineup.bench.length > 0 && (
        <BenchPanel bench={lineup.bench} textSize={textSize} padX={padX} padY={padY} compact={compact} />
      )}
    </div>
  );
}

function BenchPanel({
  bench,
  textSize,
  padX,
  padY,
  compact,
}: {
  bench: BatterLineupEntry[];
  textSize: string;
  padX: string;
  padY: string;
  compact: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-x-auto flex-1 min-w-[240px] ${compact ? '' : 'shadow-sm'}`}>
      <div className={`${textSize} font-semibold text-gray-500 uppercase tracking-wide ${padX} pt-1.5`}>
        Bench
      </div>
      <table className={`${textSize} border-collapse w-auto`}>
        <thead className="text-gray-600 uppercase tracking-wide">
          <tr>
            <th className={`text-left ${padX} ${padY}`}>Batter</th>
            <th className={`text-center ${padX} ${padY}`}>Pos</th>
            <th className={`text-center ${padX} ${padY}`}>B</th>
            <th className={`text-center ${padX} ${padY}`}>OPS</th>
            <th className={`text-center ${padX} ${padY}`}>OPS+</th>
            <th className={`text-right ${padX} ${padY}`}>PA</th>
            <th className={`text-right ${padX} ${padY}`}>HR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bench.map(b => (
            <tr key={b.id}>
              <td className={`${padX} ${padY}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-900 truncate">{b.fullName}</span>
                  {b.primaryNumber && (
                    <span className="text-gray-400 text-[10px]">#{b.primaryNumber}</span>
                  )}
                </div>
              </td>
              <td className={`text-center text-gray-600 ${padX} ${padY}`}>
                {b.position || '—'}
              </td>
              <td className={`text-center ${padX} ${padY}`}>
                <BatSideChip side={b.batSide} />
              </td>
              <td className={`text-center ${padX} ${padY}`}>
                <span className={`inline-block ${badgePad(padY === 'py-px')} rounded tabular-nums ${opsClass(b.ops)}`}>
                  {b.ops}
                </span>
              </td>
              <td className={`text-center ${padX} ${padY}`}>
                <span className={`inline-block ${badgePad(padY === 'py-px')} rounded tabular-nums ${opsPlusClass(b.opsPlus)}`}>
                  {b.opsPlus ?? '—'}
                </span>
              </td>
              <td className={`text-right tabular-nums text-gray-700 ${padX} ${padY}`}>
                {b.pa}
              </td>
              <td className={`text-right tabular-nums text-gray-700 ${padX} ${padY}`}>
                {b.hr}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatterRow({
  batter,
  padX,
  padY,
  hasPlatoonAdvantage,
}: {
  batter: BatterLineupEntry;
  padX: string;
  padY: string;
  hasPlatoonAdvantage: boolean;
}) {
  return (
    <tr className={hasPlatoonAdvantage ? 'bg-blue-50/50' : ''}>
      <td className={`text-center font-bold text-gray-600 ${padX} ${padY}`}>
        {batter.orderIndex}
      </td>
      <td className={`${padX} ${padY}`}>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900 truncate">{batter.fullName}</span>
          {batter.primaryNumber && (
            <span className="text-gray-400 text-[10px]">#{batter.primaryNumber}</span>
          )}
        </div>
      </td>
      <td className={`text-center text-gray-600 ${padX} ${padY}`}>
        {batter.position || '—'}
      </td>
      <td className={`text-center ${padX} ${padY}`}>
        <BatSideChip side={batter.batSide} />
      </td>
      <td className={`text-right tabular-nums text-gray-700 ${padX} ${padY}`}>
        {batter.avg} / {batter.obp} / {batter.slg}
      </td>
      <td className={`text-center ${padX} ${padY}`}>
        <span className={`inline-block ${badgePad(padY === 'py-px')} rounded tabular-nums ${opsClass(batter.ops)}`}>
          {batter.ops}
        </span>
      </td>
      <td className={`text-center ${padX} ${padY}`}>
        <span className={`inline-block ${badgePad(padY === 'py-px')} rounded tabular-nums ${opsPlusClass(batter.opsPlus)}`}>
          {batter.opsPlus ?? '—'}
        </span>
      </td>
      <td className={`text-right tabular-nums text-gray-700 ${padX} ${padY}`}>
        {batter.pa}
      </td>
      <td className={`text-right tabular-nums text-gray-700 ${padX} ${padY}`}>
        {batter.hr}
      </td>
    </tr>
  );
}
