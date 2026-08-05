import React from "react";
import { UserProfile } from "../types";
import { ShieldCheck, UserCheck, Clock, LogOut, LayoutDashboard, Settings } from "lucide-react";

interface NavbarProps {
  user: UserProfile | null;
  activeView: "app" | "admin";
  setActiveView: (view: "app" | "admin") => void;
  onLogout: () => void;
  onRefreshStatus?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  setActiveView,
  onLogout,
}) => {
  return (
    <nav className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
          TP
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
              TradePlan <span className="text-indigo-400 font-extrabold">Pro</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-indigo-400 border border-slate-700 px-2 py-0.5 rounded font-mono">
              v2.4 CORE
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
            SNGxCRYPTO Ecosystem Matrix
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        {/* Status indicator */}
        {user && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-800 text-xs">
            {user.status === "approved" || user.role === "admin" ? (
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

        {/* User Gmail badge & logout */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200 font-mono truncate max-w-[160px]">
                {user.email}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                @{user.username}
              </p>
            </div>

            <button
              onClick={onLogout}
              title="Logout session"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg font-mono">
            Authorization Required
          </div>
        )}
      </div>
    </nav>
  );
};
