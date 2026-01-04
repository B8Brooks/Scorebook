import type { Game, MLBScheduleResponse, Team, MLBTeamsResponse } from '../types';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

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
