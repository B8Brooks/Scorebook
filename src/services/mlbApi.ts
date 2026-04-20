import type {
  Game,
  MLBScheduleResponse,
  Team,
  MLBTeamsResponse,
  BoxScore,
  BatterStats,
  PitcherStats,
  PlayByPlay,
  PlayEvent,
  InningPlays,
  ProbablePitcherInfo,
  PitcherScoutingReport,
  HandednessSplit,
  PitchArsenalItem,
  PitcherSeasonStats,
  PitcherBio,
  RelieverRanking,
  BatterLineupEntry,
  TeamLineup,
} from '../types';

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

// Position name to number mapping
const positionToNumber: Record<string, string> = {
  'pitcher': '1',
  'catcher': '2',
  'first baseman': '3',
  'second baseman': '4',
  'third baseman': '5',
  'shortstop': '6',
  'left fielder': '7',
  'center fielder': '8',
  'right fielder': '9',
  'designated hitter': 'DH',
};

// Extract fielder positions from play description
function parseFieldingPlay(description: string): string | null {
  const lowerDesc = description.toLowerCase();

  // Pattern for errors: "reaches on a fielding error by {position}" or "error by {position}"
  // Example: "reaches on a fielding error by third baseman DJ LeMahieu"
  const errorMatch = lowerDesc.match(/error by\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (errorMatch) {
    const pos = positionToNumber[errorMatch[1]];
    if (pos) return `E${pos}`;
  }

  // Pattern for groundouts with assist: "grounds out, {position} {name} to {position}"
  // Example: "grounds out, third baseman DJ LeMahieu to first baseman Ben Rice"
  const groundoutAssistMatch = lowerDesc.match(/grounds out,?\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder).*?\s+to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (groundoutAssistMatch) {
    const pos1 = positionToNumber[groundoutAssistMatch[1]];
    const pos2 = positionToNumber[groundoutAssistMatch[2]];
    if (pos1 && pos2) return `${pos1}-${pos2}`;
  }

  // Pattern for unassisted groundouts: "grounds out to {position}"
  const groundoutUnassistedMatch = lowerDesc.match(/grounds out to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (groundoutUnassistedMatch) {
    const pos = positionToNumber[groundoutUnassistedMatch[1]];
    if (pos) return `${pos}U`;
  }

  // Pattern for fly outs: "flies out to {position}" or "flied out to {position}"
  const flyoutMatch = lowerDesc.match(/(?:flies|flied) out (?:(?:sharply|softly|deeply) )?to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (flyoutMatch) {
    const pos = positionToNumber[flyoutMatch[1]];
    if (pos) return `F${pos}`;
  }

  // Pattern for line outs: "lines out to {position}"
  const lineoutMatch = lowerDesc.match(/(?:lines|lined) out (?:(?:sharply|softly) )?to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (lineoutMatch) {
    const pos = positionToNumber[lineoutMatch[1]];
    if (pos) return `L${pos}`;
  }

  // Pattern for pop outs: "pops out to {position}"
  const popoutMatch = lowerDesc.match(/(?:pops|popped) out to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (popoutMatch) {
    const pos = positionToNumber[popoutMatch[1]];
    if (pos) return `P${pos}`;
  }

  // Pattern for double plays: "double play, {pos} to {pos} to {pos}"
  const dpMatch = lowerDesc.match(/double play,?\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop).*?\s+to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop).*?\s+to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (dpMatch) {
    const pos1 = positionToNumber[dpMatch[1]];
    const pos2 = positionToNumber[dpMatch[2]];
    const pos3 = positionToNumber[dpMatch[3]];
    if (pos1 && pos2 && pos3) return `${pos1}-${pos2}-${pos3}`;
  }

  // Pattern for sacrifice flies: "sacrifice fly to {position}"
  const sacFlyMatch = lowerDesc.match(/sacrifice fly to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (sacFlyMatch) {
    const pos = positionToNumber[sacFlyMatch[1]];
    if (pos) return `SF${pos}`;
  }

  // Pattern for force outs: "out, {position} to {position}"
  const forceoutMatch = lowerDesc.match(/out,?\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop).*?\s+to\s+(pitcher|catcher|first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder)/);
  if (forceoutMatch) {
    const pos1 = positionToNumber[forceoutMatch[1]];
    const pos2 = positionToNumber[forceoutMatch[2]];
    if (pos1 && pos2) return `${pos1}-${pos2}`;
  }

  return null;
}

// Convert MLB event to standard scorecard notation
export function eventToScorecardNotation(event: string, description?: string): string {
  // First try to parse fielding positions from description
  if (description) {
    const fieldingNotation = parseFieldingPlay(description);
    if (fieldingNotation) return fieldingNotation;
  }

  // Fallback to basic notation
  const notationMap: Record<string, string> = {
    'Strikeout': 'K',
    'Strikeout Looking': 'Ⓚ',
    'Strikeout Swinging': 'K',
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
    'Fielders Choice Out': 'FC',
    'Sac Fly': 'SF',
    'Sac Bunt': 'SAC',
    'Sacrifice Bunt': 'SAC',
    'Bunt Groundout': 'SAC',
    'Double Play': 'DP',
    'Grounded Into DP': 'GDP',
    'Triple Play': 'TP',
    'Field Error': 'E',
    'Error': 'E',
    'Catcher Interference': 'CI',
    'Runner Out': 'RO',
  };

  return notationMap[event] || event;
}

// ---------- Pitcher Scouting ----------

export async function getProbablePitchers(
  date: string,
  teamId: number
): Promise<ProbablePitcherInfo | null> {
  const response = await fetch(
    `${MLB_API_BASE}/schedule?sportId=1&teamId=${teamId}&date=${date}&hydrate=probablePitcher,team,venue`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch probable pitchers');
  }

  const data = await response.json();
  const game = data?.dates?.[0]?.games?.[0];
  if (!game) return null;

  const parseSide = (side: any) => ({
    teamId: side?.team?.id ?? 0,
    teamName: side?.team?.name ?? 'Unknown',
    probablePitcherId: side?.probablePitcher?.id,
    probablePitcherName: side?.probablePitcher?.fullName,
  });

  return {
    gamePk: game.gamePk,
    gameDate: game.gameDate,
    venue: game.venue?.name,
    home: parseSide(game.teams?.home),
    away: parseSide(game.teams?.away),
  };
}

function parseFloatSafe(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseIp(ip: unknown): number {
  const s = String(ip ?? '0');
  const [whole, frac] = s.split('.');
  const w = parseInt(whole, 10) || 0;
  const f = parseInt(frac || '0', 10) || 0;
  return w + f / 3;
}

export async function getTeamRelievers(
  teamId: number,
  season: number
): Promise<RelieverRanking[]> {
  const response = await fetch(
    `${MLB_API_BASE}/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(group=[pitching],type=[season],season=${season}))`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch team roster');
  }

  const data = await response.json();
  const roster = data?.roster ?? [];

  const candidates: Array<{
    id: number;
    name: string;
    ip: number;
    era: number;
    k9: number;
    saves: number;
    holds: number;
    gs: number;
    gp: number;
  }> = [];

  for (const entry of roster) {
    if (entry?.position?.code !== '1') continue; // pitchers only
    const person = entry.person || {};
    const statsBlock = (person.stats || []).find(
      (s: any) => s?.group?.displayName === 'pitching' && s?.type?.displayName === 'season'
    );
    const stat = statsBlock?.splits?.[0]?.stat;
    if (!stat) continue;

    const gp = stat.gamesPlayed ?? 0;
    const gs = stat.gamesStarted ?? 0;
    if (gp < 1) continue;
    if (gs / Math.max(gp, 1) >= 0.25) continue; // skip starters

    candidates.push({
      id: person.id,
      name: person.fullName,
      ip: parseIp(stat.inningsPitched),
      era: parseFloatSafe(stat.era),
      k9: parseFloatSafe(stat.strikeoutsPer9Inn ?? stat.strikeOutsPer9Inn),
      saves: stat.saves ?? 0,
      holds: stat.holds ?? 0,
      gs,
      gp,
    });
  }

  // Saves dominate (closer signal); holds identify setup men;
  // K/9 and ERA are tiebreakers within a role tier.
  const ranked = candidates.map(c => {
    let score =
      c.saves * 5 +
      c.holds * 1.5 +
      c.k9 * 0.4 +
      (5.0 - c.era) * 0.3;
    if (c.ip < 5) score *= 0.5; // small-sample penalty
    return { id: c.id, name: c.name, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 4);
}

function parseBio(person: any): PitcherBio {
  const code = person?.pitchHand?.code;
  const pitchHand: 'L' | 'R' | 'S' =
    code === 'L' || code === 'R' || code === 'S' ? code : 'R';
  return {
    id: person?.id ?? 0,
    fullName: person?.fullName ?? 'Unknown',
    pitchHand,
    age: person?.currentAge,
    currentTeam: person?.currentTeam?.name,
    primaryNumber: person?.primaryNumber,
  };
}

function parseSeasonStats(stat: any): PitcherSeasonStats | null {
  if (!stat) return null;
  return {
    w: stat.wins ?? 0,
    l: stat.losses ?? 0,
    era: String(stat.era ?? '0.00'),
    gamesPlayed: stat.gamesPlayed ?? 0,
    gamesStarted: stat.gamesStarted ?? 0,
    saves: stat.saves ?? 0,
    holds: stat.holds ?? 0,
    ip: String(stat.inningsPitched ?? '0.0'),
    so: stat.strikeOuts ?? 0,
    bb: stat.baseOnBalls ?? 0,
    whip: String(stat.whip ?? '0.00'),
    k9: stat.strikeoutsPer9Inn != null
      ? String(stat.strikeoutsPer9Inn)
      : stat.strikeOutsPer9Inn != null
        ? String(stat.strikeOutsPer9Inn)
        : undefined,
    kPct: computePct(stat.strikeOuts, stat.battersFaced ?? stat.plateAppearances),
    bbPct: computePct(stat.baseOnBalls, stat.battersFaced ?? stat.plateAppearances),
    hr9: computeHr9(stat.homeRuns, stat.inningsPitched),
    goAoRatio:
      stat.groundOutsToAirouts != null
        ? String(stat.groundOutsToAirouts)
        : stat.groundOutsToAirOuts != null
          ? String(stat.groundOutsToAirOuts)
          : undefined,
  };
}

function computePct(num: unknown, denom: unknown): number | undefined {
  const n = typeof num === 'number' ? num : parseFloat(String(num ?? ''));
  const d = typeof denom === 'number' ? denom : parseFloat(String(denom ?? ''));
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return undefined;
  return Math.round((n / d) * 1000) / 10; // one decimal
}

function computeHr9(hrRaw: unknown, ipRaw: unknown): number | undefined {
  const hr = typeof hrRaw === 'number' ? hrRaw : parseFloat(String(hrRaw ?? ''));
  const ip = parseIp(ipRaw);
  if (!Number.isFinite(hr) || ip <= 0) return undefined;
  return Math.round((hr * 9 / ip) * 100) / 100;
}

function parseSplit(split: any, vs: 'RHB' | 'LHB'): HandednessSplit | null {
  const stat = split?.stat;
  if (!stat) return null;
  return {
    vs,
    avg: String(stat.avg ?? '.000'),
    obp: String(stat.obp ?? '.000'),
    slg: String(stat.slg ?? '.000'),
    ops: String(stat.ops ?? '.000'),
    pa: stat.plateAppearances ?? stat.battersFaced ?? stat.atBats ?? 0,
    so: stat.strikeOuts ?? 0,
    bb: stat.baseOnBalls ?? 0,
    hr: stat.homeRuns ?? 0,
  };
}

function parseArsenal(splits: any[]): PitchArsenalItem[] {
  if (!splits) return [];
  return splits
    .map(s => {
      const stat = s?.stat ?? {};
      const pt = stat.type ?? stat.pitchType ?? {};
      const rawUsage = parseFloatSafe(
        stat.percentage ?? stat.percentOccurrence ?? stat.percent
      );
      const usagePct = rawUsage > 1 ? rawUsage : rawUsage * 100;
      return {
        pitchType: pt.code ?? pt.abbreviation ?? '??',
        pitchName: pt.description ?? pt.displayName ?? 'Unknown',
        usagePct,
        avgVelo: stat.averageSpeed != null ? parseFloatSafe(stat.averageSpeed) : undefined,
        avgSpin: stat.averageSpinRate != null ? parseFloatSafe(stat.averageSpinRate) : undefined,
      };
    })
    .filter(a => a.usagePct > 0)
    .sort((a, b) => b.usagePct - a.usagePct);
}

async function fetchSplits(
  personId: number,
  season: number
): Promise<{ vsRHB: HandednessSplit | null; vsLHB: HandednessSplit | null }> {
  const tryFetch = async (codes: string): Promise<any> => {
    const res = await fetch(
      `${MLB_API_BASE}/people/${personId}/stats?stats=statSplits&group=pitching&sitCodes=${codes}&season=${season}`
    );
    if (!res.ok) return null;
    return res.json();
  };

  let data = await tryFetch('vr,vl');
  let splits: any[] = data?.stats?.[0]?.splits ?? [];
  if (splits.length === 0) {
    data = await tryFetch('vsr,vsl');
    splits = data?.stats?.[0]?.splits ?? [];
  }

  let vsRHB: HandednessSplit | null = null;
  let vsLHB: HandednessSplit | null = null;
  for (const s of splits) {
    const code = s?.split?.code ?? '';
    if (code === 'vr' || code === 'vsr') vsRHB = parseSplit(s, 'RHB');
    if (code === 'vl' || code === 'vsl') vsLHB = parseSplit(s, 'LHB');
  }
  return { vsRHB, vsLHB };
}

async function fetchArsenal(personId: number, season: number): Promise<PitchArsenalItem[]> {
  const res = await fetch(
    `${MLB_API_BASE}/people/${personId}/stats?stats=pitchArsenal&group=pitching&season=${season}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return parseArsenal(data?.stats?.[0]?.splits ?? []);
}

async function fetchPersonWithSeason(personId: number, season: number) {
  const res = await fetch(
    `${MLB_API_BASE}/people/${personId}?hydrate=stats(group=[pitching],type=[season],season=${season}),currentTeam`
  );
  if (!res.ok) throw new Error('Failed to fetch pitcher info');
  const data = await res.json();
  const person = data?.people?.[0];
  const statsBlock = (person?.stats || []).find(
    (s: any) => s?.group?.displayName === 'pitching' && s?.type?.displayName === 'season'
  );
  const stat = statsBlock?.splits?.[0]?.stat ?? null;
  return { person, stat };
}

export async function getPitcherScoutingReport(
  personId: number,
  season: number
): Promise<PitcherScoutingReport> {
  const [personResult, splitsResult, arsenalResult] = await Promise.all([
    fetchPersonWithSeason(personId, season),
    fetchSplits(personId, season),
    fetchArsenal(personId, season),
  ]);

  const bio = parseBio(personResult.person);
  let seasonStats = parseSeasonStats(personResult.stat);
  let { vsRHB, vsLHB } = splitsResult;
  let arsenal = arsenalResult;
  let seasonUsed = season;

  const currentIp = parseIp(personResult.stat?.inningsPitched);
  if (currentIp < 5) {
    // Fall back to previous season for splits/arsenal (and stats if nothing this year)
    const prev = season - 1;
    const [prevPerson, prevSplits, prevArsenal] = await Promise.all([
      fetchPersonWithSeason(personId, prev),
      fetchSplits(personId, prev),
      fetchArsenal(personId, prev),
    ]);
    const prevStats = parseSeasonStats(prevPerson.stat);
    if (prevStats) {
      seasonStats = prevStats;
      vsRHB = prevSplits.vsRHB;
      vsLHB = prevSplits.vsLHB;
      arsenal = prevArsenal;
      seasonUsed = prev;
    }
  } else if (arsenal.length === 0) {
    // Arsenal is often empty early in the season even when IP is healthy.
    // Fall back to previous season's arsenal only (keep current-season splits/stats).
    const prevArsenal = await fetchArsenal(personId, season - 1);
    if (prevArsenal.length > 0) {
      arsenal = prevArsenal;
    }
  }

  return {
    bio,
    seasonUsed,
    season: seasonStats,
    vsRHB,
    vsLHB,
    arsenal,
  };
}

// ---------- Lineups & Batter Info ----------

export async function getGameLineups(gamePk: number): Promise<{ home: TeamLineup; away: TeamLineup }> {
  const res = await fetch(`${MLB_API_V11}/game/${gamePk}/feed/live`);
  if (!res.ok) throw new Error('Failed to fetch game feed');
  const data = await res.json();
  const gameData = data?.gameData ?? {};
  const boxscore = data?.liveData?.boxscore ?? {};

  const buildSide = (sideKey: 'home' | 'away'): TeamLineup => {
    const boxSide = boxscore.teams?.[sideKey] ?? {};
    const gameSide = gameData.teams?.[sideKey] ?? {};
    const orderIds: number[] = boxSide.battingOrder ?? boxSide.batters ?? [];
    const players = boxSide.players ?? {};
    // Only take the first 9 — active substitutions extend the array late in the game.
    const order = orderIds.slice(0, 9);
    const battingOrder: BatterLineupEntry[] = order.map((id, idx) => {
      const player = players[`ID${id}`] ?? {};
      const person = player.person ?? {};
      const position = player.position?.abbreviation ?? person.primaryPosition?.abbreviation ?? '';
      const batCode = person.batSide?.code;
      const batSide: 'L' | 'R' | 'S' =
        batCode === 'L' || batCode === 'R' || batCode === 'S' ? batCode : 'R';
      return {
        orderIndex: idx + 1,
        id,
        fullName: person.fullName ?? 'Unknown',
        primaryNumber: player.jerseyNumber ?? person.primaryNumber,
        position,
        batSide,
        avg: '.000',
        obp: '.000',
        slg: '.000',
        ops: '.000',
        pa: 0,
        hr: 0,
      };
    });
    return {
      teamId: gameSide.id ?? 0,
      teamName: gameSide.name ?? '',
      posted: battingOrder.length > 0,
      battingOrder,
      bench: [],
    };
  };

  return { home: buildSide('home'), away: buildSide('away') };
}

export async function getTeamBench(
  teamId: number,
  season: number,
  starterIds: number[]
): Promise<BatterLineupEntry[]> {
  const res = await fetch(
    `${MLB_API_BASE}/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(group=[hitting],type=[season],season=${season}))`
  );
  if (!res.ok) return [];
  const data = await res.json();
  const roster = data?.roster ?? [];
  const starterSet = new Set(starterIds);

  const bench: BatterLineupEntry[] = [];
  for (const entry of roster) {
    const person = entry.person ?? {};
    if (!person.id || starterSet.has(person.id)) continue;
    const positionCode = entry.position?.code ?? person.primaryPosition?.code;
    if (positionCode === '1') continue; // skip pitchers

    const statsBlock = (person.stats ?? []).find(
      (s: any) => s?.group?.displayName === 'hitting' && s?.type?.displayName === 'season'
    );
    const stat = statsBlock?.splits?.[0]?.stat ?? null;

    const batCode = person.batSide?.code;
    const batSide: 'L' | 'R' | 'S' =
      batCode === 'L' || batCode === 'R' || batCode === 'S' ? batCode : 'R';

    bench.push({
      orderIndex: 0,
      id: person.id,
      fullName: person.fullName ?? 'Unknown',
      primaryNumber: person.primaryNumber ?? entry.jerseyNumber,
      position: entry.position?.abbreviation ?? person.primaryPosition?.abbreviation ?? '',
      batSide,
      avg: String(stat?.avg ?? '.000'),
      obp: String(stat?.obp ?? '.000'),
      slg: String(stat?.slg ?? '.000'),
      ops: String(stat?.ops ?? '.000'),
      pa: stat?.plateAppearances ?? 0,
      hr: stat?.homeRuns ?? 0,
    });
  }

  // Most-used bench pieces first.
  bench.sort((a, b) => b.pa - a.pa);
  return bench;
}

export async function getBatterInfo(
  personId: number,
  season: number
): Promise<Partial<BatterLineupEntry> & { id: number }> {
  const personRes = await fetch(
    `${MLB_API_BASE}/people/${personId}?hydrate=stats(group=[hitting],type=[season],season=${season})`
  );

  let stat: any = null;
  let person: any = null;
  if (personRes.ok) {
    const data = await personRes.json();
    person = data?.people?.[0] ?? null;
    const statsBlock = (person?.stats ?? []).find(
      (s: any) => s?.group?.displayName === 'hitting' && s?.type?.displayName === 'season'
    );
    stat = statsBlock?.splits?.[0]?.stat ?? null;
  }

  const batCode = person?.batSide?.code;
  const batSide: 'L' | 'R' | 'S' =
    batCode === 'L' || batCode === 'R' || batCode === 'S' ? batCode : 'R';

  return {
    id: personId,
    fullName: person?.fullName ?? 'Unknown',
    primaryNumber: person?.primaryNumber,
    position: person?.primaryPosition?.abbreviation ?? '',
    batSide,
    avg: String(stat?.avg ?? '.000'),
    obp: String(stat?.obp ?? '.000'),
    slg: String(stat?.slg ?? '.000'),
    ops: String(stat?.ops ?? '.000'),
    pa: stat?.plateAppearances ?? 0,
    hr: stat?.homeRuns ?? 0,
  };
}

const leagueOpsCache = new Map<number, Promise<{ ops: number }>>();

export function getLeagueHittingAverage(season: number): Promise<{ ops: number }> {
  const cached = leagueOpsCache.get(season);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch(
      `${MLB_API_BASE}/stats?stats=season&group=hitting&sportIds=1&season=${season}&gameType=R`
    );
    if (!res.ok) return { ops: 0.720 }; // reasonable fallback
    const data = await res.json();
    const stat = data?.stats?.[0]?.splits?.[0]?.stat;
    const ops = parseFloat(String(stat?.ops ?? '0.720'));
    return { ops: Number.isFinite(ops) && ops > 0 ? ops : 0.720 };
  })();
  leagueOpsCache.set(season, promise);
  return promise;
}
