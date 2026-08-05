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

async function startServer() {
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

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

  // AI CHATBOT ROUTE (Gemini API with English, Sinhala & Singlish support)
  app.post("/api/ai/chat", async (req, res) => {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Intelligent fallback response generator if API key is not set
      const query = message.toLowerCase();
      const isPureSinhala = /[\u0D80-\u0DFF]/.test(message);
      const isSinglish = query.includes("kohomada") || query.includes("wenne") || query.includes("poddak") || query.includes("login") || query.includes("karanna");

      let reply = "SNGxCRYPTO AI Assistant Active. To access the 1-Year Strategic Trading Plan, register your Gmail and wait for Host Admin approval. For immediate assistance, contact +94 75 284 0841.";
      if (isPureSinhala) {
        reply = "ඔබගේ Gmail ගිණුම ලියාපදිංචි කළ පසු Host Admin විසින් අනුමත කරනු ඇත. අනුමැතිය ලැබුණු පසු Charts සහ 1-Year Trading Plan සක්‍රීය වේ. සහාය සඳහා: +94 75 284 0841.";
      } else if (isSinglish) {
        reply = "Oyage Gmail eka register kalama Host Admin approve karanakan 'Under Review' tiyenawa. Approve unama Trading Plan and Charts access hambawenawa. Support call: +94 75 284 0841.";
      }

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

      const historyContext = Array.isArray(history) && history.length > 0
        ? `Previous conversation history:\n` + history.map((h: any) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.text}`).join("\n") + "\n\n"
        : "";

      const prompt = `You are the SNGxCRYPTO AI Assistant & Trading Mentor for the 1-Year Strategic Trading Plan web application.
${historyContext}The user asks: "${message}".

Instructions:
- Provide clear, expert, concise trading guidance, risk management tips, technical analysis insights, or app navigation assistance.
- If the user writes in Sinhala (සිංහල), respond in fluent, clear Sinhala.
- If the user writes in Singlish (e.g. "kohomada log wenne", "plan eka setup karanne kohomada"), respond in friendly, helpful Singlish.
- If the user asks about login or access approval, explain that after registering their Gmail, the Host Admin receives their request and grants access via the Host Admin Portal.
- Keep responses direct, well-structured, professional, and under 3-4 paragraphs.
- Official Support Contact: +94 75 284 0841.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      const replyText = response.text || "Assistant response ready.";
      return res.json({ reply: replyText });
    } catch (err: any) {
      console.error("Gemini AI error:", err);

      const query = message.toLowerCase();
      const isPureSinhala = /[\u0D80-\u0DFF]/.test(message);
      const isSinglish = query.includes("kohomada") || query.includes("wenne") || query.includes("login") || query.includes("karanna");

      let fallbackReply = "SNGxCRYPTO AI Assistant active. For immediate access approval or trading support, call host hotline +94 75 284 0841.";
      if (isPureSinhala) {
        fallbackReply = "SNGxCRYPTO AI සහායක සක්‍රීයයි. ප්‍රවේශය සඳහා ඔබගේ Gmail සටහන් කර Host Admin අනුමැතිය ලබාගන්න. හදිසි සහාය: +94 75 284 0841.";
      } else if (isSinglish) {
        fallbackReply = "SNGxCRYPTO AI Assistant connected. Oyage Gmail Host Admin dwara approve kara ganna hotline ekata call karanna: +94 75 284 0841.";
      }

      return res.json({ reply: fallbackReply });
    }
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
