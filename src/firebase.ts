import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Database ID (CRITICAL: The app will break without this)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
import { getStorage } from 'firebase/storage';
export const storage = getStorage(app);

// Initialize Corporate Cloud Functions
import { getFunctions, httpsCallable } from 'firebase/functions';
export const functions = getFunctions(app);
export { httpsCallable };

// Authentication Provider
export const googleProvider = new GoogleAuthProvider();

/**
 * Handle Firestore errors following the Firebase integration skill's strict specifications
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
