// Gemini API service for advanced OCR and scorecard interpretation

export interface GeminiResponse {
  date: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  rawText?: string;
}

export interface BatterInning {
  inning: number;
  result: string;  // e.g., "K", "BB", "6-3", "1B", "HR"
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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

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

// Test if the API key is valid
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${apiKey}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Full scorecard interpretation
export async function interpretScorecard(
  imageBase64: string,
  apiKey: string
): Promise<InterpretedScorecard> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `You are an expert at reading handwritten baseball scorecards. Analyze this scorecard image and extract all the information.

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

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
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
