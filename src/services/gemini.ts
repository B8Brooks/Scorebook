// Gemini API service for advanced OCR and scorecard interpretation

import { getTrainingExamples, type TrainingExample } from './storage';
import type { InterpretedScorecard } from '../types';

export type { BatterInning, InterpretedBatter, InterpretedScorecard } from '../types';

export interface GeminiResponse {
  date: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  rawText?: string;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------- Dynamic model resolution ----------
// Models get retired (the original hardcoded gemini-2.0-flash 404s now), so we
// discover what's available and pick by tier: 'best' favors the strongest Pro
// model for reading handwriting; 'fast' favors Flash for the cheap date pre-scan.
// Version-aware ranking means new Gemini generations are adopted automatically.

interface GeminiModelInfo {
  name: string; // e.g. "models/gemini-2.5-pro"
  supportedGenerationMethods?: string[];
}

let modelsPromise: Promise<GeminiModelInfo[]> | null = null;

function listModels(apiKey: string): Promise<GeminiModelInfo[]> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const res = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}&pageSize=100`);
      if (!res.ok) {
        modelsPromise = null; // allow retry on next call
        throw new Error(await readGeminiError(res));
      }
      const data = await res.json();
      return Array.isArray(data?.models) ? data.models : [];
    })();
  }
  return modelsPromise;
}

function modelVersion(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

const EXCLUDED = /(preview|exp|thinking|tts|embedding|image|audio|live|lite)/;

// Ordered list of models to try. Free-tier keys have limit:0 on Pro, so 'best'
// leads with Pro but falls through to Flash — a paid key gets Pro accuracy, a
// free key silently lands on the Flash model it can actually call.
async function resolveModelChain(apiKey: string, tier: 'best' | 'fast'): Promise<string[]> {
  const fallback = tier === 'best'
    ? ['gemini-2.5-pro', 'gemini-2.5-flash']
    : ['gemini-2.5-flash', 'gemini-2.5-pro'];

  let models: GeminiModelInfo[];
  try {
    models = await listModels(apiKey);
  } catch {
    return fallback;
  }

  const usable = models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => n.startsWith('gemini-') && !EXCLUDED.test(n));

  if (usable.length === 0) return fallback;

  const topOf = (keyword: string) =>
    usable
      .filter(n => n.includes(keyword))
      .sort((a, b) => modelVersion(b) - modelVersion(a))[0];

  const pro = topOf('pro');
  const flash = topOf('flash');
  const ordered = tier === 'best' ? [pro, flash] : [flash, pro];
  // Drop blanks, dedupe, and backfill with any remaining usable model.
  const chain = [...new Set(ordered.filter(Boolean))] as string[];
  if (chain.length === 0) {
    chain.push(usable.sort((a, b) => modelVersion(b) - modelVersion(a))[0]);
  }
  return chain;
}

// POST a generateContent request to a specific model. Returns the parsed JSON
// body, or throws a GeminiHttpError carrying the status so callers can decide
// whether to fall back to another model.
class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface GenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function callGenerate(
  apiKey: string,
  model: string,
  parts: unknown[],
  maxOutputTokens: number
): Promise<GenerateResponse> {
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens },
    }),
  });
  if (!response.ok) {
    throw new GeminiHttpError(response.status, await readGeminiError(response));
  }
  return response.json();
}

// Try each model in the chain; fall back only when the current model is
// unavailable to this key (429 quota / 404 not found), otherwise surface the
// error immediately (bad request, bad key, etc.).
async function generateWithFallback(
  apiKey: string,
  chain: string[],
  parts: unknown[],
  maxOutputTokens: number
): Promise<GenerateResponse> {
  let lastErr: unknown;
  for (const model of chain) {
    try {
      return await callGenerate(apiKey, model, parts, maxOutputTokens);
    } catch (err) {
      lastErr = err;
      const status = err instanceof GeminiHttpError ? err.status : 0;
      if (status === 429 || status === 404) continue; // try next model
      throw err;
    }
  }
  throw lastErr;
}

// Turn a failed Gemini response into a human-readable message.
async function readGeminiError(res: Response): Promise<string> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message ?? '';
  } catch {
    /* non-JSON body */
  }
  console.error('Gemini API error:', res.status, detail);
  return `Gemini error ${res.status}${detail ? `: ${detail}` : ''}`;
}

export async function analyzeScorecard(
  imageBase64: string,
  apiKey: string
): Promise<GeminiResponse> {
  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `You are analyzing a baseball scorecard image. Please extract the following information:

1. GAME DATE: Look for a date field, often labeled "DATE" or in a "GAMEDAY DETAILS" section. The date might be written as MM/DD/YY, MM-DD-YYYY, or written out like "June 13, 2025".

2. HOME TEAM: Look for "HOME TEAM" label and the team name written next to it.

3. VISITING/AWAY TEAM: Look for "VISITING TEAM" or "AWAY TEAM" label and the team name.

Respond in this exact JSON format only, no other text:
{
  "date": "YYYY-MM-DD" or null if not found,
  "homeTeam": "team name" or null if not found,
  "awayTeam": "team name" or null if not found
}

If the date is in MM/DD/YY format like "6/13/25", convert it to "2025-06-13".
If you can't find a field, use null.`;

  const chain = await resolveModelChain(apiKey, 'fast');
  const data = await generateWithFallback(
    apiKey,
    chain,
    [
      { text: prompt },
      { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
    ],
    256
  );

  // Extract the text response
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('No response from Gemini');
  }

  console.log('Gemini raw response:', textResponse);

  // Parse the JSON response
  try {
    // Find JSON in the response (in case there's extra text)
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        date: parsed.date || null,
        homeTeam: parsed.homeTeam || null,
        awayTeam: parsed.awayTeam || null,
        rawText: textResponse,
      };
    }
  } catch (e) {
    console.error('Failed to parse Gemini response:', e);
  }

  return {
    date: null,
    homeTeam: null,
    awayTeam: null,
    rawText: textResponse,
  };
}

// Test if the API key is valid. Listing models both validates the key and
// warms the model-resolution cache.
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    await listModels(apiKey);
    return true;
  } catch {
    return false;
  }
}

// Build few-shot examples from training data
function buildTrainingPrompt(examples: TrainingExample[]): string {
  if (examples.length === 0) return '';

  let prompt = `\n\nIMPORTANT: Here are examples of how this user writes their scorecards. Learn from these corrections to better read their handwriting:\n\n`;

  examples.forEach((example, idx) => {
    prompt += `EXAMPLE ${idx + 1} - Correct interpretation:\n`;
    prompt += JSON.stringify({
      homeTeam: example.interpretation.homeTeam,
      awayTeam: example.interpretation.awayTeam,
      homeBatters: example.interpretation.homeBatters.map(b => ({
        name: b.name,
        position: b.position,
        atBats: b.atBats.slice(0, 3) // Limit to first 3 at-bats to save tokens
      })),
      awayBatters: example.interpretation.awayBatters.map(b => ({
        name: b.name,
        position: b.position,
        atBats: b.atBats.slice(0, 3)
      }))
    }, null, 2);
    prompt += '\n\n';
  });

  prompt += `Use these examples to understand this user's handwriting patterns. Names and notation style should be similar.\n`;

  return prompt;
}

// Full scorecard interpretation
export async function interpretScorecard(
  imageBase64: string,
  apiKey: string,
  includeTraining: boolean = true
): Promise<InterpretedScorecard> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Get training examples for few-shot learning
  const trainingExamples = includeTraining ? getTrainingExamples() : [];
  const trainingPrompt = buildTrainingPrompt(trainingExamples);

  const prompt = `You are an expert at reading handwritten baseball scorecards. Analyze this scorecard image and extract all the information.${trainingPrompt}

This is a standard baseball scorecard with:
- Player names listed vertically on the left
- Innings numbered horizontally across the top (1-9 or more)
- Each cell contains the result of that player's at-bat in that inning

Common scorecard notations:
- K = Strikeout swinging
- Ⓚ or KC = Strikeout looking
- BB = Walk
- 1B = Single
- 2B = Double
- 3B = Triple
- HR = Home run
- Numbers like 6-3 = Groundout (shortstop to first base)
- F7, F8, F9 = Fly out to left, center, right field
- L5 = Line out to third base
- E5, E6 = Reached on error by 3B, SS
- FC = Fielder's choice
- SAC = Sacrifice bunt
- SF = Sacrifice fly
- HBP = Hit by pitch
- DP = Double play

The scorecard has TWO teams:
1. One team's batters (usually at the top half of the page)
2. The other team's batters (usually at the bottom half)

Look for "GAMEDAY DETAILS" section for date, home team, visiting team info.

Respond with ONLY this JSON format, no other text:
{
  "date": "YYYY-MM-DD" or null,
  "homeTeam": "team name" or null,
  "awayTeam": "team name" or null,
  "awayBatters": [
    {
      "name": "Player Name",
      "position": "position if visible",
      "number": "jersey number if visible",
      "atBats": [
        {"inning": 1, "result": "K"},
        {"inning": 2, "result": "6-3"},
        {"inning": 4, "result": "1B"}
      ]
    }
  ],
  "homeBatters": [
    {
      "name": "Player Name",
      "position": "position if visible",
      "number": "jersey number if visible",
      "atBats": [
        {"inning": 1, "result": "BB"},
        {"inning": 3, "result": "HR", "rbi": 2}
      ]
    }
  ]
}

Important:
- Read each player's name carefully from the handwriting
- For each player, read across each inning column and record what's written
- Skip empty cells (innings where the player didn't bat)
- Convert handwritten notation to standard format
- The away team usually bats first (top of page), home team second (bottom of page)`;

  // Build parts array with training example images first (for visual few-shot learning)
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

  // Add training example images if available (limit to 2 for API limits)
  if (trainingExamples.length > 0) {
    parts.push({ text: 'Here are example scorecards from this user with their correct interpretations:\n' });

    trainingExamples.slice(0, 2).forEach((example, idx) => {
      const exampleData = example.imageUrl.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: exampleData,
        },
      });
      parts.push({
        text: `Example ${idx + 1} correct reading: ${example.interpretation.homeBatters.slice(0, 3).map(b => b.name).join(', ')} (home); ${example.interpretation.awayBatters.slice(0, 3).map(b => b.name).join(', ')} (away)\n`
      });
    });

    parts.push({ text: '\n---\nNow analyze this NEW scorecard:\n' });
  }

  // Add the main prompt and current image
  parts.push({ text: prompt });
  parts.push({
    inline_data: {
      mime_type: 'image/jpeg',
      data: base64Data,
    },
  });

  // Handwriting is hard — prefer the strongest model, but fall back to Flash if
  // the key can't call Pro (free tier has limit:0 on Pro → 429).
  const chain = await resolveModelChain(apiKey, 'best');
  const data = await generateWithFallback(apiKey, chain, parts, 8192);
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('No response from Gemini');
  }

  console.log('Gemini full interpretation:', textResponse);

  try {
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        date: parsed.date || null,
        homeTeam: parsed.homeTeam || null,
        awayTeam: parsed.awayTeam || null,
        homeBatters: parsed.homeBatters || [],
        awayBatters: parsed.awayBatters || [],
        rawResponse: textResponse,
      };
    }
  } catch (e) {
    console.error('Failed to parse Gemini interpretation:', e);
  }

  return {
    date: null,
    homeTeam: null,
    awayTeam: null,
    homeBatters: [],
    awayBatters: [],
    rawResponse: textResponse,
  };
}
