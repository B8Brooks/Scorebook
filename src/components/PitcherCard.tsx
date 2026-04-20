import type { PitcherScoutingReport } from '../types';
import { PitchArsenalBar } from './PitchArsenalBar';
import { SplitsTable } from './SplitsTable';

export type PitcherCardMode = 'full' | 'print' | 'text';

interface PitcherCardProps {
  report: PitcherScoutingReport;
  role: 'Starter' | 'Reliever';
  label?: string;
  mode?: PitcherCardMode;
  currentSeason: number;
}

function HandChip({ hand }: { hand: 'L' | 'R' | 'S' }) {
  const tone =
    hand === 'L'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : hand === 'R'
        ? 'bg-red-100 text-red-800 border-red-200'
        : 'bg-purple-100 text-purple-800 border-purple-200';
  return (
    <span className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${tone}`}>
      {hand}HP
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center justify-center px-1">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className="text-sm font-bold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

function SeasonStrip({
  season,
  role,
  compact,
}: {
  season: NonNullable<PitcherScoutingReport['season']>;
  role: 'Starter' | 'Reliever';
  compact: boolean;
}) {
  const cells: Array<{ label: string; value: string | number }> = [
    { label: 'W-L', value: `${season.w}-${season.l}` },
    { label: 'ERA', value: season.era },
    { label: 'IP', value: season.ip },
    { label: 'K', value: season.so },
    { label: 'BB', value: season.bb },
    { label: 'WHIP', value: season.whip },
    { label: 'K/9', value: season.k9 ?? '—' },
  ];
  if (role === 'Reliever') {
    cells.push({ label: 'SV/HLD', value: `${season.saves}/${season.holds}` });
  } else {
    cells.push({ label: 'GS', value: season.gamesStarted });
  }

  return (
    <div className={`grid ${compact ? 'grid-cols-8 gap-0.5 py-1' : 'grid-cols-4 sm:grid-cols-8 gap-1 py-2'} border-y border-gray-200 bg-gray-50 rounded`}>
      {cells.map(c => (
        <StatCell key={c.label} {...c} />
      ))}
    </div>
  );
}

function TextView({ report, role, currentSeason }: { report: PitcherScoutingReport; role: 'Starter' | 'Reliever'; currentSeason: number }) {
  const { bio, season, vsRHB, vsLHB, arsenal, seasonUsed } = report;
  return (
    <div className="font-mono text-xs text-gray-800 space-y-2">
      <div className="font-bold text-sm">
        {bio.fullName} {bio.primaryNumber ? `#${bio.primaryNumber}` : ''} ({bio.pitchHand}HP{bio.age ? `, age ${bio.age}` : ''}) — {role}
      </div>
      {seasonUsed !== currentSeason && (
        <div className="text-amber-700">(Using {seasonUsed} stats)</div>
      )}
      {season ? (
        <div>
          {seasonUsed} season: {season.w}-{season.l}, {season.era} ERA, {season.ip} IP, {season.so} K, {season.bb} BB, {season.whip} WHIP
          {role === 'Reliever' ? `, ${season.saves} SV / ${season.holds} HLD` : `, ${season.gamesStarted} GS`}
        </div>
      ) : (
        <div className="italic text-gray-500">No season stats available</div>
      )}
      <div>
        vs RHB: {vsRHB ? `${vsRHB.avg}/${vsRHB.obp}/${vsRHB.slg} (${vsRHB.ops} OPS, ${vsRHB.pa} PA, ${vsRHB.so} K, ${vsRHB.bb} BB, ${vsRHB.hr} HR)` : 'no data'}
      </div>
      <div>
        vs LHB: {vsLHB ? `${vsLHB.avg}/${vsLHB.obp}/${vsLHB.slg} (${vsLHB.ops} OPS, ${vsLHB.pa} PA, ${vsLHB.so} K, ${vsLHB.bb} BB, ${vsLHB.hr} HR)` : 'no data'}
      </div>
      {arsenal.length > 0 ? (
        <div>
          <div className="font-semibold">Arsenal:</div>
          {arsenal.map(p => (
            <div key={p.pitchType} className="pl-2">
              - {p.pitchType} ({p.pitchName}): {p.usagePct.toFixed(1)}%
              {p.avgVelo ? `, ${p.avgVelo.toFixed(1)} mph` : ''}
              {p.avgSpin ? `, ${Math.round(p.avgSpin)} rpm` : ''}
            </div>
          ))}
        </div>
      ) : (
        <div className="italic text-gray-500">No pitch arsenal data</div>
      )}
    </div>
  );
}

export function PitcherCard({ report, role, label, mode = 'full', currentSeason }: PitcherCardProps) {
  const { bio, season, vsRHB, vsLHB, arsenal, seasonUsed } = report;
  const showFallbackBadge = seasonUsed !== currentSeason;

  if (mode === 'text') {
    return (
      <div className="pitcher-card border border-gray-300 rounded p-3 bg-white">
        {label && <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>}
        <TextView report={report} role={role} currentSeason={currentSeason} />
      </div>
    );
  }

  const compact = mode === 'print';
  const cardPadding = compact ? 'p-3' : 'p-4 sm:p-5';
  const shadow = compact ? '' : 'shadow-sm';
  const borderColor = compact ? 'border-gray-300' : 'border-gray-200';

  return (
    <div className={`pitcher-card bg-white rounded-lg border ${borderColor} ${shadow} ${cardPadding} flex flex-col`}>
      {label && (
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-green-700 uppercase tracking-wide mb-1`}>
          {label}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-bold text-gray-900 ${compact ? 'text-base leading-tight' : 'text-lg'} truncate`}>
            {bio.fullName}
          </div>
          <div className={`flex items-center gap-1.5 mt-0.5 ${compact ? 'text-[10px]' : 'text-xs'} text-gray-600`}>
            {bio.primaryNumber && <span className="font-semibold">#{bio.primaryNumber}</span>}
            <HandChip hand={bio.pitchHand} />
            {bio.age != null && <span>Age {bio.age}</span>}
            {bio.currentTeam && !compact && <span className="truncate">· {bio.currentTeam}</span>}
          </div>
        </div>
        {showFallbackBadge && (
          <span className={`shrink-0 inline-flex items-center ${compact ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'} font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200`}>
            {seasonUsed} stats
          </span>
        )}
      </div>

      <div className={compact ? 'mt-2' : 'mt-3'}>
        {season ? (
          <SeasonStrip season={season} role={role} compact={compact} />
        ) : (
          <div className="text-xs italic text-gray-500 py-2">No season stats available</div>
        )}
      </div>

      <div className={compact ? 'mt-2' : 'mt-3'}>
        <SplitsTable vsRHB={vsRHB} vsLHB={vsLHB} compact={compact} />
      </div>

      <div className={compact ? 'mt-2' : 'mt-3'}>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-600 uppercase tracking-wide mb-1`}>
          Arsenal
        </div>
        <PitchArsenalBar arsenal={arsenal} compact={compact} />
      </div>
    </div>
  );
}
