import React, { useState, useEffect } from "react";
import { UserProfile } from "./types";
import { Navbar } from "./components/Navbar";
import { GatewayScreen } from "./components/GatewayScreen";
import { UnderReviewModal } from "./components/UnderReviewModal";
import { TradingApp } from "./components/TradingApp";
import { RobotTutorialOverlay } from "./components/RobotTutorialOverlay";
import { ProfileEditorModal } from "./components/ProfileEditorModal";
import { CommunityChatHub } from "./components/CommunityChatHub";
import { checkIsTrialExpired } from "./utils/deviceUtils";

export default function App() {
  const [activeView, setActiveView] = useState<"journal" | "community">("journal");

  // Active User session loaded from localStorage if present
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("tradeplan_active_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Profile Editor Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Tutorial overlay state
  const [showTutorial, setShowTutorial] = useState(false);

  // Keep localStorage tradeplan_active_user in sync with currentUser state
  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem("tradeplan_active_user", JSON.stringify(currentUser));
      } catch (e) {}
    }
  }, [currentUser]);

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

  // Replay Tutorial
  const handleReplayTutorial = () => {
    setShowTutorial(true);
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

  // Calculate 5-Day Trial Status (strict device & user account check)
  const isApprovedUser = currentUser?.status === "approved" || currentUser?.role === "admin" || currentUser?.email?.toLowerCase() === "sngxworld@gmail.com";
  const isTrialExpired = !isApprovedUser && checkIsTrialExpired(currentUser);

  // Auto-poll approval status every 3 seconds if user is awaiting host admin approval
  useEffect(() => {
    if (!currentUser || isApprovedUser) return;
    const interval = setInterval(handleRefreshStatus, 3000);
    return () => clearInterval(interval);
  }, [currentUser?.email, currentUser?.status, isApprovedUser]);

  const handleLogout = () => {
    try {
      localStorage.removeItem("tradeplan_active_user");
      sessionStorage.removeItem("tradeplan_active_user");
    } catch (e) {}
    setCurrentUser(null);
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

  // 2. Render Primary Application with TradingApp
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative">
      {/* 3D Robot First-Login Interactive Tutorial Overlay */}
      {showTutorial && !isTrialExpired && (
        <RobotTutorialOverlay
          onComplete={handleFinishTutorial}
          onSkip={handleFinishTutorial}
        />
      )}

      {/* Top Navbar */}
      <Navbar
        user={currentUser}
        onLogout={handleLogout}
        onRefreshStatus={handleRefreshStatus}
        onReplayTutorial={handleReplayTutorial}
        onOpenProfile={() => setIsProfileOpen(true)}
        activeView={activeView}
        onToggleView={(v) => setActiveView(v)}
      />

      {/* Profile Editor Modal */}
      {isProfileOpen && currentUser && (
        <ProfileEditorModal
          user={currentUser}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
          onLogout={() => {
            setIsProfileOpen(false);
            handleLogout();
          }}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* If 5-Day trial is expired and user is not approved, show Modal overlay over blurred background */}
        {isTrialExpired && (
          <UnderReviewModal
            user={currentUser}
            onRefreshStatus={handleRefreshStatus}
            onLogout={handleLogout}
            isTrialExpired={true}
          />
        )}

        <div
          className={`transition-all duration-300 ${
            isTrialExpired
              ? "opacity-25 blur-md pointer-events-none select-none overflow-hidden max-h-[calc(100vh-64px)]"
              : "opacity-100"
          }`}
        >
          {activeView === "community" ? (
            <CommunityChatHub
              currentUser={currentUser}
              onBackToApp={() => setActiveView("journal")}
            />
          ) : (
            <main className="container max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <TradingApp
                user={currentUser}
                onSaveDataToServer={() => {
                  // Saved data callback
                }}
              />
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
