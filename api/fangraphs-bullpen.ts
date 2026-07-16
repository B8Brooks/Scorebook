export const config = { runtime: 'edge' };

// MLB Stats API team id -> candidate FanGraphs TeamAbbName values.
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
  mlbamid?: number;
  tags?: string;
}

const ROLE_ORDER: Record<string, number> = {
  Closer: 0,
  Setup: 1,
  'Middle Relief': 2,
};

// Only rows with a recognizable bullpen role belong in the depth chart output.
// FanGraphs also lists statuses like "Injured" or "Minors"; those must be
// dropped, not defaulted into Middle Relief.
const BULLPEN_ROLE = /(closer|setup|set-up|middle|long|reliev|8th|high lev)/i;

function normalizeRole(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('closer')) return 'Closer';
  if (r.includes('setup') || r.includes('set-up') || r.includes('8th') || r.includes('high lev')) {
    return 'Setup';
  }
  return 'Middle Relief';
}

function extractNextData(html: string): unknown {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// The closer depth chart embeds every reliever for all 30 teams in a react-query
// cache at props.pageProps.dehydratedState.queries[].state.data.dataPlayers.
function findDataPlayers(nextData: unknown): Record<string, unknown>[] {
  const pageProps = (nextData as any)?.props?.pageProps;
  const queries = pageProps?.dehydratedState?.queries;
  if (Array.isArray(queries)) {
    for (const q of queries) {
      const dp = q?.state?.data?.dataPlayers;
      if (Array.isArray(dp)) return dp;
    }
  }
  // Fallback: a direct data.dataPlayers shape.
  const direct = pageProps?.data?.dataPlayers;
  return Array.isArray(direct) ? direct : [];
}

function parseTeamBullpen(
  dataPlayers: Record<string, unknown>[],
  fgKeys: string[]
): BullpenEntry[] {
  const keySet = new Set(fgKeys.map(k => k.toUpperCase()));
  const entries: Array<BullpenEntry & { order: number }> = [];

  dataPlayers.forEach((p, i) => {
    const teamAbb = String(p.TeamAbbName ?? '').toUpperCase();
    if (!keySet.has(teamAbb)) return;
    const rawRole = String(p.Role ?? '');
    if (!rawRole || !BULLPEN_ROLE.test(rawRole)) return;
    if (p.isActive === false || p.isActive === 0) return;
    const name = String(p.playerName ?? '');
    if (!name) return;
    const mlbamRaw = p.mlbamid;
    const mlbamid =
      typeof mlbamRaw === 'number'
        ? mlbamRaw
        : Number.isFinite(parseInt(String(mlbamRaw), 10))
          ? parseInt(String(mlbamRaw), 10)
          : undefined;
    const tags = typeof p.Tags === 'string' && p.Tags.trim() ? p.Tags.trim() : undefined;
    entries.push({ name, role: normalizeRole(rawRole), mlbamid, tags, order: i });
  });

  // Stable sort by role tier, preserving FanGraphs' within-tier order.
  entries.sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    return ra !== rb ? ra - rb : a.order - b.order;
  });

  return entries.map(({ name, role, mlbamid, tags }) => ({ name, role, mlbamid, tags }));
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

  const nextData = extractNextData(html);
  const dataPlayers = findDataPlayers(nextData);
  const bullpen = parseTeamBullpen(dataPlayers, fgKeys);

  const body: Record<string, unknown> = {
    source: 'fangraphs',
    mlbTeamId,
    fgKeys,
    status,
    bullpen,
  };
  if (debug) {
    body.dataPlayersCount = dataPlayers.length;
    body.teamAbbSamples = Array.from(
      new Set(dataPlayers.map(p => String(p.TeamAbbName ?? '')))
    ).slice(0, 40);
  }

  return Response.json(body, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
  });
}
