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
