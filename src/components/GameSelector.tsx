import { useState, useEffect } from 'react';
import type { Game, Team } from '../types';
import { getGamesByDate, getTeams } from '../services/mlbApi';

interface GameSelectorProps {
  onGameSelect: (game: Game) => void;
  selectedGame: Game | null;
  detectedDate?: string | null;  // YYYY-MM-DD format from OCR
}

export function GameSelector({ onGameSelect, selectedGame, detectedDate }: GameSelectorProps) {
  const [date, setDate] = useState(() => {
    // Use detected date if provided, otherwise use today
    if (detectedDate) {
      return detectedDate;
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Update date when detected date changes
  useEffect(() => {
    if (detectedDate) {
      setDate(detectedDate);
    }
  }, [detectedDate]);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    if (!date) return;

    setLoading(true);
    setError(null);

    getGamesByDate(date)
      .then((fetchedGames) => {
        let filtered = fetchedGames;
        if (selectedTeam) {
          const teamId = parseInt(selectedTeam, 10);
          filtered = fetchedGames.filter(
            (g) =>
              g.teams.home.team.id === teamId ||
              g.teams.away.team.id === teamId
          );
        }
        setGames(filtered);
      })
      .catch((err) => {
        setError(err.message);
        setGames([]);
      })
      .finally(() => setLoading(false));
  }, [date, selectedTeam]);

  const formatGameTime = (gameDate: string) => {
    return new Date(gameDate).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="game-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Game Date
          </label>
          <input
            type="date"
            id="game-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="team-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Filter by Team (optional)
          </label>
          <select
            id="team-filter"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Teams</option>
            {teams
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading games...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && games.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-600 text-center">
          No games found for this date
        </div>
      )}

      {!loading && games.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {games.map((game) => (
            <button
              key={game.gamePk}
              onClick={() => onGameSelect(game)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedGame?.gamePk === game.gamePk
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">
                    {game.teams.away.team.name} @ {game.teams.home.team.name}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {game.venue.name} - {formatGameTime(game.gameDate)}
                  </div>
                </div>
                {game.status.detailedState === 'Final' && (
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {game.teams.away.score} - {game.teams.home.score}
                    </div>
                    <div className="text-xs text-gray-500">Final</div>
                  </div>
                )}
                {game.status.detailedState !== 'Final' && (
                  <div className="text-sm text-gray-500">
                    {game.status.detailedState}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
