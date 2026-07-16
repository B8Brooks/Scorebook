export interface Team {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
}

export interface Game {
  gamePk: number;
  gameDate: string;
  status: {
    detailedState: string;
  };
  teams: {
    away: {
      team: Team;
      score?: number;
    };
    home: {
      team: Team;
      score?: number;
    };
  };
  venue: {
    name: string;
  };
}

export interface Scorecard {
  id: string;
  imageUrl: string;
  game: Game;
  createdAt: string;
  notes?: string;
  parsedData?: ParsedScorecardData;
  interpretation?: InterpretedScorecard;
  resolutions?: Record<string, 'mine' | 'official'>;
}

// AI-interpreted scorecard (Gemini full-grid read)
export interface BatterInning {
  inning: number;
  result: string; // e.g., "K", "BB", "6-3", "1B", "HR"
  rbi?: number;
  runs?: number;
}

export interface InterpretedBatter {
  name: string;
  position?: string;
  number?: string;
  atBats: BatterInning[];
}

export interface InterpretedScorecard {
  homeTeam: string | null;
  awayTeam: string | null;
  date: string | null;
  homeBatters: InterpretedBatter[];
  awayBatters: InterpretedBatter[];
  rawResponse?: string;
}

// Verification of an interpreted scorecard against the official play-by-play
export type CellVerdict = 'match' | 'mismatch' | 'unknown';

export interface VerifiedAtBat {
  inning: number;
  slot: number; // k-th PA by this batter in this inning
  mine?: string;
  official?: string;
  officialDescription?: string;
  verdict: CellVerdict;
  resolution?: 'mine' | 'official';
}

export interface VerifiedBatterRow {
  name: string;
  matchedOfficialName?: string;
  officialBatterId?: number;
  unmatched?: boolean;
  atBats: VerifiedAtBat[];
}

export interface VerificationResult {
  away: VerifiedBatterRow[];
  home: VerifiedBatterRow[];
  officialOnly: Array<{ side: 'away' | 'home'; name: string; batterId: number }>;
  matches: number;
  mismatches: number;
  unknowns: number;
  accuracyPct: number;
}

export interface MLBScheduleResponse {
  dates: Array<{
    date: string;
    games: Game[];
  }>;
}

export interface MLBTeamsResponse {
  teams: Team[];
}

// Box Score Types
export interface BatterStats {
  name: string;
  position: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  avg: string;
}

export interface PitcherStats {
  name: string;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  era: string;
  decision?: string;
}

export interface TeamBoxScore {
  batters: BatterStats[];
  pitchers: PitcherStats[];
  totals: {
    r: number;
    h: number;
    e: number;
  };
}

export interface BoxScore {
  away: TeamBoxScore;
  home: TeamBoxScore;
  innings: number[];
}

// Parsed Scorecard Types (from OCR)
export interface AtBatResult {
  inning: number;
  result: string; // e.g., "K", "1B", "BB", "6-3", "F8", etc.
  rbi?: number;
  runs?: number;
}

export interface ParsedBatter {
  name?: string;
  position?: string;
  atBats: AtBatResult[];
}

export interface ParsedScorecardData {
  batters: ParsedBatter[];
  rawText: string;
  confidence: number;
}

// Play-by-Play Types (Official MLB Data)
export interface PlayEvent {
  inning: number;
  halfInning: 'top' | 'bottom';
  batter: string;
  batterId: number;
  pitcher: string;
  result: string;
  resultCode: string;
  description: string;
  rbi: number;
  runsScored: number;
  outs: number;
  isOut: boolean;
  isHit: boolean;
}

export interface InningPlays {
  inning: number;
  top: PlayEvent[];
  bottom: PlayEvent[];
}

export interface PlayByPlay {
  innings: InningPlays[];
  awayTeam: string;
  homeTeam: string;
}

// Pitcher Scouting Types
export interface PitchArsenalItem {
  pitchType: string;
  pitchName: string;
  usagePct: number;
  avgVelo?: number;
  avgSpin?: number;
}

export interface HandednessSplit {
  vs: 'RHB' | 'LHB';
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  pa: number;
  so: number;
  bb: number;
  hr: number;
}

export interface PitcherSeasonStats {
  w: number;
  l: number;
  era: string;
  gamesPlayed: number;
  gamesStarted: number;
  saves: number;
  holds: number;
  ip: string;
  so: number;
  bb: number;
  whip: string;
  k9?: string;
  kPct?: number;
  bbPct?: number;
  hr9?: number;
  goAoRatio?: string;
}

export interface BatterLineupEntry {
  orderIndex: number;
  id: number;
  fullName: string;
  primaryNumber?: string;
  position: string;
  batSide: 'L' | 'R' | 'S';
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  opsPlus?: number;
  pa: number;
  hr: number;
}

export interface TeamLineup {
  teamId: number;
  teamName: string;
  posted: boolean;
  battingOrder: BatterLineupEntry[];
  bench: BatterLineupEntry[];
}

export interface PitcherBio {
  id: number;
  fullName: string;
  pitchHand: 'L' | 'R' | 'S';
  age?: number;
  currentTeam?: string;
  primaryNumber?: string;
}

export interface PitcherScoutingReport {
  bio: PitcherBio;
  seasonUsed: number;
  season: PitcherSeasonStats | null;
  vsRHB: HandednessSplit | null;
  vsLHB: HandednessSplit | null;
  arsenal: PitchArsenalItem[];
}

export interface ProbablePitcherSide {
  teamId: number;
  teamName: string;
  probablePitcherId?: number;
  probablePitcherName?: string;
}

export interface ProbablePitcherInfo {
  gamePk: number;
  gameDate: string;
  venue?: string;
  home: ProbablePitcherSide;
  away: ProbablePitcherSide;
}

export interface RelieverRanking {
  id: number;
  name: string;
  score: number;
  role?: string;
  tags?: string;
  source?: 'fangraphs' | 'stats';
}
