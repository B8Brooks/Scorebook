import { useState, useEffect } from 'react';
import type { Game, PlayByPlay, PlayEvent } from '../types';
import { getPlayByPlay, eventToScorecardNotation } from '../services/mlbApi';

interface OfficialScorecardProps {
  game: Game;
}

export function OfficialScorecard({ game }: OfficialScorecardProps) {
  const [playByPlay, setPlayByPlay] = useState<PlayByPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'away' | 'home'>('away');
  const [expandedInning, setExpandedInning] = useState<number | null>(1);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getPlayByPlay(game.gamePk)
      .then(setPlayByPlay)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [game.gamePk]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Loading official scorecard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load play-by-play: {error}
      </div>
    );
  }

  if (!playByPlay) {
    return null;
  }

  const getPlaysForTeam = (inning: number): PlayEvent[] => {
    const inningData = playByPlay.innings.find((i) => i.inning === inning);
    if (!inningData) return [];
    return selectedTeam === 'away' ? inningData.top : inningData.bottom;
  };

  const getResultColor = (play: PlayEvent): string => {
    if (play.isHit) return 'bg-green-100 text-green-800 border-green-300';
    if (play.result === 'Walk' || play.result === 'Hit By Pitch') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (play.isOut) return 'bg-gray-100 text-gray-700 border-gray-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  // Group plays by batter across all innings
  const getBatterPlays = () => {
    const batterMap = new Map<number, { name: string; plays: { inning: number; play: PlayEvent }[] }>();

    for (const inning of playByPlay.innings) {
      const plays = selectedTeam === 'away' ? inning.top : inning.bottom;
      for (const play of plays) {
        if (!batterMap.has(play.batterId)) {
          batterMap.set(play.batterId, { name: play.batter, plays: [] });
        }
        batterMap.get(play.batterId)!.plays.push({ inning: inning.inning, play });
      }
    }

    return Array.from(batterMap.values());
  };

  const batterPlays = getBatterPlays();

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Official Play-by-Play</h3>
        <p className="text-blue-700 text-sm">
          This shows the official MLB record of every at-bat. Compare this with your handwritten scorecard to verify your scoring.
        </p>
      </div>

      {/* Team Selector */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setSelectedTeam('away')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedTeam === 'away'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {playByPlay.awayTeam}
        </button>
        <button
          onClick={() => setSelectedTeam('home')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            selectedTeam === 'home'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {playByPlay.homeTeam}
        </button>
      </div>

      {/* Scorecard Grid View */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left py-2 px-3 border border-gray-300 sticky left-0 bg-gray-100 min-w-[150px]">
                Batter
              </th>
              {playByPlay.innings.map((inning) => (
                <th
                  key={inning.inning}
                  className="text-center py-2 px-2 border border-gray-300 min-w-[60px]"
                >
                  {inning.inning}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batterPlays.map((batter, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="py-2 px-3 border border-gray-300 font-medium sticky left-0 bg-white">
                  {batter.name}
                </td>
                {playByPlay.innings.map((inning) => {
                  const play = batter.plays.find((p) => p.inning === inning.inning);
                  return (
                    <td
                      key={inning.inning}
                      className="py-1 px-1 border border-gray-300 text-center"
                    >
                      {play && (
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getResultColor(
                            play.play
                          )}`}
                          title={play.play.description}
                        >
                          {eventToScorecardNotation(play.play.result, play.play.resultCode)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inning-by-Inning Detail View */}
      <div className="mt-6">
        <h4 className="font-semibold text-gray-900 mb-3">Inning Details</h4>
        <div className="space-y-2">
          {playByPlay.innings.map((inning) => {
            const plays = getPlaysForTeam(inning.inning);
            const isExpanded = expandedInning === inning.inning;

            return (
              <div key={inning.inning} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedInning(isExpanded ? null : inning.inning)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
                >
                  <span className="font-medium">
                    {selectedTeam === 'away' ? 'Top' : 'Bottom'} of {inning.inning}
                    <span className="text-gray-500 ml-2">({plays.length} at-bats)</span>
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {plays.length === 0 ? (
                      <p className="text-gray-500 text-sm">No at-bats this inning</p>
                    ) : (
                      plays.map((play, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getResultColor(play)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{play.batter}</span>
                              <span className="text-gray-500 mx-2">vs</span>
                              <span className="text-gray-600">{play.pitcher}</span>
                            </div>
                            <span className="font-bold text-lg">
                              {eventToScorecardNotation(play.result, play.resultCode)}
                            </span>
                          </div>
                          <p className="text-sm mt-1 opacity-80">{play.description}</p>
                          {play.rbi > 0 && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                              {play.rbi} RBI
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
