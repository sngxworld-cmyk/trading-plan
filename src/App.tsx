import React, { useState, useEffect, useRef } from "react";
import { UserProfile, TradingDataStore } from "./types";
import { Navbar } from "./components/Navbar";
import { GatewayScreen } from "./components/GatewayScreen";
import { UnderReviewModal } from "./components/UnderReviewModal";
import { HostAdminPortal } from "./components/HostAdminPortal";
import { TradingApp } from "./components/TradingApp";
import { Robot3D } from "./components/Robot3D";
import { RobotTutorialOverlay } from "./components/RobotTutorialOverlay";
import { Sparkles, X, Send, HelpCircle, RefreshCw } from "lucide-react";

export default function App() {
  // Active User session
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<"app" | "admin">("app");

  // Tutorial overlay state
  const [showTutorial, setShowTutorial] = useState(false);

  // AI Chatbot State
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [botMessages, setBotMessages] = useState<
    { sender: "bot" | "user"; text: string }[]
  >([
    {
      sender: "bot",
      text: "ආයුබෝවන්! Hello! SNGxJOURNAL 3D AI Assistant is active. Ask me anything about your trade journal, risk management, or app features in Sinhala, Singlish, or English!",
    },
  ]);
  const [botInput, setBotInput] = useState("");
  const [isBotThinking, setIsBotThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Clear persistent session tokens on startup so user enters gateway screen fresh
  useEffect(() => {
    localStorage.removeItem("tradeplan_active_user");
    sessionStorage.removeItem("tradeplan_active_user");
  }, []);

  // Check tutorial status whenever an approved user logs in
  useEffect(() => {
    if (currentUser && currentUser.status === "approved") {
      const tutorialKey = "sngx_tutorial_seen_" + currentUser.email.toLowerCase();
      const hasSeen = localStorage.getItem(tutorialKey);
      if (!hasSeen) {
        setShowTutorial(true);
      }
    }
  }, [currentUser?.email, currentUser?.status]);

  // Complete / Skip Tutorial
  const handleFinishTutorial = () => {
    if (currentUser) {
      const tutorialKey = "sngx_tutorial_seen_" + currentUser.email.toLowerCase();
      localStorage.setItem(tutorialKey, "true");
    }
    setShowTutorial(false);
  };

  // Replay Tutorial manually from Bot
  const handleReplayTutorial = () => {
    setShowTutorial(true);
    setIsBotOpen(false);
  };

  // Refresh review status from local state & server
  const handleRefreshStatus = async () => {
    if (!currentUser) return;
    const cleanEmail = currentUser.email.trim().toLowerCase();

    // Check local pre-approved list & stored users
    const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const matchedLocal = localUsers.find((u) => u.email && u.email.trim().toLowerCase() === cleanEmail);

    let newStatus = matchedLocal?.status;
    let newRole = matchedLocal?.role;

    const preApprovedList: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    if (cleanEmail === "sngxworld@gmail.com" || preApprovedList.some((e: string) => e.toLowerCase() === cleanEmail)) {
      newStatus = "approved";
    }

    try {
      const res = await fetch(`/api/auth/status/${encodeURIComponent(currentUser.email)}`);
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        if (data.status) {
          newStatus = data.status;
          if (data.role) newRole = data.role;
        }
      }
    } catch (err) {
      console.warn("Server status refresh notice:", err);
    }

    if (newStatus && (newStatus !== currentUser.status || (newRole && newRole !== currentUser.role))) {
      setCurrentUser((prev) =>
        prev ? { ...prev, status: newStatus, role: newRole || prev.role } : null
      );
    }
  };

  // Auto-poll approval status every 3 seconds if client is pending review
  useEffect(() => {
    if (!currentUser || currentUser.status !== "pending") return;
    const interval = setInterval(handleRefreshStatus, 3000);
    return () => clearInterval(interval);
  }, [currentUser?.email, currentUser?.status]);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView("app");
  };

  // Chatbot Send Message
  const handleSendBotMessage = async (textToSend?: string) => {
    const text = textToSend || botInput.trim();
    if (!text) return;

    setBotMessages((prev) => [...prev, { sender: "user", text }]);
    if (!textToSend) setBotInput("");
    setIsBotThinking(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: botMessages.slice(-6),
        }),
      });
      const data = await res.json();
      setBotMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.reply || "SNGxJOURNAL 3D AI Assistant online." },
      ]);
    } catch (err) {
      setBotMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "SNGxJOURNAL 3D AI Assistant active. For access assistance, contact host line: +94 75 284 0841.",
        },
      ]);
    } finally {
      setIsBotThinking(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  // 1. If user is not logged in -> Show Gateway Screen
  if (!currentUser) {
    return (
      <GatewayScreen
        onLoginSuccess={(user) => setCurrentUser(user)}
        onRegisteredPending={(user) => setCurrentUser(user)}
      />
    );
  }

  // 2. If user role is admin and active view is "admin" -> Render Host Admin Portal
  if (currentUser.role === "admin" && activeView === "admin") {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar
          user={currentUser}
          activeView={activeView}
          setActiveView={setActiveView}
          onLogout={handleLogout}
          onRefreshStatus={handleRefreshStatus}
        />
        <HostAdminPortal onReturnToApp={() => setActiveView("app")} />
      </div>
    );
  }

  // Quick suggestion chips
  const quickSuggestions = [
    { label: "ලොගින් අනුමැතිය ලබාගන්නේ කෙසේද?", query: "ලොගින් අනුමැතිය ලබාගන්නේ කෙසේද?" },
    { label: "Excel Export කරන්නේ කෙසේද?", query: "Excel Export කරන්නේ කෙසේද?" },
    { label: "Trading Risk Management උපදෙස්", query: "Give me key trading risk management rules." },
  ];

  // 3. Render Primary Application with TradingApp
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative">
      {/* 3D Robot First-Login Interactive Tutorial Overlay */}
      {showTutorial && (
        <RobotTutorialOverlay
          onComplete={handleFinishTutorial}
          onSkip={handleFinishTutorial}
        />
      )}

      {/* Top Navbar */}
      <Navbar
        user={currentUser}
        activeView={activeView}
        setActiveView={setActiveView}
        onLogout={handleLogout}
        onRefreshStatus={handleRefreshStatus}
      />

      {/* Main Content Area */}
      <div className="flex-1 relative animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* If user status is pending (Under Review), show Modal overlay over blurred background */}
        {currentUser.status === "pending" && (
          <UnderReviewModal
            user={currentUser}
            onRefreshStatus={handleRefreshStatus}
            onLogout={handleLogout}
          />
        )}

        <main
          className={`container max-w-7xl mx-auto px-4 sm:px-6 py-6 transition-all duration-300 ${
            currentUser.status === "pending"
              ? "opacity-30 blur-sm pointer-events-none select-none"
              : "opacity-100"
          }`}
        >
          <TradingApp
            user={currentUser}
            onSaveDataToServer={() => {
              // Saved data callback
            }}
          />
        </main>
      </div>

      {/* Floating 3D Robot Mascot Trigger Button (Bottom Right) */}
      {!isBotOpen && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5 animate-in zoom-in-90 duration-300">
          <div
            onClick={() => setIsBotOpen(true)}
            className="relative group cursor-pointer"
            title="Open SNGxJOURNAL 3D AI Assistant"
          >
            {/* Pulsing ambient glow ring behind 3D Robot */}
            <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl group-hover:scale-125 transition-transform duration-300 animate-pulse" />
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-900/90 border border-indigo-500/50 rounded-full shadow-2xl shadow-indigo-600/40 flex items-center justify-center relative overflow-hidden backdrop-blur-md group-hover:border-indigo-400 group-hover:scale-105 transition-all">
              <Robot3D size={80} isTalking={isBotThinking} className="pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Chat Window */}
      {isBotOpen && (
        <div className="fixed bottom-4 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-96 h-[480px] bg-slate-900/95 border border-indigo-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-indigo-500/40 overflow-hidden flex items-center justify-center">
                <Robot3D size={42} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    SNGxJOURNAL 3D AI Assistant
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Sinhala & English Trading Mentor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleReplayTutorial}
                title="Replay 3D Tutorial / නිබන්ධනය පෙන්වන්න"
                className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-mono border border-indigo-500/30 flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Tutorial</span>
              </button>
              <button
                onClick={() => setIsBotOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Suggestions Bar */}
          <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendBotMessage(s.query)}
                className="text-[10px] font-sans whitespace-nowrap bg-slate-800/80 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-500/20 px-2.5 py-1 rounded-full transition-all active:scale-95"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 font-sans text-xs">
            {botMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none shadow-md"
                      : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-inner"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isBotThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-300 p-3 rounded-2xl rounded-bl-none text-xs flex items-center gap-2 border border-slate-700/60">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>3D AI Mentor is thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={botInput}
              onChange={(e) => setBotInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendBotMessage()}
              placeholder="Ask in English or Sinhala (සිංහල)..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleSendBotMessage()}
              disabled={isBotThinking}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
