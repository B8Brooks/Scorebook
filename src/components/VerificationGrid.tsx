import { useMemo, useState } from 'react';
import type { VerificationResult, VerifiedAtBat, VerifiedBatterRow } from '../types';
import { cellKey } from '../services/verification';

interface VerificationGridProps {
  result: VerificationResult;
  awayTeamName: string;
  homeTeamName: string;
  onResolve: (key: string, choice: 'mine' | 'official', officialNotation?: string) => void;
}

interface OpenCell {
  key: string;
  atBat: VerifiedAtBat;
  batterName: string;
}

function cellClasses(ab: VerifiedAtBat): string {
  if (ab.verdict === 'match') return 'bg-green-50 text-green-900';
  if (ab.verdict === 'mismatch') {
    if (ab.resolution === 'official') return 'bg-green-50 text-green-900';
    if (ab.resolution === 'mine') return 'bg-red-50/50 text-gray-500';
    return 'bg-red-50 text-red-900 cursor-pointer hover:bg-red-100';
  }
  return 'bg-gray-50 text-gray-500';
}

function VerdictMark({ ab }: { ab: VerifiedAtBat }) {
  if (ab.verdict === 'match' || ab.resolution === 'official') {
    return <span className="text-green-600 font-bold">✓</span>;
  }
  if (ab.verdict === 'mismatch') {
    return <span className={`font-bold ${ab.resolution === 'mine' ? 'text-gray-400' : 'text-red-600'}`}>✗</span>;
  }
  return <span className="text-gray-400 font-bold">?</span>;
}

export function VerificationGrid({ result, awayTeamName, homeTeamName, onResolve }: VerificationGridProps) {
  const [side, setSide] = useState<'away' | 'home'>('away');
  const [openCell, setOpenCell] = useState<OpenCell | null>(null);

  const rows = side === 'away' ? result.away : result.home;
  const officialOnlyForSide = result.officialOnly.filter(o => o.side === side);

  const maxInning = useMemo(() => {
    let max = 9;
    for (const sideRows of [result.away, result.home]) {
      for (const row of sideRows) {
        for (const ab of row.atBats) {
          if (ab.inning > max) max = ab.inning;
        }
      }
    }
    return max;
  }, [result]);
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1);

  const handleCellClick = (row: VerifiedBatterRow, batterIdx: number, ab: VerifiedAtBat) => {
    if (ab.verdict !== 'mismatch') return;
    const key = cellKey(side, batterIdx, ab.inning, ab.slot);
    setOpenCell(prev => (prev?.key === key ? null : { key, atBat: ab, batterName: row.name }));
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">{result.accuracyPct}%</span>
          <span className="text-sm text-gray-500">accuracy</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-gray-700">{result.matches} match{result.matches !== 1 ? 'es' : ''}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-red-600 font-bold">✗</span>
            <span className="text-gray-700">{result.mismatches} conflict{result.mismatches !== 1 ? 's' : ''}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-gray-400 font-bold">?</span>
            <span className="text-gray-700">{result.unknowns} unverified</span>
          </span>
        </div>
        <div className="ml-auto text-xs text-gray-400">
          Click a ✗ cell to keep your notation or accept the official one
        </div>
      </div>

      {/* Side toggle */}
      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
        {(['away', 'home'] as const).map(s => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setOpenCell(null);
            }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              side === s ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'away' ? awayTeamName : homeTeamName}
          </button>
        ))}
      </div>

      {/* Grid */}
      {rows.length === 0 ? (
        <div className="text-sm italic text-gray-500 bg-white border border-gray-200 rounded-lg p-4">
          No batters were parsed for this side of the card.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="text-sm border-collapse">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide text-xs">
              <tr>
                <th className="text-left px-3 py-2 whitespace-nowrap">Batter</th>
                {innings.map(i => (
                  <th key={i} className="text-center px-2 py-2 min-w-14">
                    {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, batterIdx) => (
                <tr key={batterIdx}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    {row.unmatched ? (
                      <div className="text-[10px] text-amber-600">no official match</div>
                    ) : (
                      row.matchedOfficialName &&
                      row.matchedOfficialName.toLowerCase() !== row.name.toLowerCase() && (
                        <div className="text-[10px] text-gray-400">= {row.matchedOfficialName}</div>
                      )
                    )}
                  </td>
                  {innings.map(inning => {
                    const cells = row.atBats.filter(ab => ab.inning === inning);
                    return (
                      <td key={inning} className="px-1 py-1 text-center align-top">
                        <div className="flex flex-col gap-1">
                          {cells.map(ab => {
                            const key = cellKey(side, batterIdx, ab.inning, ab.slot);
                            const isOpen = openCell?.key === key;
                            return (
                              <div key={ab.slot} className="relative">
                                <div
                                  onClick={() => handleCellClick(row, batterIdx, ab)}
                                  className={`rounded px-1.5 py-1 text-xs ${cellClasses(ab)}`}
                                  title={ab.officialDescription}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <VerdictMark ab={ab} />
                                    <span className="font-semibold tabular-nums">
                                      {ab.resolution === 'official' ? ab.official : (ab.mine ?? '—')}
                                    </span>
                                  </div>
                                  {ab.verdict === 'mismatch' && !ab.resolution && (
                                    <div className="text-[10px] text-red-500 mt-0.5">off: {ab.official}</div>
                                  )}
                                  {ab.verdict === 'unknown' && ab.official && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">off: {ab.official}</div>
                                  )}
                                </div>

                                {/* Resolution popover */}
                                {isOpen && (
                                  <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-left">
                                    <div className="text-xs text-gray-700 space-y-1">
                                      <div>
                                        <span className="font-semibold">You:</span> {ab.mine ?? '—'}
                                      </div>
                                      <div>
                                        <span className="font-semibold">Official:</span> {ab.official}
                                      </div>
                                      {ab.officialDescription && (
                                        <div className="text-[10px] text-gray-500">{ab.officialDescription}</div>
                                      )}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={() => {
                                          onResolve(key, 'mine');
                                          setOpenCell(null);
                                        }}
                                        className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                      >
                                        Keep mine
                                      </button>
                                      <button
                                        onClick={() => {
                                          onResolve(key, 'official', ab.official);
                                          setOpenCell(null);
                                        }}
                                        className="flex-1 text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                                      >
                                        Use official
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batters on the official card the user didn't score */}
      {officialOnlyForSide.length > 0 && (
        <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="font-semibold text-amber-800">On the official card but not on yours: </span>
          {officialOnlyForSide.map(o => o.name).join(', ')}
        </div>
      )}
    </div>
  );
}
