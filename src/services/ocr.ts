import Tesseract from 'tesseract.js';
import type { ParsedScorecardData, ParsedBatter, AtBatResult } from '../types';

export interface OCRProgress {
  status: string;
  progress: number;
}

export async function extractTextFromImage(
  imageUrl: string,
  onProgress?: (progress: OCRProgress) => void
): Promise<{ text: string; confidence: number }> {
  const result = await Tesseract.recognize(imageUrl, 'eng', {
    logger: (m) => {
      if (onProgress && m.status) {
        onProgress({
          status: m.status,
          progress: m.progress || 0,
        });
      }
    },
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

// Common baseball scoring abbreviations
const SCORING_PATTERNS: Record<string, string> = {
  'K': 'Strikeout',
  'KC': 'Strikeout looking',
  'BB': 'Walk',
  'IBB': 'Intentional walk',
  'HBP': 'Hit by pitch',
  '1B': 'Single',
  '2B': 'Double',
  '3B': 'Triple',
  'HR': 'Home run',
  'E': 'Error',
  'FC': 'Fielder\'s choice',
  'SF': 'Sacrifice fly',
  'SAC': 'Sacrifice bunt',
  'DP': 'Double play',
  'TP': 'Triple play',
  'F': 'Fly out',
  'L': 'Line out',
  'G': 'Ground out',
  'P': 'Pop out',
};

// Position numbers
const POSITIONS: Record<string, string> = {
  '1': 'P',
  '2': 'C',
  '3': '1B',
  '4': '2B',
  '5': '3B',
  '6': 'SS',
  '7': 'LF',
  '8': 'CF',
  '9': 'RF',
};

export function parseScorecard(rawText: string, confidence: number): ParsedScorecardData {
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  const batters: ParsedBatter[] = [];

  // Try to identify player rows (usually start with a name or number)
  const playerLinePattern = /^[\d]*[.\s]*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/;

  for (const line of lines) {
    const match = line.match(playerLinePattern);
    if (match) {
      const batter: ParsedBatter = {
        name: match[1].trim(),
        atBats: [],
      };

      // Try to extract at-bat results from the rest of the line
      const restOfLine = line.substring(match[0].length);
      const atBatResults = extractAtBatResults(restOfLine);
      batter.atBats = atBatResults;

      if (batter.name && batter.name.length > 1) {
        batters.push(batter);
      }
    }
  }

  return {
    batters,
    rawText,
    confidence,
  };
}

function extractAtBatResults(text: string): AtBatResult[] {
  const results: AtBatResult[] = [];
  let inning = 1;

  // Common patterns to look for
  const patterns = [
    /\bK\b/gi,           // Strikeout
    /\bBB\b/gi,          // Walk
    /\b1B\b/gi,          // Single
    /\b2B\b/gi,          // Double
    /\b3B\b/gi,          // Triple
    /\bHR\b/gi,          // Home run
    /\b[1-9]-[1-9]\b/g,  // Putout (e.g., 6-3, 4-3)
    /\bF[1-9]\b/gi,      // Fly out to position
    /\bL[1-9]\b/gi,      // Line out to position
    /\bG[1-9]\b/gi,      // Ground out to position
    /\bE[1-9]\b/gi,      // Error by position
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      results.push({
        inning: inning++,
        result: match[0].toUpperCase(),
      });
    }
  }

  return results;
}

export function getResultDescription(result: string): string {
  // Check direct matches
  if (SCORING_PATTERNS[result.toUpperCase()]) {
    return SCORING_PATTERNS[result.toUpperCase()];
  }

  // Check for putouts (e.g., 6-3, 4-6-3)
  if (/^[1-9](-[1-9])+$/.test(result)) {
    const positions = result.split('-').map(n => POSITIONS[n] || n);
    return `Ground out: ${positions.join(' to ')}`;
  }

  // Check for fly outs (e.g., F8, F9)
  const flyMatch = result.match(/^F([1-9])$/i);
  if (flyMatch) {
    return `Fly out to ${POSITIONS[flyMatch[1]] || flyMatch[1]}`;
  }

  // Check for line outs
  const lineMatch = result.match(/^L([1-9])$/i);
  if (lineMatch) {
    return `Line out to ${POSITIONS[lineMatch[1]] || lineMatch[1]}`;
  }

  return result;
}
