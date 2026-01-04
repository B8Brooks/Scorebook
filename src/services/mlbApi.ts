import type { Game, MLBScheduleResponse, Team, MLBTeamsResponse, BoxScore, BatterStats, PitcherStats } from '../types';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
const MLB_API_V11 = 'https://statsapi.mlb.com/api/v1.1';

export async function getGamesByDate(date: string): Promise<Game[]> {
  const response = await fetch(
    `${MLB_API_BASE}/schedule?sportId=1&date=${date}&hydrate=team,venue`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch games');
  }

  const data: MLBScheduleResponse = await response.json();

  if (!data.dates || data.dates.length === 0) {
    return [];
  }

  return data.dates[0].games;
}

export async function getGamesByDateRange(startDate: string, endDate: string): Promise<Game[]> {
  const response = await fetch(
    `${MLB_API_BASE}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=team,venue`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch games');
  }

  const data: MLBScheduleResponse = await response.json();

  if (!data.dates || data.dates.length === 0) {
    return [];
  }

  return data.dates.flatMap(d => d.games);
}

export async function getTeams(): Promise<Team[]> {
  const response = await fetch(`${MLB_API_BASE}/teams?sportId=1`);

  if (!response.ok) {
    throw new Error('Failed to fetch teams');
  }

  const data: MLBTeamsResponse = await response.json();
  return data.teams;
}

export async function searchGames(
  date: string,
  teamId?: number
): Promise<Game[]> {
  let url = `${MLB_API_BASE}/schedule?sportId=1&date=${date}&hydrate=team,venue`;

  if (teamId) {
    url += `&teamId=${teamId}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to search games');
  }

  const data: MLBScheduleResponse = await response.json();

  if (!data.dates || data.dates.length === 0) {
    return [];
  }

  return data.dates[0].games;
}

export async function getBoxScore(gamePk: number): Promise<BoxScore> {
  const response = await fetch(
    `${MLB_API_V11}/game/${gamePk}/feed/live`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch box score');
  }

  const data = await response.json();
  const boxscore = data.liveData?.boxscore;
  const linescore = data.liveData?.linescore;

  if (!boxscore) {
    throw new Error('Box score not available');
  }

  const parseTeamBatters = (teamData: any): BatterStats[] => {
    const batters = teamData.batters || [];
    const players = teamData.players || {};

    return batters
      .map((id: number) => {
        const player = players[`ID${id}`];
        if (!player || !player.stats?.batting) return null;

        const batting = player.stats.batting;
        const position = player.position?.abbreviation || '';

        return {
          name: player.person?.fullName || 'Unknown',
          position,
          ab: batting.atBats || 0,
          r: batting.runs || 0,
          h: batting.hits || 0,
          rbi: batting.rbi || 0,
          bb: batting.baseOnBalls || 0,
          so: batting.strikeOuts || 0,
          avg: batting.avg || '.000',
        };
      })
      .filter((b: BatterStats | null): b is BatterStats => b !== null && b.ab > 0);
  };

  const parseTeamPitchers = (teamData: any): PitcherStats[] => {
    const pitchers = teamData.pitchers || [];
    const players = teamData.players || {};

    return pitchers
      .map((id: number) => {
        const player = players[`ID${id}`];
        if (!player || !player.stats?.pitching) return null;

        const pitching = player.stats.pitching;

        return {
          name: player.person?.fullName || 'Unknown',
          ip: pitching.inningsPitched || '0.0',
          h: pitching.hits || 0,
          r: pitching.runs || 0,
          er: pitching.earnedRuns || 0,
          bb: pitching.baseOnBalls || 0,
          so: pitching.strikeOuts || 0,
          era: pitching.era || '0.00',
          decision: pitching.note || undefined,
        };
      })
      .filter((p: PitcherStats | null): p is PitcherStats => p !== null);
  };

  const innings = linescore?.innings?.map((i: any) => ({
    away: i.away?.runs || 0,
    home: i.home?.runs || 0,
  })) || [];

  return {
    away: {
      batters: parseTeamBatters(boxscore.teams?.away),
      pitchers: parseTeamPitchers(boxscore.teams?.away),
      totals: {
        r: boxscore.teams?.away?.teamStats?.batting?.runs || 0,
        h: boxscore.teams?.away?.teamStats?.batting?.hits || 0,
        e: boxscore.teams?.away?.teamStats?.fielding?.errors || 0,
      },
    },
    home: {
      batters: parseTeamBatters(boxscore.teams?.home),
      pitchers: parseTeamPitchers(boxscore.teams?.home),
      totals: {
        r: boxscore.teams?.home?.teamStats?.batting?.runs || 0,
        h: boxscore.teams?.home?.teamStats?.batting?.hits || 0,
        e: boxscore.teams?.home?.teamStats?.fielding?.errors || 0,
      },
    },
    innings: innings.map((i: { away: number; home: number }) => i.away + i.home),
  };
}
