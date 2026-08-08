import React, { useState, useEffect, useRef } from "react";
import { UserProfile, TradingDataStore } from "./types";
import { Navbar } from "./components/Navbar";
import { GatewayScreen } from "./components/GatewayScreen";
import { UnderReviewModal } from "./components/UnderReviewModal";
import { HostAdminPortal } from "./components/HostAdminPortal";
import { TradingApp } from "./components/TradingApp";
import { Sparkles, X, Send } from "lucide-react";

export default function App() {
  // Active User session
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<"app" | "admin">("app");

  // AI Chatbot State
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [botMessages, setBotMessages] = useState<
    { sender: "bot" | "user"; text: string }[]
  >([
    {
      sender: "bot",
      text: "Hello! SNGxJOURNAL AI Trading Assistant active. Ask me anything about your trading metrics, login, or trade goals.",
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
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setBotMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.reply || "SNGxJOURNAL Assistant online." },
      ]);
    } catch (err) {
      setBotMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "SNGxJOURNAL Assistant active. For urgent access assistance, contact host line: +94 75 284 0841.",
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

  // 3. Render Primary Application with TradingApp
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        user={currentUser}
        activeView={activeView}
        setActiveView={setActiveView}
        onLogout={handleLogout}
        onRefreshStatus={handleRefreshStatus}
      />

      {/* Main Content Area */}
      <div className="flex-1 relative">
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
            onSaveDataToServer={(data) => {
              // Saved data callback
            }}
          />
        </main>
      </div>

      {/* Floating AI Assistant Trigger Button */}
      <button
        onClick={() => setIsBotOpen(!isBotOpen)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-600/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-indigo-400/30"
        title="Open SNGxJOURNAL AI Assistant"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
      </button>

      {/* AI Assistant Chat Window */}
      {isBotOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-96 h-[420px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              <span className="text-xs font-bold text-white tracking-wide">
                SNGxJOURNAL AI Assistant
              </span>
            </div>
            <button
              onClick={() => setIsBotOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
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
                  className={`max-w-[85%] p-3 rounded-xl leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none shadow-md"
                      : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isBotThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 p-3 rounded-xl rounded-bl-none text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>AI assistant is thinking...</span>
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
              placeholder="Ask about login, trading goals, or PnL..."
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
