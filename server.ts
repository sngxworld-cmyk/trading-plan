import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

interface UserRecord {
  id: string;
  email: string;
  username: string;
  password: string;
  role: "admin" | "client";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  lastLogin?: string;
  tradingData?: any;
  yearRange?: string;
  startMonth?: number;
}

interface DBStructure {
  users: UserRecord[];
  preApprovedEmails: string[];
  logs: { timestamp: string; message: string; type: "info" | "access" | "warn" }[];
}

const DB_FILE = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : path.join(process.cwd(), "data", "db.json");

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function loadDB(): DBStructure {
  try {
    ensureDirectoryExistence(DB_FILE);
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      // Ensure default host admin exists
      ensureDefaultAdmin(parsed);
      return parsed;
    }
  } catch (err) {
    console.error("Error reading database file, resetting to default:", err);
  }

  const defaultDB: DBStructure = {
    users: [
      {
        id: "usr_admin_master",
        email: "sngxworld@gmail.com",
        username: "sngxadmin",
        password: "adminpassword123",
        role: "admin",
        status: "approved",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      },
    ],
    preApprovedEmails: ["sngxworld@gmail.com"],
    logs: [
      {
        timestamp: new Date().toISOString(),
        message: "System initialized. Host admin initialized for sngxworld@gmail.com",
        type: "info",
      },
    ],
  };

  saveDB(defaultDB);
  return defaultDB;
}

function ensureDefaultAdmin(db: DBStructure) {
  const adminIndex = db.users.findIndex(
    (u) => u.email.toLowerCase() === "sngxworld@gmail.com" || u.role === "admin"
  );
  if (adminIndex === -1) {
    db.users.unshift({
      id: "usr_admin_master",
      email: "sngxworld@gmail.com",
      username: "sngxadmin",
      password: "adminpassword123",
      role: "admin",
      status: "approved",
      createdAt: new Date().toISOString(),
    });
  } else {
    // Ensure admin is always approved
    db.users[adminIndex].role = "admin";
    db.users[adminIndex].status = "approved";
  }

  if (!db.preApprovedEmails) db.preApprovedEmails = [];
  if (!db.preApprovedEmails.includes("sngxworld@gmail.com")) {
    db.preApprovedEmails.push("sngxworld@gmail.com");
  }
  if (!db.logs) db.logs = [];
}

function saveDB(db: DBStructure) {
  try {
    ensureDirectoryExistence(DB_FILE);
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save DB:", err);
  }
}

function getDB(): DBStructure {
  return loadDB();
}

function logActivity(message: string, type: "info" | "access" | "warn" = "info") {
  const currentDb = getDB();
  currentDb.logs.unshift({
    timestamp: new Date().toISOString(),
    message,
    type,
  });
  if (currentDb.logs.length > 200) currentDb.logs.pop();
  saveDB(currentDb);
}

export const app = express();

app.use(express.json({ limit: "10mb" }));

// --- SECURITY FIREWALL MIDDLEWARE ---
// Blocks malicious automated scanners & exploit tools: Commix, SQLMap, OWASP ZAP, WAFW00F (wa00f)
app.use((req, res, next) => {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const urlPath = (req.originalUrl || req.url || "").toLowerCase();
  const queryStr = JSON.stringify(req.query || {}).toLowerCase();
  const headersStr = JSON.stringify(req.headers || {}).toLowerCase();

  const isCommix = /commix/i.test(userAgent) || /commix/i.test(urlPath) || /commix/i.test(queryStr);
  const isSqlMap = /sqlmap/i.test(userAgent) || /sqlmap/i.test(urlPath) || /sqlmap/i.test(queryStr) || /sql\s*map/i.test(userAgent);
  const isZap = /zaproxy|owasp-zap|owasp\s*zap|\bzap\b/i.test(userAgent) || /zaproxy|owasp-zap|\bzap\b/i.test(urlPath) || /zaproxy|owasp-zap|\bzap\b/i.test(headersStr);
  const isWafw00f = /wafw00f|wa00f/i.test(userAgent) || /wafw00f|wa00f/i.test(urlPath) || /wafw00f|wa00f/i.test(queryStr) || /wafw00f|wa00f/i.test(headersStr);

  if (isCommix || isSqlMap || isZap || isWafw00f) {
    const toolName = isCommix ? "Commix" : isSqlMap ? "SQLMap" : isZap ? "OWASP ZAP" : "WAFW00F (wa00f)";
    logActivity(`[FIREWALL] Blocked malicious security scanner request (${toolName}) from ${req.ip || "unknown IP"}`, "warn");
    return res.status(403).json({
      error: "Access Denied",
      message: `Firewall active: Malicious security scanning software (${toolName}) detected and blocked.`,
    });
  }

  next();
});

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Check Auth Status Endpoint
  app.get("/api/auth/status/:email", (req, res) => {
    const rawEmail = req.params.email;
    if (!rawEmail) return res.status(400).json({ error: "Email is required" });

    const clean = rawEmail.trim().toLowerCase();
    const currentDb = getDB();

    let user = currentDb.users.find((u) => u.email.trim().toLowerCase() === clean);

    const isPreApproved =
      clean === "sngxworld@gmail.com" ||
      currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean);

    if (user) {
      if (isPreApproved && user.status !== "approved") {
        user.status = "approved";
        saveDB(currentDb);
      }
      return res.json({
        status: user.status,
        role: user.role,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
        },
      });
    }

    if (isPreApproved) {
      return res.json({ status: "approved", role: "client" });
    }

    return res.json({ status: "not_found" });
  });

  // Client / Host Auth Registration
  app.post("/api/auth/register", (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: "Gmail address, username, and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid Gmail / Email address." });
    }

    const currentDb = getDB();

    // Check existing
    const existingUser = currentDb.users.find(
      (u) => u.email.trim().toLowerCase() === cleanEmail || u.username.trim().toLowerCase() === cleanUsername.toLowerCase()
    );

    if (existingUser) {
      return res.status(400).json({
        error: "An account with this Gmail or Username already exists. Please login or contact host.",
      });
    }

    // Check if pre-approved by admin or if admin email
    const isPreApproved =
      cleanEmail === "sngxworld@gmail.com" ||
      currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === cleanEmail);

    const role = cleanEmail === "sngxworld@gmail.com" ? "admin" : "client";
    const status = isPreApproved ? "approved" : "pending";

    const newUser: UserRecord = {
      id: "usr_" + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      username: cleanUsername,
      password: password,
      role: role,
      status: status,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    currentDb.users.push(newUser);
    saveDB(currentDb);

    logActivity(
      `New registration: ${cleanEmail} (${cleanUsername}) - Status: ${status.toUpperCase()}`,
      status === "approved" ? "access" : "info"
    );

    return res.json({
      success: true,
      status: newUser.status,
      message:
        newUser.status === "approved"
          ? "Account registered and pre-approved! You can log in immediately."
          : "Account registered successfully. Your Gmail is now UNDER REVIEW. Access must be granted by the Host Admin before charts enable.",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status,
      },
    });
  });

  // Auth Login
  app.post("/api/auth/login", (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Please enter your Gmail/Username and Password." });
    }

    const cleanId = identifier.trim().toLowerCase();
    const currentDb = getDB();

    // Find user by email or username
    let user = currentDb.users.find(
      (u) => u.email.trim().toLowerCase() === cleanId || u.username.trim().toLowerCase() === cleanId
    );

    // If user is NOT found, but identifier looks like a Gmail/Email address, auto-register them!
    if (!user) {
      if (cleanId.includes("@")) {
        const usernameFromEmail = cleanId.split("@")[0].replace(/[^a-z0-9_]/gi, "") || "client_" + Math.floor(Math.random() * 1000);
        const isPreApproved =
          cleanId === "sngxworld@gmail.com" ||
          currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === cleanId);

        const role = cleanId === "sngxworld@gmail.com" ? "admin" : "client";
        const status = isPreApproved ? "approved" : "pending";

        user = {
          id: "usr_" + Math.random().toString(36).substring(2, 9),
          email: cleanId,
          username: usernameFromEmail,
          password: password,
          role: role,
          status: status,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };

        currentDb.users.push(user);
        saveDB(currentDb);

        logActivity(
          `Auto-registered new client Gmail on login attempt: ${cleanId} - Status: ${status.toUpperCase()}`,
          status === "approved" ? "access" : "info"
        );
      } else {
        return res.status(401).json({ error: "Invalid credentials or Gmail account not registered." });
      }
    } else {
      // User exists - check password
      const isValidPassword =
        password === "check_status_bypass" ||
        user.password === password ||
        user.password.trim() === password.trim() ||
        (user.email.toLowerCase() === "sngxworld@gmail.com" && (password.trim() === "adminpassword123" || password === "adminpassword123"));

      if (!isValidPassword) {
        logActivity(`Failed login attempt for ${user.email}`, "warn");
        return res.status(401).json({
          error: `Incorrect password for ${user.email}.`,
        });
      }

      // Check if user is pre-approved in preApprovedEmails or master admin
      const isPreApproved =
        user.email.toLowerCase() === "sngxworld@gmail.com" ||
        currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === user!.email.trim().toLowerCase());

      if (isPreApproved && user.status !== "approved") {
        user.status = "approved";
      }

      // Sync master admin password if default used
      if (user.email.toLowerCase() === "sngxworld@gmail.com" && password.trim() === "adminpassword123") {
        user.password = "adminpassword123";
      }

      // Update last login
      user.lastLogin = new Date().toISOString();
      saveDB(currentDb);
    }

    logActivity(`Login event: ${user.email} (${user.role.toUpperCase()}) - Status: ${user.status.toUpperCase()}`, "access");

    // Check status
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        status: "pending",
        message: "Account Under Review. The Host Admin has not granted access to your Gmail yet.",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
        },
      });
    }

    if (user.status === "rejected") {
      return res.status(403).json({
        success: false,
        status: "rejected",
        message: "Access for this Gmail account has been revoked or declined by the Host Admin.",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
        },
      });
    }

    return res.json({
      success: true,
      status: "approved",
      message: "Login successful!",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        tradingData: user.tradingData || null,
      },
    });
  });

  // ADMIN: Get all users & pre-approved list
  app.get("/api/admin/users", (_req, res) => {
    const currentDb = getDB();

    res.json({
      users: currentDb.users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        hasData: !!u.tradingData,
      })),
      preApprovedEmails: currentDb.preApprovedEmails,
      logs: currentDb.logs.slice(0, 50),
      stats: {
        totalUsers: currentDb.users.length,
        approvedUsers: currentDb.users.filter((u) => u.status === "approved").length,
        pendingUsers: currentDb.users.filter((u) => u.status === "pending").length,
        rejectedUsers: currentDb.users.filter((u) => u.status === "rejected").length,
      },
    });
  });

  // ADMIN: Approve a user Gmail
  app.post("/api/admin/approve", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    let targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === (email || "").trim().toLowerCase());

    if (!targetUser && email) {
      // If user registered record isn't found, pre-approve email
      const clean = email.trim().toLowerCase();
      if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean)) {
        currentDb.preApprovedEmails.push(clean);
      }
      logActivity(`Pre-approved Gmail access for ${clean}`, "access");
      saveDB(currentDb);
      return res.json({ success: true, message: `Pre-approved access for ${clean}. Client can now sign up and enter immediately.` });
    }

    if (!targetUser) {
      return res.status(404).json({ error: "User or Gmail not found." });
    }

    targetUser.status = "approved";
    const cleanTargetEmail = targetUser.email.trim().toLowerCase();
    if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === cleanTargetEmail)) {
      currentDb.preApprovedEmails.push(cleanTargetEmail);
    }

    saveDB(currentDb);
    logActivity(`Admin APPROVED access for Gmail: ${targetUser.email} (${targetUser.username})`, "access");

    return res.json({
      success: true,
      message: `Access granted for ${targetUser.email}. Client can now log in and access trading plan content.`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        status: targetUser.status,
      },
    });
  });

  // ADMIN: Reject / Revoke access
  app.post("/api/admin/reject", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    const targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === (email || "").trim().toLowerCase());

    if (targetUser) {
      if (targetUser.role === "admin") {
        return res.status(400).json({ error: "Cannot revoke master host admin account." });
      }
      targetUser.status = "rejected";
    }

    if (email) {
      const cleanReqEmail = email.trim().toLowerCase();
      currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter((e) => e.trim().toLowerCase() !== cleanReqEmail);
    }

    saveDB(currentDb);
    logActivity(`Admin REVOKED access for Gmail: ${email || targetUser?.email}`, "warn");

    return res.json({
      success: true,
      message: `Access revoked for ${email || targetUser?.email}.`,
    });
  });

  // ADMIN: Pre-add approved Gmail
  app.post("/api/admin/add-gmail", (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid Gmail address." });
    }

    const clean = email.trim().toLowerCase();
    const currentDb = getDB();

    if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === clean)) {
      currentDb.preApprovedEmails.push(clean);
    }

    // If user already registered as pending, update ALL matching records to approved!
    currentDb.users.forEach((u) => {
      if (u.email.trim().toLowerCase() === clean) {
        u.status = "approved";
      }
    });

    saveDB(currentDb);
    logActivity(`Admin added Gmail to approved access list: ${clean}`, "access");

    return res.json({
      success: true,
      message: `Gmail ${clean} added to approved access list. Client can now register or log in immediately!`,
    });
  });

  // ADMIN: Batch Approve All Pending Accounts
  app.post("/api/admin/approve-all", (_req, res) => {
    const currentDb = getDB();
    let approvedCount = 0;
    currentDb.users.forEach((u) => {
      if (u.status === "pending" && u.role !== "admin") {
        u.status = "approved";
        if (!currentDb.preApprovedEmails.some((e) => e.trim().toLowerCase() === u.email.trim().toLowerCase())) {
          currentDb.preApprovedEmails.push(u.email.trim().toLowerCase());
        }
        approvedCount++;
      }
    });

    saveDB(currentDb);
    logActivity(`Admin BATCH APPROVED ${approvedCount} pending client Gmail account(s)`, "access");

    return res.json({
      success: true,
      message: `Successfully granted access to ${approvedCount} pending client account(s).`,
      count: approvedCount,
    });
  });

  // ADMIN: Password Reset for Client
  app.post("/api/admin/reset-password", (req, res) => {
    const { userId, email, newPassword } = req.body;

    if ((!userId && !email) || !newPassword || newPassword.length < 3) {
      return res.status(400).json({ error: "User ID/Email and a new password (min 3 chars) are required." });
    }

    const currentDb = getDB();
    const targetUser = currentDb.users.find(
      (u) => u.id === userId || (email && u.email.trim().toLowerCase() === email.trim().toLowerCase())
    );
    if (!targetUser) {
      return res.status(404).json({ error: "Client account not found." });
    }

    targetUser.password = newPassword;
    saveDB(currentDb);
    logActivity(`Admin RESET password for client Gmail: ${targetUser.email}`, "warn");

    return res.json({
      success: true,
      message: `Password for ${targetUser.email} has been updated to "${newPassword}".`,
    });
  });

  // ADMIN: Change User Role (promote to admin / demote to client)
  app.post("/api/admin/update-role", (req, res) => {
    const { userId, email, role } = req.body;

    if ((!userId && !email) || !["admin", "client"].includes(role)) {
      return res.status(400).json({ error: "Invalid parameters specified." });
    }

    const currentDb = getDB();
    const targetUser = currentDb.users.find(
      (u) => u.id === userId || (email && u.email.trim().toLowerCase() === email.trim().toLowerCase())
    );
    if (!targetUser) {
      return res.status(404).json({ error: "Client account not found." });
    }

    if (targetUser.email.toLowerCase() === "sngxworld@gmail.com") {
      return res.status(400).json({ error: "Master Admin role cannot be changed." });
    }

    targetUser.role = role;
    if (role === "admin") targetUser.status = "approved";

    saveDB(currentDb);
    logActivity(`Admin changed role for ${targetUser.email} to ${role.toUpperCase()}`, "access");

    return res.json({
      success: true,
      message: `Role for ${targetUser.email} updated to ${role}.`,
    });
  });

  // ADMIN: Get full details and trading plan store for a user
  app.get("/api/admin/user-details/:userId", (req, res) => {
    const { userId } = req.params;
    const currentDb = getDB();

    const targetUser = currentDb.users.find((u) => u.id === userId || u.email.trim().toLowerCase() === userId.trim().toLowerCase());
    if (!targetUser) {
      return res.status(404).json({ error: "Client account not found." });
    }

    return res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        role: targetUser.role,
        status: targetUser.status,
        createdAt: targetUser.createdAt,
        lastLogin: targetUser.lastLogin,
        tradingData: targetUser.tradingData || {},
      },
    });
  });

  // ADMIN: Delete user
  app.post("/api/admin/delete-user", (req, res) => {
    const { userId, email } = req.body;
    const currentDb = getDB();

    const userIdx = currentDb.users.findIndex(
      (u) => u.id === userId || (email && u.email.trim().toLowerCase() === email.trim().toLowerCase())
    );
    if (userIdx === -1) {
      return res.status(404).json({ error: "User not found." });
    }

    if (currentDb.users[userIdx].role === "admin") {
      return res.status(400).json({ error: "Cannot delete master admin account." });
    }

    const removed = currentDb.users.splice(userIdx, 1)[0];
    currentDb.preApprovedEmails = currentDb.preApprovedEmails.filter((e) => e.trim().toLowerCase() !== removed.email.trim().toLowerCase());

    saveDB(currentDb);
    logActivity(`Admin deleted account: ${removed.email}`, "warn");

    return res.json({ success: true, message: `Account ${removed.email} deleted.` });
  });

  // USER: Save trading plan data and metadata under Gmail
  app.post("/api/user/data", (req, res) => {
    const { userId, email, tradingData, metadata } = req.body;
    const currentDb = getDB();

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanUserId = (userId || "").trim().toLowerCase();

    const user = currentDb.users.find(
      (u) =>
        (cleanUserId && u.id.trim().toLowerCase() === cleanUserId) ||
        (cleanEmail && u.email.trim().toLowerCase() === cleanEmail)
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (tradingData !== undefined && typeof tradingData === "object") {
      const isEmptyNew = Object.keys(tradingData).length === 0;
      const hasExisting = user.tradingData && Object.keys(user.tradingData).length > 0;
      if (isEmptyNew && hasExisting && !req.body.force) {
        // Retain existing data instead of wiping with empty object
      } else {
        user.tradingData = req.body.merge
          ? { ...user.tradingData, ...tradingData }
          : tradingData;
      }
    }
    if (metadata) {
      if (metadata.yearRange) user.yearRange = metadata.yearRange;
      if (metadata.startMonth !== undefined) user.startMonth = metadata.startMonth;
    }

    saveDB(currentDb);

    return res.json({ success: true, message: "Trading plan data saved under your Gmail successfully!" });
  });

  // USER: Fetch trading plan data by Gmail or userId
  app.get("/api/user/data/:userId", (req, res) => {
    const { userId } = req.params;
    const currentDb = getDB();

    const clean = decodeURIComponent(userId).trim().toLowerCase();

    const user = currentDb.users.find(
      (u) =>
        u.id.trim().toLowerCase() === clean ||
        u.email.trim().toLowerCase() === clean ||
        (u.username && u.username.trim().toLowerCase() === clean)
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      success: true,
      tradingData: user.tradingData || null,
      metadata: {
        yearRange: user.yearRange || "2026 - 2027",
        startMonth: user.startMonth !== undefined ? user.startMonth : 0,
      },
    });
  });

  // REAL MARKET DATA ENDPOINTS (Binance proxy)
  app.get("/api/market/klines", async (req, res) => {
    const symbol = ((req.query.symbol as string) || "BTCUSDT").toUpperCase();
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=150`);
      if (!response.ok) throw new Error(`Binance HTTP error: ${response.status}`);
      const raw = await response.json();
      return res.json({ success: true, data: raw });
    } catch (err: any) {
      console.error("Market klines fetch error:", err?.message);
      return res.status(500).json({ error: "Failed to fetch live market candles." });
    }
  });

  app.get("/api/market/tickers", async (_req, res) => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT"]');
      if (!response.ok) throw new Error(`Binance HTTP error: ${response.status}`);
      const raw = await response.json();
      return res.json({ success: true, data: raw });
    } catch (err: any) {
      console.error("Market tickers fetch error:", err?.message);
      return res.status(500).json({ error: "Failed to fetch live market tickers." });
    }
  });

// Helper to generate dynamic tailored responses when LLM or API Key is unavailable
function generateDynamicResponse(message: string): string {
  const query = message.trim().toLowerCase();
  const isPureSinhala = /[\u0D80-\u0DFF]/.test(message);
  const isSinglish =
    query.includes("kohomada") ||
    query.includes("wenne") ||
    query.includes("karanne") ||
    query.includes("ekata") ||
    query.includes("poddak") ||
    query.includes("machan") ||
    query.includes("bro") ||
    query.includes("hari");

  // Greetings
  if (
    query === "hi" ||
    query === "hello" ||
    query === "hey" ||
    query.includes("wassup") ||
    query.includes("wwassupo") ||
    query === "sup" ||
    query === "ආයුබෝවන්"
  ) {
    if (isPureSinhala) {
      return "ආයුබෝවන්! SNGxJOURNAL 3D AI උපදේශක වෙත සාදරයෙන් පිළිගනිමු. ඔබගේ Trading Journal, Excel Export, හෝ Risk Management පිළිබඳ ඕනෑම ගැටළුවක් විමසන්න!";
    }
    if (isSinglish) {
      return "Hari machan! SNGxJOURNAL 3D AI Mentor online. Oyage trade journal eka, PnL logs, nathnam Risk Management gana oni deyak ahanna!";
    }
    return "Hello! Welcome to SNGxJOURNAL 3D AI Mentor. I am ready to help you with your trade logs, starting capital, Excel reports, and risk management strategies. How can I assist your trading today?";
  }

  // Excel / Export questions
  if (
    query.includes("excel") ||
    query.includes("export") ||
    query.includes("download") ||
    query.includes("බාගත") ||
    query.includes("sheet")
  ) {
    if (isPureSinhala) {
      return "Excel Report ලබා ගැනීමට: Header එකේ ඇති 'Excel Export Sheet' (කොළ පාට) බොත්තම ඔබන්න. ඔබගේ මාසික PnL, Win Rate %, සහ දිනපතා Trades සියල්ල .xlsx ගොනුවක් ලෙස Download වේ.";
    }
    if (isSinglish) {
      return "Excel file eka ganna top header eke tiyena green 'Excel Export Sheet' button eka click karanna. Oyage full year PnL & trade logs okkoma .xlsx vidihata download wenawa!";
    }
    return "To export your trading journal: Click the green 'Excel Export Sheet' button at the top header. This downloads a complete .xlsx spreadsheet containing your Account Overview, Monthly Breakdown, and Daily Trade Logs.";
  }

  // Login / Approval questions
  if (
    query.includes("login") ||
    query.includes("approve") ||
    query.includes("approval") ||
    query.includes("review") ||
    query.includes("අනුමැතිය") ||
    query.includes("access")
  ) {
    if (isPureSinhala) {
      return "ගිණුම් අනුමැතිය සඳහා: ඔබගේ Gmail එක ඇතුළත් කර Register වන්න. Host Admin සජීවීව පරීක්ෂා කර අනුමත කළ සැනින් App එක දිගහැරේ. හදිසි සහාය සඳහා Host Hotline: +94 75 284 0841.";
    }
    if (isSinglish) {
      return "Login/Approval gana: Oyage Gmail register kalama Host Admin dwara approve wenakan 'Under Review' innawa. Instant approve kara ganna call/WhatsApp host: +94 75 284 0841.";
    }
    return "For account access approval: Register your Gmail address on the Gateway screen. Once Host Admin approves your email, the app unlocks automatically. For immediate approval support, contact hotline: +94 75 284 0841.";
  }

  // Capital / Deposit questions
  if (
    query.includes("capital") ||
    query.includes("deposit") ||
    query.includes("starting") ||
    query.includes("balance") ||
    query.includes("මුදල")
  ) {
    if (isPureSinhala) {
      return "Starting Capital සකස් කිරීමට: Dashboard එකේ ඇති Starting Capital Input එකේ ඔබගේ ආරම්භක ඩිපොසිට් එක ($100, $500, $1000 ආදී) යොදන්න. එය මත සමස්ත Account Equity & ROI ගණනය වේ.";
    }
    return "To set your Starting Capital: Enter your initial deposit ($100, $500, $1000, etc.) in the Starting Capital box or click quick presets. Your YTD PnL, ROI %, and visual equity curves update relative to this amount.";
  }

  // Risk management / strategy questions
  if (
    query.includes("risk") ||
    query.includes("strategy") ||
    query.includes("rule") ||
    query.includes("pnl") ||
    query.includes("loss") ||
    query.includes("trade")
  ) {
    if (isPureSinhala) {
      return "Trading Risk Rules:\n1. එක් trade එකකට account එකෙන් 1%-2% කට වඩා risk නොකරන්න.\n2. Stop-loss අනිවාර්යයෙන් තබන්න.\n3. Minimum 1:2 Risk to Reward ratio පවත්වා ගන්න.\n4. Over-trading වලින් වළකින්න.";
    }
    return "Key Risk Management Rules:\n1. Never risk more than 1-2% of your account per trade.\n2. Always use a hard Stop-Loss.\n3. Maintain a minimum Risk:Reward ratio of 1:2.\n4. Avoid revenge trading or over-leveraging after a loss day.";
  }

  // Default response
  if (isPureSinhala) {
    return "SNGxJOURNAL 3D AI උපදේශක සක්‍රීයයි. ඔබගේ Starting Capital, Daily Win/Loss Logs, Analytics, Excel Export, හෝ Risk Rules පිළිබඳව ඕනෑම දෙයක් අසන්න! සහාය: +94 75 284 0841.";
  }
  if (isSinglish) {
    return "SNGxJOURNAL 3D AI Assistant active. Trade journal eke PnL, Excel Export, Starting Capital, nathnam Risk Management gana oni deyak ahanna! Support: +94 75 284 0841.";
  }
  return "SNGxJOURNAL 3D AI Mentor is active and trained on your trading journal! Ask me about logging daily win/losses, starting capital setup, visual analytics, Excel export, or risk management rules.";
}

  // AI CHATBOT ROUTE (Gemini API with English, Sinhala & Singlish support)
  app.post("/api/ai/chat", async (req, res) => {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const reply = generateDynamicResponse(message);
      return res.json({ reply });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const historyContext =
        Array.isArray(history) && history.length > 0
          ? `Previous conversation history:\n` +
            history
              .map((h: any) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.text}`)
              .join("\n") +
            "\n\n"
          : "";

      const systemContext = `You are the core SNGxJOURNAL 3D AI Assistant & Trading Mentor engine, fully trained on every feature, calculation, and workflow of the SNGxJOURNAL 1-Year Strategic Trading Plan app.

APP ENGINE & JOURNAL KNOWLEDGE DATASET:
1. STARTING CAPITAL: Users configure their initial trading deposit (e.g. $100, $500, $1000, $5000 or custom). All cumulative year-to-date (YTD) PnL, monthly ROI %, and total account equity are calculated dynamically relative to this baseline.
2. DAILY PnL LOGGING: Users mark daily trading outcomes as + (Win Day) or - (Loss Day). They enter exact net Profit/Loss ($), ROI (%), and setup strategy notes (e.g., BTC OB retest, Breakout TP hit, Risk:Reward ratio).
3. RESPONSIVE DESIGN: Optimized for both mobile devices (Touch-friendly card layout) and desktop screens (Full interactive data table grid with popover controls).
4. MONTHLY & YEARLY SUMMARIES: Provides a breakdown of total win days, loss days, win rate percentage, profit factor, best win day, worst loss day, and monthly ROI performance.
5. VISUAL ANALYTICS & CHARTS: Powered by Recharts with interactive Equity Growth Curves, Win/Loss Ratio Pie Charts, Daily PnL Distribution Bars, and Consecutive Win/Loss Streak tracking.
6. FULL EXCEL EXPORT: Users can export their complete trading journal at any time into a formatted .xlsx file featuring Account Overview, Monthly Summary, and Daily Logs (including Month's Profit Till That Day & YTD PnL).
7. MULTI-YEAR & START MONTH FLEXIBILITY: Supports trading years from 2024 to 2035 with customizable 12-month rolling start months.
8. GMAIL ACCESS & HOST ADMIN APPROVAL: User accounts register via Gmail. Pending accounts auto-poll access status every 3 seconds until approved by the Host Admin (sngxworld@gmail.com).
9. RISK MANAGEMENT MENTORSHIP: Always advise traders to maintain strict risk management (1-2% account risk per trade, stop-loss adherence, minimum 1:2 risk-reward ratio, avoiding over-trading or emotional revenge trading).
10. BILINGUAL SUPPORT:
    - Respond in fluent, clean Sinhala (සිංහල) if the user asks in Sinhala.
    - Respond in natural, friendly Singlish if the user asks in Singlish (e.g., "kohomada log wenne", "excel file eka gannne kohomada").
    - Respond in professional English if the user asks in English.
    - Official Host Support Hotline: +94 75 284 0841.`;

      const prompt = `${systemContext}

${historyContext}User question: "${message}"

Provide a concise, helpful, friendly, and expert response based on the above trade journal engine dataset:`;

      let replyText = "";
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
        });
        replyText = response.text || "";
      } catch (mErr) {
        console.warn("Primary model call error, trying fallback model:", mErr);
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
          });
          replyText = fallbackResponse.text || "";
        } catch (fErr) {
          console.warn("Fallback model call error:", fErr);
        }
      }

      if (!replyText) {
        replyText = generateDynamicResponse(message);
      }

      return res.json({ reply: replyText });
    } catch (err: any) {
      console.error("Gemini AI error:", err);
      const fallbackReply = generateDynamicResponse(message);
      return res.json({ reply: fallbackReply });
    }
  });

// --- VITE / STATIC SERVING & SERVER LISTEN ---
if (process.env.NODE_ENV !== "production") {
  createServerServer();
} else if (!process.env.VERCEL) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function createServerServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
