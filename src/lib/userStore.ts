import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { TradingDataStore, User, UserStatus, AdminUserRecord, AuditLog } from "../types";

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
 * Add an audit log into Firestore /logs
 */
export async function addAuditLogToFirestore(message: string, type: "info" | "success" | "warning" = "info") {
  try {
    const id = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    await setDoc(doc(db, "logs", id), {
      id,
      timestamp: new Date().toISOString(),
      message,
      type,
    });
  } catch (error) {
    console.warn("Could not write audit log to Firestore:", error);
  }
}

/**
 * Register a new user in Firestore /users/{cleanEmail}
 */
export async function registerUserInFirestore(params: {
  email: string;
  username: string;
  password?: string;
}): Promise<User> {
  const cleanEmail = cleanEmailKey(params.email);
  if (!cleanEmail) throw new Error("Email address is required.");

  const docPath = `users/${cleanEmail}`;

  // 1. Check if user document already exists
  try {
    const existingSnap = await getDoc(doc(db, "users", cleanEmail));
    if (existingSnap.exists()) {
      throw new Error("This email address is already registered.");
    }
  } catch (err: any) {
    if (err.message?.includes("already registered")) throw err;
    handleFirestoreError(err, OperationType.GET, docPath);
  }

  // 2. Check if pre-approved or master admin
  const isMasterAdmin = cleanEmail === "sngxworld@gmail.com";
  let isPreApproved = isMasterAdmin;

  if (!isPreApproved) {
    try {
      const preSnap = await getDoc(doc(db, "preApprovedEmails", cleanEmail));
      if (preSnap.exists()) {
        isPreApproved = true;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `preApprovedEmails/${cleanEmail}`);
    }
  }

  const role = isMasterAdmin ? "admin" : "client";
  const status = isPreApproved ? "approved" : "pending";

  const newUser: User = {
    id: "usr_" + Date.now(),
    email: cleanEmail,
    username: params.username.trim(),
    role,
    status,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  const firestoreRecord: Record<string, any> = {
    ...newUser,
    password: params.password || "",
    tradingData: {},
  };

  try {
    await setDoc(doc(db, "users", cleanEmail), firestoreRecord);
    await addAuditLogToFirestore(
      `New user registered: ${cleanEmail} (${status.toUpperCase()})`,
      status === "approved" ? "success" : "info"
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }

  // Local backup
  try {
    const localUsers = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    localUsers.push(firestoreRecord);
    localStorage.setItem("sngx_local_users", JSON.stringify(localUsers));
  } catch (e) {}

  return newUser;
}

/**
 * Login user via Firestore /users
 */
export async function loginUserInFirestore(
  identifier: string,
  passwordInput: string
): Promise<{ user: User; status: UserStatus }> {
  const cleanIdent = identifier.trim().toLowerCase();

  // Special Master Admin fallback
  if (
    (cleanIdent === "sngxworld@gmail.com" || cleanIdent === "sngxadmin") &&
    passwordInput === "adminpassword123"
  ) {
    const masterAdmin: User = {
      id: "usr_admin_master",
      email: "sngxworld@gmail.com",
      username: "sngxadmin",
      role: "admin",
      status: "approved",
      lastLogin: new Date().toISOString(),
    };
    // Ensure master admin doc exists in Firestore
    try {
      await setDoc(
        doc(db, "users", "sngxworld@gmail.com"),
        {
          id: masterAdmin.id,
          email: masterAdmin.email,
          username: masterAdmin.username,
          role: "admin",
          status: "approved",
          password: "adminpassword123",
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {}
    return { user: masterAdmin, status: "approved" };
  }

  let matchedData: any = null;

  // Try direct lookup by email in Firestore
  try {
    const docSnap = await getDoc(doc(db, "users", cleanIdent));
    if (docSnap.exists()) {
      matchedData = docSnap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${cleanIdent}`);
  }

  // If not found by email key, try querying all users to match username
  if (!matchedData) {
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((d) => {
        const u = d.data();
        if (
          u.email?.toLowerCase() === cleanIdent ||
          u.username?.toLowerCase() === cleanIdent
        ) {
          matchedData = u;
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "users");
    }
  }

  // Fallback check in local storage if offline/error
  if (!matchedData) {
    try {
      const localUsers = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
      matchedData = localUsers.find(
        (u: any) =>
          u.email.toLowerCase() === cleanIdent || u.username.toLowerCase() === cleanIdent
      );
    } catch (e) {}
  }

  if (!matchedData) {
    throw new Error("Invalid credentials. Please check your username/email and password.");
  }

  if (matchedData.password && matchedData.password !== passwordInput) {
    throw new Error("Invalid credentials. Password does not match.");
  }

  const user: User = {
    id: matchedData.id || "usr_" + Date.now(),
    email: matchedData.email,
    username: matchedData.username,
    role: matchedData.role || "client",
    status: matchedData.status || "pending",
    createdAt: matchedData.createdAt,
    lastLogin: new Date().toISOString(),
    tradingData: matchedData.tradingData || {},
  };

  // Update last login in Firestore
  try {
    await setDoc(
      doc(db, "users", cleanEmailKey(user.email)),
      { lastLogin: user.lastLogin },
      { merge: true }
    );
  } catch (e) {}

  if (user.status === "revoked") {
    throw new Error("Access Revoked. Your access to this portal has been revoked by Host Admin.");
  }

  return { user, status: user.status };
}

/**
 * Save user trading data & metadata directly to Firestore under their Gmail
 */
export async function saveUserDataToFirestore(
  email: string,
  tradingData: TradingDataStore,
  metadata?: { yearRange?: string; startMonth?: number; startingCapital?: string }
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
    if (metadata?.startingCapital !== undefined) {
      payload.startingCapital = metadata.startingCapital;
    }

    await setDoc(doc(db, "users", key), payload, { merge: true });

    // Local backup
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

  // Local fallback
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

/**
 * Fetch all admin users, pre-approved emails, and audit logs from Firestore
 */
export async function fetchAllAdminDataFromFirestore() {
  const users: AdminUserRecord[] = [];
  const preApprovedGmails: string[] = [];
  const logs: AuditLog[] = [];

  // 1. Fetch Users
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((d) => {
      const u = d.data();
      if (u.email) {
        users.push({
          id: u.id || "usr_" + d.id,
          email: u.email,
          username: u.username || u.email.split("@")[0],
          role: u.role || "client",
          status: u.status || "approved",
          createdAt: u.createdAt || new Date().toISOString(),
          lastLogin: u.lastLogin,
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "users");
  }

  // 2. Fetch Preapproved Emails
  try {
    const snap = await getDocs(collection(db, "preApprovedEmails"));
    snap.forEach((d) => {
      if (d.data()?.email) {
        preApprovedGmails.push(d.data().email);
      } else {
        preApprovedGmails.push(d.id);
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "preApprovedEmails");
  }

  // 3. Fetch Audit Logs
  try {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      logs.push(d.data() as AuditLog);
    });
  } catch (err) {
    // If index missing fallback to get all
    try {
      const snap = await getDocs(collection(db, "logs"));
      snap.forEach((d) => logs.push(d.data() as AuditLog));
    } catch (e) {}
  }

  // Always include master admin email in preapproved list
  if (!preApprovedGmails.includes("sngxworld@gmail.com")) {
    preApprovedGmails.push("sngxworld@gmail.com");
  }

  return { users, preApprovedGmails, logs };
}

/**
 * Grant access to a user in Firestore
 */
export async function grantUserAccessInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  try {
    await setDoc(doc(db, "users", cleanEmail), { status: "approved" }, { merge: true });
    await addAuditLogToFirestore(`Access GRANTED for user: ${cleanEmail}`, "success");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${cleanEmail}`);
  }

  // Update local storage
  try {
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updated = localUsers.map((u) =>
      u.email.toLowerCase() === cleanEmail ? { ...u, status: "approved" as const } : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Revoke access for a user in Firestore
 */
export async function revokeUserAccessInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  try {
    await setDoc(doc(db, "users", cleanEmail), { status: "revoked" }, { merge: true });
    await addAuditLogToFirestore(`Access REVOKED for user: ${cleanEmail}`, "warning");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${cleanEmail}`);
  }

  // Update local storage
  try {
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updated = localUsers.map((u) =>
      u.email.toLowerCase() === cleanEmail ? { ...u, status: "revoked" as const } : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Pre-approve a Gmail address in Firestore
 */
export async function preApproveGmailInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  try {
    await setDoc(doc(db, "preApprovedEmails", cleanEmail), {
      email: cleanEmail,
      addedAt: new Date().toISOString(),
    });

    // If user record already exists, update status to approved
    const userDocRef = doc(db, "users", cleanEmail);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      await setDoc(userDocRef, { status: "approved" }, { merge: true });
    }

    await addAuditLogToFirestore(`Gmail pre-approved: ${cleanEmail}`, "success");
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `preApprovedEmails/${cleanEmail}`);
  }

  // Local storage backup
  try {
    const list: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    if (!list.includes(cleanEmail)) {
      list.push(cleanEmail);
      localStorage.setItem("sngx_preapproved_emails", JSON.stringify(list));
    }
  } catch (e) {}
}

/**
 * Remove a pre-approved Gmail from Firestore
 */
export async function removePreApprovedGmailInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  try {
    await deleteDoc(doc(db, "preApprovedEmails", cleanEmail));
    await addAuditLogToFirestore(`Pre-approved Gmail removed: ${cleanEmail}`, "warning");
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `preApprovedEmails/${cleanEmail}`);
  }

  try {
    const list: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    const updated = list.filter((e) => e.toLowerCase() !== cleanEmail);
    localStorage.setItem("sngx_preapproved_emails", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Delete a user from Firestore
 */
export async function deleteUserInFirestore(email: string) {
  const cleanEmail = cleanEmailKey(email);
  if (!cleanEmail) return;

  try {
    await deleteDoc(doc(db, "users", cleanEmail));
    await addAuditLogToFirestore(`User account deleted: ${cleanEmail}`, "warning");
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${cleanEmail}`);
  }

  try {
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updated = localUsers.filter((u) => u.email.toLowerCase() !== cleanEmail);
    localStorage.setItem("sngx_local_users", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Approve all pending users in Firestore
 */
export async function approveAllPendingInFirestore() {
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(async (d) => {
      const u = d.data();
      if (u.status === "pending") {
        await setDoc(doc(db, "users", d.id), { status: "approved" }, { merge: true });
      }
    });
    await addAuditLogToFirestore("Approved all pending accounts", "success");
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, "users");
  }
}
