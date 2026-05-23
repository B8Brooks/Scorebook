export const config = { runtime: 'edge' };

// MLB Stats API team id -> candidate FanGraphs team abbreviations.
// First entry is the most likely; the rest are matched as fallbacks.
const MLB_TO_FG: Record<number, string[]> = {
  108: ['LAA', 'ANA'],
  109: ['ARI', 'AZ'],
  110: ['BAL'],
  111: ['BOS'],
  112: ['CHC', 'CHN'],
  113: ['CIN'],
  114: ['CLE'],
  115: ['COL'],
  116: ['DET'],
  117: ['HOU'],
  118: ['KC', 'KCR'],
  119: ['LAD', 'LA'],
  120: ['WSN', 'WSH', 'WAS'],
  121: ['NYM'],
  133: ['ATH', 'OAK'],
  134: ['PIT'],
  135: ['SD', 'SDP'],
  136: ['SEA'],
  137: ['SF', 'SFG'],
  138: ['STL'],
  139: ['TB', 'TBR'],
  140: ['TEX'],
  141: ['TOR'],
  142: ['MIN'],
  143: ['PHI'],
  144: ['ATL'],
  145: ['CWS', 'CHW', 'CHA'],
  146: ['MIA', 'FLA'],
  147: ['NYY'],
  158: ['MIL'],
};

interface BullpenEntry {
  name: string;
  role: string;
}

const ROLE_ORDER: Record<string, number> = {
  Closer: 0,
  Setup: 1,
  'Middle Relief': 2,
};

// Normalize the many ways FanGraphs labels a role into our three buckets.
function normalizeRole(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('closer')) return 'Closer';
  if (r.includes('setup') || r.includes('set-up') || r.includes('8th') || r.includes('high lev')) {
    return 'Setup';
  }
  return 'Middle Relief';
}

function looksLikePlayerName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-zÀ-ÿ.'\- ]{4,40}$/.test(value) && value.includes(' ');
}

// Walk the parsed FanGraphs payload collecting reliever names tagged with a role.
// FG's roster-resource shape shifts over time, so this is heuristic: when a node
// carries a recognizable role string, any player-ish names nearby inherit that role.
function harvest(node: unknown, role: string | null, out: BullpenEntry[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  let nextRole = role;
  for (const key of ['role', 'position', 'tier', 'label', 'slot', 'title']) {
    const v = obj[key];
    if (typeof v === 'string' && /(closer|setup|set-up|middle|reliev|bullpen|high lev|8th)/i.test(v)) {
      nextRole = normalizeRole(v);
    }
  }

  if (nextRole) {
    for (const key of ['name', 'player', 'playerName', 'fullName', 'displayName']) {
      const v = obj[key];
      if (looksLikePlayerName(v)) {
        out.push({ name: v, role: nextRole });
      }
    }
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) harvest(item, nextRole, out);
    } else if (value && typeof value === 'object') {
      harvest(value, nextRole, out);
    }
  }
}

function extractEmbeddedJson(html: string): unknown[] {
  const blobs: unknown[] = [];
  // Next.js style.
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      blobs.push(JSON.parse(nextMatch[1]));
    } catch {
      /* ignore */
    }
  }
  // Generic bootstrap blobs: window.__SOMETHING__ = {...};
  const bootstrapRe = /window\.__[A-Z0-9_]+__\s*=\s*(\{[\s\S]*?\})\s*;<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = bootstrapRe.exec(html)) !== null) {
    try {
      blobs.push(JSON.parse(m[1]));
    } catch {
      /* ignore */
    }
  }
  return blobs;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mlbTeamId = parseInt(url.searchParams.get('team') ?? '', 10);
  const debug = url.searchParams.get('debug') === '1';

  const fgKeys = MLB_TO_FG[mlbTeamId];
  if (!fgKeys) {
    return Response.json({ error: 'Unknown MLB team id', mlbTeamId }, { status: 400 });
  }

  const fgUrl = 'https://www.fangraphs.com/roster-resource/closer-depth-chart';
  let status = 0;
  let html = '';
  try {
    const res = await fetch(fgUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    status = res.status;
    if (!res.ok) {
      return Response.json({ error: 'FanGraphs fetch failed', status, fgUrl }, { status: 502 });
    }
    html = await res.text();
  } catch (err) {
    return Response.json({ error: String(err), fgUrl }, { status: 500 });
  }

  const blobs = extractEmbeddedJson(html);

  // Try to scope to the requested team if a node names it, otherwise harvest globally.
  const all: BullpenEntry[] = [];
  for (const blob of blobs) {
    harvest(blob, null, all);
  }

  // De-dupe by name, keeping the highest-priority role seen.
  const byName = new Map<string, BullpenEntry>();
  for (const e of all) {
    const key = e.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || (ROLE_ORDER[e.role] ?? 9) < (ROLE_ORDER[existing.role] ?? 9)) {
      byName.set(key, e);
    }
  }
  const bullpen = Array.from(byName.values()).sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
  );

  const body: Record<string, unknown> = {
    source: 'fangraphs',
    mlbTeamId,
    fgKeys,
    status,
    bullpen,
  };
  if (debug) {
    body.htmlLength = html.length;
    body.blobCount = blobs.length;
    body.harvestedCount = all.length;
    body.hasNextData = html.includes('__NEXT_DATA__');
    // Map every array-of-objects in the Next.js payload: path + element keys.
    // This shows where the depth-chart data lives and what fields players have.
    const nextData = blobs[0] as Record<string, unknown> | undefined;
    const pageProps =
      (nextData?.props as Record<string, unknown> | undefined)?.pageProps ?? nextData?.props;
    const arrayMap: Array<{ path: string; len: number; keys: string[] }> = [];
    mapArrays(pageProps, 'pageProps', arrayMap, 0);
    body.arrayMap = arrayMap.slice(0, 60);
    // Locate a few known surnames to anchor where players actually sit.
    body.nameProbe = probeNames(JSON.stringify(pageProps ?? {}), [
      'Bednar',
      'Williams',
      'Weaver',
      'Doval',
    ]);
  }

  return Response.json(body, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
  });
}

// Records the path and element-key sample of every array-of-objects, so we can
// see how the FanGraphs payload is shaped without dumping megabytes.
function mapArrays(
  node: unknown,
  path: string,
  out: Array<{ path: string; len: number; keys: string[] }>,
  depth: number
): void {
  if (depth > 8 || out.length >= 60 || !node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    const first = node.find(x => x && typeof x === 'object' && !Array.isArray(x));
    if (first) {
      out.push({ path, len: node.length, keys: Object.keys(first as object).slice(0, 25) });
    }
    // Recurse into the first couple elements only.
    for (let i = 0; i < Math.min(node.length, 2); i++) {
      mapArrays(node[i], `${path}[${i}]`, out, depth + 1);
    }
    return;
  }
  for (const key of Object.keys(node as Record<string, unknown>)) {
    mapArrays((node as Record<string, unknown>)[key], `${path}.${key}`, out, depth + 1);
  }
}

function probeNames(json: string, names: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const name of names) {
    const idx = json.indexOf(name);
    result[name] = idx >= 0 ? json.slice(Math.max(0, idx - 120), idx + 80) : null;
  }
  return result;
}
