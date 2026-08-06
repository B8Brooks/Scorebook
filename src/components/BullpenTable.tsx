import type { RelieverRanking } from '../types';
import type { PitcherCardMode } from './PitcherCard';
import { availabilityFor, availabilityToneClasses } from '../utils/availability';
import { PitchMixBar } from './PitchMixBar';

function mixCaption(r: RelieverRanking): string {
  if (!r.arsenal || r.arsenal.length === 0) return '';
  return r.arsenal
    .slice(0, 3)
    .map(p => `${p.pitchType} ${Math.round(p.usagePct)}`)
    .join(' · ');
}

interface BullpenTableProps {
  entries: RelieverRanking[];
  mode: PitcherCardMode;
  scoutDate: string;
}

export function BullpenTable({ entries, mode, scoutDate }: BullpenTableProps) {
  if (entries.length === 0) return null;

  if (mode === 'text') {
    return (
      <div className="font-mono text-xs text-gray-800 border border-gray-300 rounded p-3 bg-white space-y-1">
        {entries.map(r => {
          const avail = availabilityFor(scoutDate, r.recent);
          return (
            <div key={r.id}>
              {r.role ?? 'Reliever'}: {r.name}
              {r.throws ? ` (${r.throws}HP)` : ''} — {r.era ?? '—'} ERA, {r.ip ?? '—'} IP,{' '}
              {r.whip ?? '—'} WHIP, {r.k9 ?? '—'} K/9, {r.saves ?? 0} SV / {r.holds ?? 0} HLD
              {mixCaption(r) ? ` | ${mixCaption(r)}` : ''}
              {avail ? ` [${avail.label}]` : ''}
              {r.tags ? ` {${r.tags}}` : ''}
            </div>
          );
        })}
      </div>
    );
  }

  const compact = mode === 'print';
  const textSize = compact ? 'text-[10px]' : 'text-xs';
  const pad = compact ? 'px-1.5 py-px' : 'px-2 py-1';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-x-auto ${compact ? '' : 'shadow-sm'}`}>
      <table className={`${textSize} border-collapse w-full`}>
        <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
          <tr>
            <th className={`text-left ${pad}`}>Role</th>
            <th className={`text-left ${pad}`}>Pitcher</th>
            <th className={`text-center ${pad}`}>T</th>
            <th className={`text-right ${pad}`}>ERA</th>
            <th className={`text-right ${pad}`}>IP</th>
            <th className={`text-right ${pad}`}>WHIP</th>
            <th className={`text-right ${pad}`}>K/9</th>
            <th className={`text-right ${pad}`}>SV/HLD</th>
            <th className={`text-left ${pad}`}>Mix</th>
            <th className={`text-left ${pad}`}>Availability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(r => {
            const avail = availabilityFor(scoutDate, r.recent);
            return (
              <tr key={r.id}>
                <td className={`text-gray-500 whitespace-nowrap ${pad}`}>{r.role ?? '—'}</td>
                <td className={`${pad}`}>
                  <span className="font-semibold text-gray-900">{r.name}</span>
                  {r.tags && (
                    <span className={`ml-1.5 inline-flex items-center ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200`}>
                      {r.tags}
                    </span>
                  )}
                  {r.source === 'stats' && (
                    <span className={`ml-1.5 inline-flex items-center ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200`}>
                      stats-ranked
                    </span>
                  )}
                </td>
                <td className={`text-center ${pad}`}>
                  {r.throws ? (
                    <span
                      className={`inline-flex items-center justify-center ${compact ? 'text-[9px]' : 'text-[10px]'} font-bold px-1 py-0.5 rounded border ${
                        r.throws === 'L'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : r.throws === 'R'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-purple-100 text-purple-800 border-purple-200'
                      }`}
                    >
                      {r.throws}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`text-right tabular-nums ${pad}`}>{r.era ?? '—'}</td>
                <td className={`text-right tabular-nums ${pad}`}>{r.ip ?? '—'}</td>
                <td className={`text-right tabular-nums ${pad}`}>{r.whip ?? '—'}</td>
                <td className={`text-right tabular-nums ${pad}`}>{r.k9 ?? '—'}</td>
                <td className={`text-right tabular-nums ${pad}`}>
                  {r.saves ?? 0}/{r.holds ?? 0}
                </td>
                <td className={`${pad} min-w-[130px]`}>
                  <PitchMixBar arsenal={r.arsenal ?? []} compact={compact} />
                </td>
                <td className={`${pad}`}>
                  {avail ? (
                    <span className={`inline-flex items-center ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold px-1.5 py-0.5 rounded border ${availabilityToneClasses(avail.tone)}`}>
                      {avail.label}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
