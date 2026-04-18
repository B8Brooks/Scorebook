import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Team,
  ProbablePitcherInfo,
  PitcherScoutingReport,
} from '../types';
import {
  getTeams,
  getProbablePitchers,
  getTeamRelievers,
  getPitcherScoutingReport,
} from '../services/mlbApi';
import { PitcherCard, type PitcherCardMode } from './PitcherCard';

const RED_SOX_ID = 111;

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Scouting() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [date, setDate] = useState<string>(todayIso());
  const [teamId, setTeamId] = useState<number>(RED_SOX_ID);
  const [mode, setMode] = useState<PitcherCardMode>('full');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probable, setProbable] = useState<ProbablePitcherInfo | null>(null);
  const [homeStarter, setHomeStarter] = useState<PitcherScoutingReport | null>(null);
  const [awayStarter, setAwayStarter] = useState<PitcherScoutingReport | null>(null);
  const [bullpen, setBullpen] = useState<PitcherScoutingReport[]>([]);
  const [opponentName, setOpponentName] = useState<string>('');

  const currentSeason = useMemo(() => new Date(date + 'T12:00:00').getFullYear(), [date]);

  useEffect(() => {
    getTeams()
      .then(ts => {
        const sorted = [...ts].sort((a, b) => a.name.localeCompare(b.name));
        setTeams(sorted);
      })
      .catch(() => setTeams([]));
  }, []);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProbable(null);
    setHomeStarter(null);
    setAwayStarter(null);
    setBullpen([]);
    setOpponentName('');

    try {
      const info = await getProbablePitchers(date, teamId);
      if (!info) {
        setError(`No game found for the selected team on ${formatDate(date)}.`);
        return;
      }
      setProbable(info);

      const opponentSide = info.home.teamId === teamId ? info.away : info.home;
      setOpponentName(opponentSide.teamName);

      const tasks: Array<Promise<void>> = [];

      if (info.home.probablePitcherId) {
        tasks.push(
          getPitcherScoutingReport(info.home.probablePitcherId, currentSeason).then(setHomeStarter)
        );
      }
      if (info.away.probablePitcherId) {
        tasks.push(
          getPitcherScoutingReport(info.away.probablePitcherId, currentSeason).then(setAwayStarter)
        );
      }

      const bullpenTask = getTeamRelievers(opponentSide.teamId, currentSeason)
        .then(async rankings => {
          const reports = await Promise.all(
            rankings.map(r => getPitcherScoutingReport(r.id, currentSeason))
          );
          setBullpen(reports);
        })
        .catch(() => setBullpen([]));
      tasks.push(bullpenTask);

      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scouting report');
    } finally {
      setLoading(false);
    }
  }, [date, teamId, currentSeason]);

  const handlePrint = () => {
    window.print();
  };

  const hasReport = probable !== null;
  const matchupHeader = probable
    ? `${probable.away.teamName} @ ${probable.home.teamName}`
    : '';

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Pitcher Scouting Report</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pull probable starters and the opposing bullpen from the MLB Stats API.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Team
            </label>
            <select
              value={teamId}
              onChange={e => setTeamId(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {teams.length === 0 && <option value={RED_SOX_ID}>Boston Red Sox</option>}
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleLoad}
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                loading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {loading ? 'Loading...' : 'Load Scouting Report'}
            </button>
          </div>
        </div>

        {hasReport && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">View:</span>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              {(['full', 'print', 'text'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m === 'full' ? 'Full' : m === 'print' ? 'One-pager' : 'Text'}
                </button>
              ))}
            </div>
            <button
              onClick={handlePrint}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              title="Print scouting report"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Report */}
      {hasReport && (
        <div className={`scouting-report ${mode === 'print' ? 'print-page space-y-3' : 'space-y-6'}`}>
          {/* Matchup header */}
          <div className={`bg-white rounded-xl border border-gray-200 ${mode === 'print' ? 'p-3' : 'p-5 shadow-sm'}`}>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <div className={`${mode === 'print' ? 'text-sm' : 'text-base'} text-gray-500 uppercase tracking-wide font-semibold`}>
                  Scouting Report
                </div>
                <div className={`${mode === 'print' ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>
                  {matchupHeader}
                </div>
              </div>
              <div className={`text-right ${mode === 'print' ? 'text-xs' : 'text-sm'} text-gray-600`}>
                <div>{probable && formatDate(probable.gameDate.slice(0, 10))}</div>
                {probable?.venue && <div className="text-gray-500">{probable.venue}</div>}
              </div>
            </div>
          </div>

          {/* Starters */}
          <div>
            <h3 className={`font-bold text-gray-900 mb-2 ${mode === 'print' ? 'text-sm' : 'text-lg'}`}>
              Probable Starters
            </h3>
            <div className={`grid gap-3 ${mode === 'print' ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
              {awayStarter ? (
                <PitcherCard
                  report={awayStarter}
                  role="Starter"
                  label={`Away Starter — ${probable!.away.teamName}`}
                  mode={mode}
                  currentSeason={currentSeason}
                />
              ) : (
                <TBACard label={`Away Starter — ${probable!.away.teamName}`} mode={mode} name={probable!.away.probablePitcherName} />
              )}
              {homeStarter ? (
                <PitcherCard
                  report={homeStarter}
                  role="Starter"
                  label={`Home Starter — ${probable!.home.teamName}`}
                  mode={mode}
                  currentSeason={currentSeason}
                />
              ) : (
                <TBACard label={`Home Starter — ${probable!.home.teamName}`} mode={mode} name={probable!.home.probablePitcherName} />
              )}
            </div>
          </div>

          {/* Bullpen */}
          <div>
            <h3 className={`font-bold text-gray-900 mb-2 ${mode === 'print' ? 'text-sm' : 'text-lg'}`}>
              Opposing Bullpen — {opponentName} (Top 3)
            </h3>
            {bullpen.length === 0 ? (
              <div className="text-sm italic text-gray-500 bg-white rounded-xl border border-gray-200 p-4">
                No reliever data available for this opponent.
              </div>
            ) : (
              <div className={`grid gap-3 ${mode === 'print' ? 'grid-cols-3' : 'grid-cols-1 lg:grid-cols-3'}`}>
                {bullpen.map((r, i) => (
                  <PitcherCard
                    key={r.bio.id}
                    report={r}
                    role="Reliever"
                    label={i === 0 ? 'Likely Closer' : `Reliever #${i + 1}`}
                    mode={mode}
                    currentSeason={currentSeason}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TBACard({ label, mode, name }: { label: string; mode: PitcherCardMode; name?: string }) {
  const compact = mode === 'print';
  return (
    <div className={`pitcher-card bg-white rounded-lg border border-dashed border-gray-300 ${compact ? 'p-3' : 'p-5'} flex flex-col items-center justify-center text-center min-h-[120px]`}>
      <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-500 uppercase tracking-wide`}>
        {label}
      </div>
      <div className={`mt-2 ${compact ? 'text-sm' : 'text-base'} font-semibold text-gray-700`}>
        {name ?? 'TBA'}
      </div>
      <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-400 italic mt-1`}>
        No scouting data
      </div>
    </div>
  );
}
