// Firebase app initialization, Google auth, and Firestore handle.
//
// The web config below is PUBLIC by design (Firebase security comes from
// Firestore rules + authorized domains, not from hiding these values).
// Until the user's real project config is pasted in, the placeholders keep
// the app building and the cloud features show a "not set up" notice.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    // Persistent cache keeps the gallery working offline (e.g. at the ballpark)
    // and queues writes until connectivity returns.
    dbInstance = initializeFirestore(ensureApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return dbInstance;
}

export type AuthUser = User;

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err: unknown) {
    // Popup blockers / embedded browsers: fall back to a full-page redirect.
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return; // user changed their mind — not an error
    }
    throw err;
  }
}

export function signOutUser(): Promise<void> {
  return signOut(getFirebaseAuth());
}

export function onAuthChanged(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(getFirebaseAuth(), cb);
}
