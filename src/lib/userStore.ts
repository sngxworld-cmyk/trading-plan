import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { TradingDataStore } from "../types";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
}

// Normalize email key for Firestore document ID
export function cleanEmailKey(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Save user trading data & metadata directly to Firestore under their Gmail
 */
export async function saveUserDataToFirestore(
  email: string,
  tradingData: TradingDataStore,
  metadata?: { yearRange?: string; startMonth?: number }
) {
  const key = cleanEmailKey(email);
  if (!key) return;

  const docPath = `users/${key}`;
  try {
    const payload: Record<string, any> = {
      email: key,
      updatedAt: new Date().toISOString(),
    };

    if (tradingData && Object.keys(tradingData).length > 0) {
      payload.tradingData = tradingData;
    }

    if (metadata?.yearRange !== undefined) {
      payload.yearRange = metadata.yearRange;
    }
    if (metadata?.startMonth !== undefined) {
      payload.startMonth = metadata.startMonth;
    }

    await setDoc(doc(db, "users", key), payload, { merge: true });
    // Also backup to localStorage
    try {
      localStorage.setItem(`sngx_trading_data_${key}`, JSON.stringify(tradingData));
    } catch (e) {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Get user trading data & metadata directly from Firestore under their Gmail
 */
export async function getUserDataFromFirestore(email: string) {
  const key = cleanEmailKey(email);
  if (!key) return null;

  const docPath = `users/${key}`;
  try {
    const docRef = doc(db, "users", key);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  // Fallback to local storage backup if Firestore read encounters issue
  try {
    const local = localStorage.getItem(`sngx_trading_data_${key}`);
    if (local) {
      return { tradingData: JSON.parse(local) };
    }
  } catch (e) {}

  return null;
}

/**
 * Subscribe to real-time Firestore updates for a given user Gmail
 */
export function subscribeUserDataFromFirestore(
  email: string,
  onData: (data: any) => void
) {
  const key = cleanEmailKey(email);
  if (!key) return () => {};

  const docPath = `users/${key}`;
  const docRef = doc(db, "users", key);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data());
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  );

  return unsubscribe;
}
