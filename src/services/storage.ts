// Cloud-backed storage with a synchronous in-memory mirror.
//
// Signed in: data lives in Firestore under users/{uid}/... and every device
// sees the same scorecards, settings, and training examples. Reads stay
// synchronous against the mirror so existing call sites don't change; writes
// update the mirror immediately and write through to Firestore (its offline
// queue covers flaky ballpark connectivity).
//
// Signed out (or Firebase not configured yet): everything falls back to the
// original localStorage behavior.

import type { Scorecard, InterpretedScorecard } from '../types';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured, type AuthUser } from './firebase';
import { compressToLimit } from '../utils/imageUtils';

const STORAGE_KEY = 'mlb-scorecards';
const SETTINGS_KEY = 'mlb-scorebook-settings';
const TRAINING_EXAMPLES_KEY = 'mlb-scorecard-training';
const MIGRATED_KEY_PREFIX = 'mlb-scorebook-migrated:';

export interface AppSettings {
  geminiApiKey?: string;
}

export interface TrainingExample {
  id: string;
  imageUrl: string; // Base64 image
  interpretation: InterpretedScorecard;
  createdAt: string;
}

// ---------- module state (the mirror) ----------

let uid: string | null = null;
let scorecardsCache: Scorecard[] = [];
let settingsCache: AppSettings = {};
let trainingCache: TrainingExample[] = [];
let unsubscribers: Array<() => void> = [];
const scorecardListeners = new Set<(cards: Scorecard[]) => void>();

function notifyScorecardListeners(): void {
  const cards = getScorecards();
  for (const cb of scorecardListeners) cb(cards);
}

// Firestore rejects `undefined` values; a JSON round-trip strips them.
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function logWriteError(context: string) {
  return (err: unknown) => console.error(`Firestore write failed (${context}):`, err);
}

// ---------- localStorage primitives (signed-out fallback + migration source) ----------

function readLocal<T>(key: string, empty: T): T {
  const data = localStorage.getItem(key);
  if (!data) return empty;
  try {
    return JSON.parse(data);
  } catch {
    return empty;
  }
}

function localScorecards(): Scorecard[] {
  return readLocal<Scorecard[]>(STORAGE_KEY, []);
}

// ---------- auth wiring ----------

// Called by App whenever the signed-in user changes. Attaches/detaches the
// Firestore listeners and (on first sign-in) migrates local data up.
export function setStorageUser(user: AuthUser | null): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  uid = user?.uid ?? null;
  scorecardsCache = [];
  settingsCache = {};
  trainingCache = [];

  if (!uid || !isFirebaseConfigured) {
    notifyScorecardListeners(); // fall back to localStorage view
    return;
  }

  const db = getDb();
  const userId = uid;

  void migrateLocalToCloud(userId).finally(() => {
    unsubscribers.push(
      onSnapshot(collection(db, 'users', userId, 'scorecards'), snap => {
        if (uid !== userId) return;
        scorecardsCache = snap.docs
          .map(d => d.data() as Scorecard)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        notifyScorecardListeners();
      }),
      onSnapshot(doc(db, 'users', userId, 'settings', 'app'), snap => {
        if (uid !== userId) return;
        settingsCache = (snap.data() as AppSettings) ?? {};
      }),
      onSnapshot(collection(db, 'users', userId, 'training'), snap => {
        if (uid !== userId) return;
        trainingCache = snap.docs
          .map(d => d.data() as TrainingExample)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      })
    );
  });
}

async function migrateLocalToCloud(userId: string): Promise<void> {
  const flagKey = `${MIGRATED_KEY_PREFIX}${userId}`;
  if (localStorage.getItem(flagKey)) return;

  try {
    const db = getDb();
    const existing = await getDocs(collection(db, 'users', userId, 'scorecards'));
    const locals = localScorecards();

    if (existing.empty && locals.length > 0) {
      for (const card of locals) {
        const imageUrl = await compressToLimit(card.imageUrl);
        await setDoc(
          doc(db, 'users', userId, 'scorecards', card.id),
          sanitize({ ...card, imageUrl })
        );
      }
      // Also migrate settings + training examples if the cloud has none.
      const localSettings = readLocal<AppSettings>(SETTINGS_KEY, {});
      if (localSettings.geminiApiKey) {
        await setDoc(doc(db, 'users', userId, 'settings', 'app'), sanitize(localSettings));
      }
      for (const ex of readLocal<TrainingExample[]>(TRAINING_EXAMPLES_KEY, [])) {
        const imageUrl = await compressToLimit(ex.imageUrl);
        await setDoc(doc(db, 'users', userId, 'training', ex.id), sanitize({ ...ex, imageUrl }));
      }
    }
    localStorage.setItem(flagKey, '1');
  } catch (err) {
    console.error('Migration to cloud failed (will retry next sign-in):', err);
  }
}

// Live subscription for the gallery. Immediately calls back with the current
// mirror, then again on every local or remote change.
export function subscribeScorecards(cb: (cards: Scorecard[]) => void): () => void {
  scorecardListeners.add(cb);
  cb(getScorecards());
  return () => {
    scorecardListeners.delete(cb);
  };
}

// ---------- scorecards ----------

export function getScorecards(): Scorecard[] {
  if (uid) return scorecardsCache;
  return localScorecards();
}

export function saveScorecard(scorecard: Scorecard): void {
  if (uid) {
    const userId = uid;
    scorecardsCache = [scorecard, ...scorecardsCache];
    notifyScorecardListeners();
    void (async () => {
      const imageUrl = await compressToLimit(scorecard.imageUrl);
      await setDoc(
        doc(getDb(), 'users', userId, 'scorecards', scorecard.id),
        sanitize({ ...scorecard, imageUrl })
      );
    })().catch(logWriteError('saveScorecard'));
    return;
  }
  const scorecards = localScorecards();
  scorecards.unshift(scorecard);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scorecards));
}

export function deleteScorecard(id: string): void {
  if (uid) {
    scorecardsCache = scorecardsCache.filter(s => s.id !== id);
    notifyScorecardListeners();
    deleteDoc(doc(getDb(), 'users', uid, 'scorecards', id)).catch(
      logWriteError('deleteScorecard')
    );
    return;
  }
  const filtered = localScorecards().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function updateScorecard(id: string, updates: Partial<Scorecard>): void {
  if (uid) {
    const index = scorecardsCache.findIndex(s => s.id === id);
    if (index === -1) return;
    scorecardsCache = [...scorecardsCache];
    scorecardsCache[index] = { ...scorecardsCache[index], ...updates };
    notifyScorecardListeners();
    // Explicit undefined means "remove the field" (e.g. clearing an interpretation).
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      payload[key] = value === undefined ? deleteField() : sanitize(value);
    }
    setDoc(doc(getDb(), 'users', uid, 'scorecards', id), payload, { merge: true }).catch(
      logWriteError('updateScorecard')
    );
    return;
  }
  const scorecards = localScorecards();
  const index = scorecards.findIndex(s => s.id === id);
  if (index !== -1) {
    scorecards[index] = { ...scorecards[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scorecards));
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ---------- settings ----------

export function getSettings(): AppSettings {
  if (uid) return settingsCache;
  return readLocal<AppSettings>(SETTINGS_KEY, {});
}

export function saveSettings(settings: AppSettings): void {
  if (uid) {
    settingsCache = settings;
    setDoc(doc(getDb(), 'users', uid, 'settings', 'app'), sanitize(settings)).catch(
      logWriteError('saveSettings')
    );
    return;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getGeminiApiKey(): string | null {
  return getSettings().geminiApiKey || null;
}

export function saveGeminiApiKey(apiKey: string): void {
  const settings = { ...getSettings(), geminiApiKey: apiKey };
  saveSettings(settings);
}

// ---------- training examples ----------

const MAX_EXAMPLES = 3;

export function getTrainingExamples(): TrainingExample[] {
  if (uid) return trainingCache;
  return readLocal<TrainingExample[]>(TRAINING_EXAMPLES_KEY, []);
}

export function saveTrainingExample(example: TrainingExample): void {
  if (uid) {
    const userId = uid;
    const next = [example, ...trainingCache].slice(0, MAX_EXAMPLES);
    const evicted = [example, ...trainingCache].slice(MAX_EXAMPLES);
    trainingCache = next;
    void (async () => {
      const imageUrl = await compressToLimit(example.imageUrl);
      await setDoc(
        doc(getDb(), 'users', userId, 'training', example.id),
        sanitize({ ...example, imageUrl })
      );
      for (const old of evicted) {
        await deleteDoc(doc(getDb(), 'users', userId, 'training', old.id));
      }
    })().catch(logWriteError('saveTrainingExample'));
    return;
  }
  const examples = getTrainingExamples();
  examples.unshift(example);
  localStorage.setItem(TRAINING_EXAMPLES_KEY, JSON.stringify(examples.slice(0, MAX_EXAMPLES)));
}

export function deleteTrainingExample(id: string): void {
  if (uid) {
    trainingCache = trainingCache.filter(e => e.id !== id);
    deleteDoc(doc(getDb(), 'users', uid, 'training', id)).catch(
      logWriteError('deleteTrainingExample')
    );
    return;
  }
  const filtered = getTrainingExamples().filter(e => e.id !== id);
  localStorage.setItem(TRAINING_EXAMPLES_KEY, JSON.stringify(filtered));
}

export function clearTrainingExamples(): void {
  if (uid) {
    const ids = trainingCache.map(e => e.id);
    trainingCache = [];
    for (const id of ids) {
      deleteDoc(doc(getDb(), 'users', uid, 'training', id)).catch(
        logWriteError('clearTrainingExamples')
      );
    }
    return;
  }
  localStorage.removeItem(TRAINING_EXAMPLES_KEY);
}
