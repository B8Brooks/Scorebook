import Tesseract from 'tesseract.js';
import type { ParsedScorecardData, ParsedBatter, AtBatResult } from '../types';

export interface OCRProgress {
  status: string;
  progress: number;
}

export interface DetectedGameInfo {
  date: string | null;  // YYYY-MM-DD format
  homeTeam: string | null;
  awayTeam: string | null;
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

// Extract game date from scorecard text
export function extractGameDate(text: string): string | null {
  // Common date patterns in scorecards
  // Look for DATE: or Date followed by a date
  // Be lenient with separators since OCR often misreads / as | or 1 or space
  const patterns = [
    // MM/DD/YY with various separators (/, -, |, space, .)
    /(?:date[:\s]*)?(\d{1,2})[\/\-\|\s\.\\](\d{1,2})[\/\-\|\s\.\\](\d{2,4})/i,
    // Written as "June 13, 2025" or "Jun 13 2025"
    /(?:date[:\s]*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?,?\s*['"]?(\d{2,4})/i,
    // Looser pattern: any 3 numbers that could be a date (M D YY or MM DD YY)
    /(\d{1,2})\s*[\/\-\|\s\.\\,]+\s*(\d{1,2})\s*[\/\-\|\s\.\\,]+\s*(\d{2,4})/,
  ];

  const monthMap: Record<string, number> = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
  };

  // Also check for common OCR misreads - clean up the text first
  const cleanedText = text
    .replace(/[oO]/g, '0')  // O often misread as 0 in dates
    .replace(/[lI]/g, '1')  // l and I often misread as 1
    .replace(/[sS](?=\d)/g, '5')  // S before digit often is 5
    .replace(/[bB](?=\d)/g, '6');  // b before digit often is 6

  for (const pattern of patterns) {
    // Try both original and cleaned text
    for (const searchText of [text, cleanedText]) {
      const match = searchText.match(pattern);
      if (match) {
        let year: number, month: number, day: number;

        if (isNaN(parseInt(match[1]))) {
          // Month name format: "June 13, 2025"
          const monthName = match[1].toLowerCase();
          month = monthMap[monthName] || monthMap[monthName.substring(0, 3)];
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        } else {
          // Numeric format: MM/DD/YY
          month = parseInt(match[1]);
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        }

        // Handle 2-digit years
        if (year < 100) {
          year = year > 50 ? 1900 + year : 2000 + year;
        }

        // Validate date
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
  }

  return null;
}

// Extract team names from scorecard
export function extractTeams(text: string): { homeTeam: string | null; awayTeam: string | null } {
  let homeTeam: string | null = null;
  let awayTeam: string | null = null;

  const homeMatch = text.match(/home\s*team[:\s]*([a-z\s]+?)(?:\n|visiting|away|$)/i);
  if (homeMatch) {
    homeTeam = homeMatch[1].trim();
  }

  const awayMatch = text.match(/visiting\s*team[:\s]*([a-z\s]+?)(?:\n|home|$)/i);
  if (awayMatch) {
    awayTeam = awayMatch[1].trim();
  }

  return { homeTeam, awayTeam };
}

// Quick OCR scan to detect game info (date, teams)
export async function detectGameInfo(
  imageUrl: string,
  onProgress?: (progress: OCRProgress) => void
): Promise<DetectedGameInfo> {
  const { text } = await extractTextFromImage(imageUrl, onProgress);

  // Debug: log what OCR detected
  console.log('OCR detected text:', text);

  const date = extractGameDate(text);
  const { homeTeam, awayTeam } = extractTeams(text);

  console.log('Extracted date:', date, 'Home:', homeTeam, 'Away:', awayTeam);

  return {
    date,
    homeTeam,
    awayTeam,
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
