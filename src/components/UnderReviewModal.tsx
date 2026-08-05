import React, { useState } from "react";
import { UserProfile } from "../types";
import { Clock, CheckCircle2, RefreshCw, LogOut, ShieldAlert } from "lucide-react";

interface UnderReviewModalProps {
  user: UserProfile;
  onRefreshStatus: () => void;
  onLogout: () => void;
}

export const UnderReviewModal: React.FC<UnderReviewModalProps> = ({
  user,
  onRefreshStatus,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshStatus();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-[500px] bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden p-6 sm:p-8 flex flex-col items-center text-center relative">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-6 shadow-inner shadow-amber-500/20">
          <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Account Under Review</h2>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
          Thank you for registering. For security and quality control, our team must manually verify access for{" "}
          <span className="text-indigo-400 font-mono font-semibold italic bg-slate-800 px-2 py-0.5 rounded">
            {user.email}
          </span>{" "}
          before the charts, metrics, and trading terminal are enabled.
        </p>

        <div className="w-full space-y-3 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between text-left border border-slate-700/50">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                Registration Status
              </p>
              <p className="text-xs font-semibold text-emerald-400">
                Step 1: Account Registered & Queued
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between text-left border border-amber-500/30 bg-amber-500/5">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                Account Verification
              </p>
              <p className="text-xs font-semibold text-amber-500">
                Step 2: Awaiting Access Verification
              </p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0"></div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg w-full mb-6 text-left flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-400 leading-tight">
            <span className="font-semibold text-slate-200">Direct Support Line:</span> Contact support directly via WhatsApp / Mobile at{" "}
            <span className="text-indigo-400 font-mono font-bold">+94 75 284 0841</span> to expedite your account authorization.
          </div>
        </div>

        <div className="flex gap-3 w-full mb-3">
          <button
            onClick={onLogout}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition-all text-xs border border-slate-700 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            Switch Account
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-all text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Checking..." : "Refresh Status"}
          </button>
        </div>

        <p className="mt-6 text-[11px] text-slate-500">
          Once your account access is verified, you will be able to access the trading terminal instantly.
        </p>
      </div>
    </div>
  );
};
