import type { Scorecard } from '../types';

const STORAGE_KEY = 'mlb-scorecards';
const SETTINGS_KEY = 'mlb-scorebook-settings';

export interface AppSettings {
  geminiApiKey?: string;
}

export function getScorecards(): Scorecard[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveScorecard(scorecard: Scorecard): void {
  const scorecards = getScorecards();
  scorecards.unshift(scorecard);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scorecards));
}

export function deleteScorecard(id: string): void {
  const scorecards = getScorecards();
  const filtered = scorecards.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function updateScorecard(id: string, updates: Partial<Scorecard>): void {
  const scorecards = getScorecards();
  const index = scorecards.findIndex(s => s.id === id);

  if (index !== -1) {
    scorecards[index] = { ...scorecards[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scorecards));
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Settings functions
export function getSettings(): AppSettings {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getGeminiApiKey(): string | null {
  const settings = getSettings();
  return settings.geminiApiKey || null;
}

export function saveGeminiApiKey(apiKey: string): void {
  const settings = getSettings();
  settings.geminiApiKey = apiKey;
  saveSettings(settings);
}
