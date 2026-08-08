import React from "react";
import { UserProfile } from "../types";
import { ShieldCheck, UserCheck, Clock, LogOut, LayoutDashboard, Settings, HelpCircle } from "lucide-react";

interface NavbarProps {
  user: UserProfile | null;
  activeView: "app" | "admin";
  setActiveView: (view: "app" | "admin") => void;
  onLogout: () => void;
  onRefreshStatus?: () => void;
  onReplayTutorial?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  setActiveView,
  onLogout,
  onReplayTutorial,
}) => {
  return (
    <nav className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-2.5 sm:px-8 shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30 text-xs sm:text-sm shrink-0">
          TJ
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-base md:text-lg font-bold tracking-tight text-slate-100 truncate">
              Trade Journal <span className="text-indigo-400 font-extrabold">Pro</span>
            </span>
            <span className="hidden md:inline-block text-[10px] bg-slate-800 text-indigo-400 border border-slate-700 px-2 py-0.5 rounded font-mono">
              v2.4 CORE
            </span>
          </div>
          <span className="hidden sm:block text-[10px] text-slate-500 font-mono tracking-wider uppercase truncate">
            SNGxJOURNAL Ecosystem Matrix
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-4 shrink-0">
        {/* Navigation Switcher between Client App & Host Admin Portal */}
        {user && (
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveView("app")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                activeView === "app"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Journal</span>
              <span className="xs:hidden sm:hidden">App</span>
            </button>

            {user.role === "admin" && (
              <button
                onClick={() => setActiveView("admin")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  activeView === "admin"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </div>
        )}

        {/* Status indicator */}
        {user && (
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-800 text-xs">
            {user.role === "admin" ? (
              <>
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-indigo-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Host Master Admin
                </span>
              </>
            ) : user.status === "approved" ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Access Granted
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                <span className="text-amber-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pending Access Approval
                </span>
              </>
            )}
          </div>
        )}

        {/* User Gmail badge & tutorial & logout */}
        {user ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {onReplayTutorial && (
              <button
                onClick={onReplayTutorial}
                title="Replay 3D AI Tutorial / 3D නිබන්ධනය බලන්න"
                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 border border-indigo-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">3D Tutorial</span>
                <span className="sm:hidden">Tutorial</span>
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200 font-mono truncate max-w-[130px] sm:max-w-[160px]">
                {user.email}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                @{user.username}
              </p>
            </div>

            <button
              onClick={onLogout}
              title="Logout session"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg font-mono">
            Auth Required
          </div>
        )}
      </div>
    </nav>
  );
};
