import type {
  InterpretedScorecard,
  InterpretedBatter,
  PlayByPlay,
  PlayEvent,
  VerificationResult,
  VerifiedBatterRow,
  VerifiedAtBat,
} from '../types';
import { eventToScorecardNotation } from './mlbApi';

// ---------- Notation canonicalization ----------

// Applied to BOTH the user's parsed notation and the official notation so that
// formatting differences never count as scoring differences. Semantics stay
// exact: K (swinging) and Ⓚ (looking) remain distinct; 6-3 and 5-3 differ.
export function canonicalizeNotation(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s || s === '—' || s === '-' || s === '?') return '';

  // Preserve the looking-strikeout circle through uppercasing.
  s = s.replace(/ꓘ/g, 'Ⓚ');
  s = s.toUpperCase().replace(/\s+/g, ' ').replace(/[.,;]+$/g, '').trim();

  // Unify dash styles.
  s = s.replace(/[–—−]/g, '-');

  // Strikeout variants.
  if (s === 'KS' || s === 'K SWINGING' || s === 'K-S') return 'K';
  if (s === 'KC' || s === 'KL' || s === 'K LOOKING' || s === 'K-L' || s === 'ⓀC') return 'Ⓚ';
  if (s === 'Ⓚ') return 'Ⓚ';

  // Walk variants.
  if (s === 'W' || s === 'WALK') return 'BB';
  if (s === 'IW') return 'IBB';

  // Double-play variants.
  if (s === 'GIDP') return 'GDP';

  // Letter-position combos written with separators: F-8, E-5, L 5, SF 8, P-4.
  const letterPos = s.match(/^(F|L|P|E|SF|SAC)[\s-]?(\d)$/);
  if (letterPos) return `${letterPos[1]}${letterPos[2]}`;

  // Digit-only fielding sequences: "63", "6 3", "6-3", "643" -> dash-joined.
  const digitsOnly = s.replace(/[\s-]/g, '');
  if (/^\d{1,4}$/.test(digitsOnly) && digitsOnly.length >= 2) {
    return digitsOnly.split('').join('-');
  }
  // Unassisted: "3U".
  const unassisted = s.match(/^(\d)[\s-]?U$/);
  if (unassisted) return `${unassisted[1]}U`;

  // Collapse remaining internal spaces around dashes: "6 - 3" handled above,
  // everything else keeps its (uppercased, trimmed) form.
  return s.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

// ---------- Name matching ----------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,']/g, '')
    .replace(/\s+jr$/i, '')
    .replace(/\s+sr$/i, '')
    .replace(/\s+iii$/i, '')
    .replace(/\s+ii$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastName(normalized: string): string {
  const parts = normalized.split(' ');
  return parts[parts.length - 1] ?? '';
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Score how well a user-written name matches an official name. Higher wins.
function nameMatchScore(userName: string, officialName: string): number {
  const u = normalizeName(userName);
  const o = normalizeName(officialName);
  if (!u || !o) return 0;
  if (u === o) return 100;
  const uLast = lastName(u);
  const oLast = lastName(o);
  if (uLast && uLast === oLast) return 90;
  if (o.includes(u) || u.includes(o)) return 80;
  if (oLast.includes(uLast) || uLast.includes(oLast)) return 70;
  const sim = similarity(uLast, oLast);
  if (sim >= 0.7) return 50 + sim * 20;
  return 0;
}

// ---------- Official sequence building ----------

interface OfficialPA {
  inning: number;
  slot: number;
  notation: string;
  description: string;
}

interface OfficialBatter {
  batterId: number;
  name: string;
  pas: OfficialPA[];
}

function buildOfficialBatters(pbp: PlayByPlay, side: 'away' | 'home'): OfficialBatter[] {
  const events: PlayEvent[] = [];
  for (const inning of pbp.innings) {
    events.push(...(side === 'away' ? inning.top : inning.bottom));
  }

  const byId = new Map<number, OfficialBatter>();
  const order: number[] = [];
  const slotCounter = new Map<string, number>();

  for (const ev of events) {
    if (!ev.batterId) continue;
    if (!byId.has(ev.batterId)) {
      byId.set(ev.batterId, { batterId: ev.batterId, name: ev.batter, pas: [] });
      order.push(ev.batterId);
    }
    const slotKey = `${ev.batterId}:${ev.inning}`;
    const slot = slotCounter.get(slotKey) ?? 0;
    slotCounter.set(slotKey, slot + 1);
    byId.get(ev.batterId)!.pas.push({
      inning: ev.inning,
      slot,
      notation: canonicalizeNotation(eventToScorecardNotation(ev.result, ev.description)),
      description: ev.description || ev.result,
    });
  }

  return order.map(id => byId.get(id)!);
}

// ---------- Verification ----------

export function cellKey(side: 'away' | 'home', batterIdx: number, inning: number, slot: number): string {
  return `${side}:${batterIdx}:${inning}:${slot}`;
}

function verifySide(
  userBatters: InterpretedBatter[],
  officialBatters: OfficialBatter[],
  side: 'away' | 'home',
  resolutions: Record<string, 'mine' | 'official'>
): { rows: VerifiedBatterRow[]; usedOfficialIds: Set<number> } {
  const usedOfficialIds = new Set<number>();

  // Greedy best-match assignment in user-row order.
  const assignments: Array<OfficialBatter | null> = userBatters.map(user => {
    let best: OfficialBatter | null = null;
    let bestScore = 0;
    for (const official of officialBatters) {
      if (usedOfficialIds.has(official.batterId)) continue;
      const score = nameMatchScore(user.name ?? '', official.name);
      if (score > bestScore) {
        bestScore = score;
        best = official;
      }
    }
    if (best && bestScore >= 50) {
      usedOfficialIds.add(best.batterId);
      return best;
    }
    return null;
  });

  const rows: VerifiedBatterRow[] = userBatters.map((user, batterIdx) => {
    const official = assignments[batterIdx];
    const atBats: VerifiedAtBat[] = [];

    // Group the user's at-bats by inning, preserving order for slot zipping.
    const mineByInning = new Map<number, string[]>();
    for (const ab of user.atBats ?? []) {
      const list = mineByInning.get(ab.inning) ?? [];
      list.push(ab.result);
      mineByInning.set(ab.inning, list);
    }

    if (!official) {
      // No official counterpart: every user cell is unverifiable.
      for (const [inning, results] of mineByInning) {
        results.forEach((result, slot) => {
          atBats.push({
            inning,
            slot,
            mine: canonicalizeNotation(result) || result,
            verdict: 'unknown',
          });
        });
      }
      atBats.sort((a, b) => a.inning - b.inning || a.slot - b.slot);
      return { name: user.name ?? 'Unknown', unmatched: true, atBats };
    }

    const coveredInningSlots = new Set<string>();
    for (const pa of official.pas) {
      const mineList = mineByInning.get(pa.inning) ?? [];
      const mineRaw = mineList[pa.slot];
      const mine = canonicalizeNotation(mineRaw);
      coveredInningSlots.add(`${pa.inning}:${pa.slot}`);

      let verdict: VerifiedAtBat['verdict'];
      if (!mine) verdict = 'unknown';
      else if (mine === pa.notation) verdict = 'match';
      else verdict = 'mismatch';

      atBats.push({
        inning: pa.inning,
        slot: pa.slot,
        mine: mine || (mineRaw ?? undefined),
        official: pa.notation,
        officialDescription: pa.description,
        verdict,
        resolution: resolutions[cellKey(side, batterIdx, pa.inning, pa.slot)],
      });
    }

    // User cells in innings/slots with no official PA (likely OCR misreads).
    for (const [inning, results] of mineByInning) {
      results.forEach((result, slot) => {
        if (coveredInningSlots.has(`${inning}:${slot}`)) return;
        atBats.push({
          inning,
          slot,
          mine: canonicalizeNotation(result) || result,
          verdict: 'unknown',
        });
      });
    }

    atBats.sort((a, b) => a.inning - b.inning || a.slot - b.slot);
    return {
      name: user.name ?? 'Unknown',
      matchedOfficialName: official.name,
      officialBatterId: official.batterId,
      atBats,
    };
  });

  return { rows, usedOfficialIds };
}

export function verifyScorecard(
  interp: InterpretedScorecard,
  pbp: PlayByPlay,
  resolutions: Record<string, 'mine' | 'official'> = {}
): VerificationResult {
  const officialAway = buildOfficialBatters(pbp, 'away');
  const officialHome = buildOfficialBatters(pbp, 'home');

  const awaySide = verifySide(interp.awayBatters ?? [], officialAway, 'away', resolutions);
  const homeSide = verifySide(interp.homeBatters ?? [], officialHome, 'home', resolutions);

  const officialOnly: VerificationResult['officialOnly'] = [];
  for (const b of officialAway) {
    if (!awaySide.usedOfficialIds.has(b.batterId)) {
      officialOnly.push({ side: 'away', name: b.name, batterId: b.batterId });
    }
  }
  for (const b of officialHome) {
    if (!homeSide.usedOfficialIds.has(b.batterId)) {
      officialOnly.push({ side: 'home', name: b.name, batterId: b.batterId });
    }
  }

  let matches = 0;
  let mismatches = 0;
  let unknowns = 0;
  for (const row of [...awaySide.rows, ...homeSide.rows]) {
    for (const ab of row.atBats) {
      if (ab.verdict === 'match') matches++;
      else if (ab.verdict === 'mismatch') mismatches++;
      else unknowns++;
    }
  }
  const denominator = matches + mismatches;
  const accuracyPct = denominator > 0 ? Math.round((matches / denominator) * 1000) / 10 : 0;

  return {
    away: awaySide.rows,
    home: homeSide.rows,
    officialOnly,
    matches,
    mismatches,
    unknowns,
    accuracyPct,
  };
}
