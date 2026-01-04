import { useState, useEffect } from 'react';
import type { BoxScore, Game } from '../types';
import { getBoxScore } from '../services/mlbApi';

interface GameStatsProps {
  game: Game;
}

export function GameStats({ game }: GameStatsProps) {
  const [boxScore, setBoxScore] = useState<BoxScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'away' | 'home'>('away');

  useEffect(() => {
    setLoading(true);
    setError(null);

    getBoxScore(game.gamePk)
      .then(setBoxScore)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [game.gamePk]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Loading game stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load game stats: {error}
      </div>
    );
  }

  if (!boxScore) {
    return null;
  }

  const teamData = activeTab === 'away' ? boxScore.away : boxScore.home;
  const teamName = activeTab === 'away' ? game.teams.away.team.name : game.teams.home.team.name;

  return (
    <div className="space-y-4">
      {/* Team Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('away')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'away'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {game.teams.away.team.name}
        </button>
        <button
          onClick={() => setActiveTab('home')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'home'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {game.teams.home.team.name}
        </button>
      </div>

      {/* Batting Stats */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Batting - {teamName}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-3">Player</th>
                <th className="text-center py-2 px-2">AB</th>
                <th className="text-center py-2 px-2">R</th>
                <th className="text-center py-2 px-2">H</th>
                <th className="text-center py-2 px-2">RBI</th>
                <th className="text-center py-2 px-2">BB</th>
                <th className="text-center py-2 px-2">SO</th>
                <th className="text-center py-2 px-2">AVG</th>
              </tr>
            </thead>
            <tbody>
              {teamData.batters.map((batter, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 px-3">
                    <span className="font-medium">{batter.name}</span>
                    <span className="text-gray-500 ml-1 text-xs">{batter.position}</span>
                  </td>
                  <td className="text-center py-2 px-2">{batter.ab}</td>
                  <td className="text-center py-2 px-2">{batter.r}</td>
                  <td className="text-center py-2 px-2">{batter.h}</td>
                  <td className="text-center py-2 px-2">{batter.rbi}</td>
                  <td className="text-center py-2 px-2">{batter.bb}</td>
                  <td className="text-center py-2 px-2">{batter.so}</td>
                  <td className="text-center py-2 px-2">{batter.avg}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-2 px-3">Totals</td>
                <td className="text-center py-2 px-2">
                  {teamData.batters.reduce((sum, b) => sum + b.ab, 0)}
                </td>
                <td className="text-center py-2 px-2">{teamData.totals.r}</td>
                <td className="text-center py-2 px-2">{teamData.totals.h}</td>
                <td className="text-center py-2 px-2">
                  {teamData.batters.reduce((sum, b) => sum + b.rbi, 0)}
                </td>
                <td className="text-center py-2 px-2">
                  {teamData.batters.reduce((sum, b) => sum + b.bb, 0)}
                </td>
                <td className="text-center py-2 px-2">
                  {teamData.batters.reduce((sum, b) => sum + b.so, 0)}
                </td>
                <td className="text-center py-2 px-2">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pitching Stats */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Pitching - {teamName}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-3">Pitcher</th>
                <th className="text-center py-2 px-2">IP</th>
                <th className="text-center py-2 px-2">H</th>
                <th className="text-center py-2 px-2">R</th>
                <th className="text-center py-2 px-2">ER</th>
                <th className="text-center py-2 px-2">BB</th>
                <th className="text-center py-2 px-2">SO</th>
                <th className="text-center py-2 px-2">ERA</th>
              </tr>
            </thead>
            <tbody>
              {teamData.pitchers.map((pitcher, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 px-3">
                    <span className="font-medium">{pitcher.name}</span>
                    {pitcher.decision && (
                      <span className="text-green-600 ml-1 text-xs">({pitcher.decision})</span>
                    )}
                  </td>
                  <td className="text-center py-2 px-2">{pitcher.ip}</td>
                  <td className="text-center py-2 px-2">{pitcher.h}</td>
                  <td className="text-center py-2 px-2">{pitcher.r}</td>
                  <td className="text-center py-2 px-2">{pitcher.er}</td>
                  <td className="text-center py-2 px-2">{pitcher.bb}</td>
                  <td className="text-center py-2 px-2">{pitcher.so}</td>
                  <td className="text-center py-2 px-2">{pitcher.era}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Game Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div className="text-center">
            <div className="text-sm text-gray-500">{game.teams.away.team.name}</div>
            <div className="text-2xl font-bold">{boxScore.away.totals.r}</div>
          </div>
          <div className="text-gray-400">vs</div>
          <div className="text-center">
            <div className="text-sm text-gray-500">{game.teams.home.team.name}</div>
            <div className="text-2xl font-bold">{boxScore.home.totals.r}</div>
          </div>
        </div>
        <div className="mt-3 text-center text-sm text-gray-500">
          R: {boxScore.away.totals.r}-{boxScore.home.totals.r} |
          H: {boxScore.away.totals.h}-{boxScore.home.totals.h} |
          E: {boxScore.away.totals.e}-{boxScore.home.totals.e}
        </div>
      </div>
    </div>
  );
}
