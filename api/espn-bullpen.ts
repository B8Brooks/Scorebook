export const config = { runtime: 'edge' };

// MLB Stats API team ID -> ESPN team ID.
const MLB_TO_ESPN: Record<number, number> = {
  108: 3, // LAA Angels
  109: 29, // ARI D-backs
  110: 1, // BAL Orioles
  111: 2, // BOS Red Sox
  112: 16, // CHC Cubs
  113: 17, // CIN Reds
  114: 5, // CLE Guardians
  115: 27, // COL Rockies
  116: 6, // DET Tigers
  117: 18, // HOU Astros
  118: 7, // KC Royals
  119: 19, // LAD Dodgers
  120: 20, // WSH Nationals
  121: 21, // NYM Mets
  133: 11, // OAK Athletics
  134: 23, // PIT Pirates
  135: 25, // SD Padres
  136: 12, // SEA Mariners
  137: 26, // SF Giants
  138: 24, // STL Cardinals
  139: 30, // TB Rays
  140: 13, // TEX Rangers
  141: 14, // TOR Blue Jays
  142: 9, // MIN Twins
  143: 22, // PHI Phillies
  144: 15, // ATL Braves
  145: 4, // CWS White Sox
  146: 28, // MIA Marlins
  147: 10, // NYY Yankees
  158: 8, // MIL Brewers
};

interface BullpenEntry {
  name: string;
  role: string;
  espnPlayerId?: number;
}

// Recursively walk the ESPN response and collect any athlete under a "bullpen"-flavored position.
// ESPN's shape changes occasionally, so we look for the athletes by heuristic rather than a fixed path.
function extractBullpen(node: unknown, bucket: BullpenEntry[], currentRole: string | null = null): void {
  if (!node || typeof node !== 'object') return;
  const anyNode = node as Record<string, unknown>;

  // If this node names a position, remember it while we recurse.
  const positionName =
    (anyNode.position && typeof anyNode.position === 'object'
      ? ((anyNode.position as Record<string, unknown>).displayName ??
          (anyNode.position as Record<string, unknown>).name)
      : null) ??
    anyNode.name ??
    null;

  let nextRole = currentRole;
  if (typeof positionName === 'string') {
    const lower = positionName.toLowerCase();
    if (
      lower.includes('closer') ||
      lower.includes('setup') ||
      lower.includes('reliev') ||
      lower.includes('bullpen')
    ) {
      nextRole = positionName;
    }
  }

  // Athletes can be named "athlete", "player", or appear in an "athletes"/"players" array.
  const athleteCandidate = anyNode.athlete ?? anyNode.player;
  if (athleteCandidate && typeof athleteCandidate === 'object' && nextRole) {
    const a = athleteCandidate as Record<string, unknown>;
    const name = (a.displayName ?? a.fullName ?? a.name) as string | undefined;
    const id = (a.id ?? a.athleteId) as number | string | undefined;
    if (typeof name === 'string' && name.length > 0) {
      bucket.push({
        name,
        role: nextRole,
        espnPlayerId: typeof id === 'number' ? id : id ? parseInt(String(id), 10) : undefined,
      });
    }
  }

  for (const key of Object.keys(anyNode)) {
    const value = anyNode[key];
    if (Array.isArray(value)) {
      for (const item of value) extractBullpen(item, bucket, nextRole);
    } else if (value && typeof value === 'object') {
      extractBullpen(value, bucket, nextRole);
    }
  }
}

function roleRank(role: string): number {
  const lower = role.toLowerCase();
  if (lower.includes('closer')) return 0;
  if (lower.includes('setup')) return 1;
  if (lower.includes('middle')) return 2;
  return 3;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mlbTeamId = parseInt(url.searchParams.get('team') ?? '', 10);
  const debug = url.searchParams.get('debug') === '1';

  const espnTeamId = MLB_TO_ESPN[mlbTeamId];
  if (!espnTeamId) {
    return Response.json(
      { error: 'Unknown MLB team id', mlbTeamId },
      { status: 400 }
    );
  }

  const espnUrl = `https://cdn.espn.com/core/mlb/team/depth?xhr=1&id=${espnTeamId}`;
  let status = 0;
  let raw: unknown = null;
  try {
    const res = await fetch(espnUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ScorebookBot/1.0; +https://scorebook-beta.vercel.app)',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
    });
    status = res.status;
    if (!res.ok) {
      return Response.json(
        { error: 'ESPN fetch failed', status, espnUrl },
        { status: 502 }
      );
    }
    raw = await res.json();
  } catch (err) {
    return Response.json(
      { error: String(err), espnUrl },
      { status: 500 }
    );
  }

  const bucket: BullpenEntry[] = [];
  extractBullpen(raw, bucket);

  // Dedupe by espnPlayerId or name and keep the best role seen.
  const byKey = new Map<string, BullpenEntry>();
  for (const entry of bucket) {
    const key = entry.espnPlayerId ? `id:${entry.espnPlayerId}` : `n:${entry.name.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || roleRank(entry.role) < roleRank(existing.role)) {
      byKey.set(key, entry);
    }
  }
  const bullpen = Array.from(byKey.values()).sort(
    (a, b) => roleRank(a.role) - roleRank(b.role)
  );

  const body: Record<string, unknown> = {
    source: 'espn',
    mlbTeamId,
    espnTeamId,
    status,
    espnUrl,
    bullpen,
  };
  if (debug) body.raw = raw;

  return Response.json(body, {
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=3600',
    },
  });
}
