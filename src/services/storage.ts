import type { Scorecard } from '../types';
import type { InterpretedScorecard } from './gemini';

const STORAGE_KEY = 'mlb-scorecards';
const SETTINGS_KEY = 'mlb-scorebook-settings';
const TRAINING_EXAMPLES_KEY = 'mlb-scorecard-training';

export interface AppSettings {
  geminiApiKey?: string;
}

export interface TrainingExample {
  id: string;
  imageUrl: string;  // Base64 image
  interpretation: InterpretedScorecard;
  createdAt: string;
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

// Training examples functions
export function getTrainingExamples(): TrainingExample[] {
  const data = localStorage.getItem(TRAINING_EXAMPLES_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveTrainingExample(example: TrainingExample): void {
  const examples = getTrainingExamples();
  // Keep only the 3 most recent examples (to save space and keep prompt size reasonable)
  const MAX_EXAMPLES = 3;
  examples.unshift(example);
  const trimmed = examples.slice(0, MAX_EXAMPLES);
  localStorage.setItem(TRAINING_EXAMPLES_KEY, JSON.stringify(trimmed));
}

export function deleteTrainingExample(id: string): void {
  const examples = getTrainingExamples();
  const filtered = examples.filter(e => e.id !== id);
  localStorage.setItem(TRAINING_EXAMPLES_KEY, JSON.stringify(filtered));
}

export function clearTrainingExamples(): void {
  localStorage.removeItem(TRAINING_EXAMPLES_KEY);
}
