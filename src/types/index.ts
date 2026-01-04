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
