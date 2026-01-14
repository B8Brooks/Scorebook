// Gemini API service for advanced OCR and scorecard interpretation

export interface GeminiResponse {
  date: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  rawText?: string;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=${apiKey}`
    );
    return response.ok;
  } catch {
    return false;
  }
}
