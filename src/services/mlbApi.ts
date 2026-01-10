import type { Game, MLBScheduleResponse, Team, MLBTeamsResponse, BoxScore, BatterStats, PitcherStats, PlayByPlay, PlayEvent, InningPlays } from '../types';

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

export async function getPlayByPlay(gamePk: number): Promise<PlayByPlay> {
  const response = await fetch(
    `${MLB_API_V11}/game/${gamePk}/feed/live`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch play-by-play');
  }

  const data = await response.json();
  const allPlays = data.liveData?.plays?.allPlays || [];
  const gameData = data.gameData;

  const awayTeam = gameData?.teams?.away?.name || 'Away';
  const homeTeam = gameData?.teams?.home?.name || 'Home';

  // Group plays by inning
  const inningsMap = new Map<number, InningPlays>();

  for (const play of allPlays) {
    const inning = play.about?.inning || 1;
    const halfInning = play.about?.halfInning === 'top' ? 'top' : 'bottom';

    if (!inningsMap.has(inning)) {
      inningsMap.set(inning, { inning, top: [], bottom: [] });
    }

    const inningData = inningsMap.get(inning)!;

    // Get the result from the play
    const result = play.result || {};
    const matchup = play.matchup || {};

    const playEvent: PlayEvent = {
      inning,
      halfInning,
      batter: matchup.batter?.fullName || 'Unknown',
      batterId: matchup.batter?.id || 0,
      pitcher: matchup.pitcher?.fullName || 'Unknown',
      result: result.event || '',
      resultCode: result.eventType || '',
      description: result.description || '',
      rbi: result.rbi || 0,
      runsScored: play.runners?.filter((r: any) => r.movement?.end === 'score').length || 0,
      outs: play.count?.outs || 0,
      isOut: result.isOut || false,
      isHit: ['Single', 'Double', 'Triple', 'Home Run'].includes(result.event || ''),
    };

    if (halfInning === 'top') {
      inningData.top.push(playEvent);
    } else {
      inningData.bottom.push(playEvent);
    }
  }

  // Convert map to sorted array
  const innings = Array.from(inningsMap.values()).sort((a, b) => a.inning - b.inning);

  return {
    innings,
    awayTeam,
    homeTeam,
  };
}

// Convert MLB event to standard scorecard notation
export function eventToScorecardNotation(event: string, _eventType?: string): string {
  const notationMap: Record<string, string> = {
    'Strikeout': 'K',
    'Strikeout Looking': 'Ⓚ',
    'Walk': 'BB',
    'Intentional Walk': 'IBB',
    'Hit By Pitch': 'HBP',
    'Single': '1B',
    'Double': '2B',
    'Triple': '3B',
    'Home Run': 'HR',
    'Groundout': 'GO',
    'Flyout': 'FO',
    'Lineout': 'LO',
    'Pop Out': 'PO',
    'Forceout': 'FC',
    'Fielders Choice': 'FC',
    'Sac Fly': 'SF',
    'Sac Bunt': 'SAC',
    'Double Play': 'DP',
    'Triple Play': 'TP',
    'Field Error': 'E',
  };

  return notationMap[event] || event;
}
