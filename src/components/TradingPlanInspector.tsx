import React, { useState } from "react";
import { UserProfile, TradingDataStore, DayRecord } from "../types";
import {
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  Tag,
  DollarSign,
  TrendingUp,
  Award,
  BookOpen,
  Copy,
  Check,
  Sparkles,
  Activity,
  Layers,
  FileText,
  HelpCircle,
} from "lucide-react";

interface TradingPlanInspectorProps {
  user: UserProfile;
  dataStore: TradingDataStore;
  startingCapital: string;
}

export const TradingPlanInspector: React.FC<TradingPlanInspectorProps> = ({
  user,
  dataStore,
  startingCapital,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Calculate high-level performance stats from dataStore
  const computeStats = () => {
    let totalPnl = 0;
    let greenDays = 0;
    let redDays = 0;
    let neutralDays = 0;

    Object.values(dataStore || {}).forEach((yearData) => {
      Object.values(yearData || {}).forEach((monthData) => {
        Object.values(monthData || {}).forEach((dayItem) => {
          const day = dayItem as DayRecord;
          if (day && day.amount) {
            const amt = parseFloat(day.amount);
            if (!isNaN(amt)) {
              totalPnl += amt;
              if (amt > 0) greenDays++;
              else if (amt < 0) redDays++;
              else neutralDays++;
            }
          }
        });
      });
    });

    const startCapNum = parseFloat(startingCapital.replace(/[^0-9.-]+/g, "")) || 100;
    const finalBalance = startCapNum + totalPnl;
    const totalTrades = greenDays + redDays;
    const winRate = totalTrades > 0 ? ((greenDays / totalTrades) * 100).toFixed(1) : "0.0";
    const overallRoi = startCapNum > 0 ? ((totalPnl / startCapNum) * 100).toFixed(1) : "0.0";

    return {
      totalPnl,
      startCapNum,
      finalBalance,
      greenDays,
      redDays,
      neutralDays,
      winRate,
      overallRoi,
    };
  };

  const stats = computeStats();

  // Host Admin Web Integration Prompt
  const hostAdminPromptText = `You are updating the Host Admin Web Portal (Trading Plan Inspector).
Please implement the "Trading Plan Inspector" view in the Host Admin Web applet with the following capabilities:

1. Query Firestore collection 'users' to list all clients with full details:
   - Profile Photo (photoURL) or WhatsApp-style default avatar silhouette
   - Email address, Unique Username (@handle), Display Name, Phone / Telegram contact
   - Access Status (approved / pending / revoked), Role (admin / client), Created At, Last Login
   - Primary Trading Asset (tradingPair), Starting Capital, Bio & Strategy Notes
2. Under the "Trading Plan Inspector" section for any selected client:
   - Display their complete profile avatar photo, contact info, and registration status.
   - Calculate live trade metrics from 'users/{email}/tradingData': Starting Capital, Total Net P&L ($), Current Balance, Green Days, Red Days, Win Rate %, and Overall ROI %.
   - Render an interactive monthly calendar/grid audit log of their trade entries.
   - Provide Approval/Revoke access toggles for Host Admin.
3. Keep real-time Firestore listener 'onSnapshot(doc(db, "users", cleanEmail))' active so client profile updates and photo uploads render instantaneously in the Host Admin Inspector.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(hostAdminPromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Host Admin Web Integration Banner */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Host Admin Web Portal Integration Prompt
                </h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                  COPY & PASTE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Paste this exact prompt into your separate <strong>Host Admin Web</strong> applet chat so its <em>Trading Plan Inspector</em> will automatically display all client profile photos, contact details, starting capital & trading logs!
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyPrompt}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Host Admin Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Inspector Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6">
        {/* Section Title */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Trading Plan Inspector
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Client Profile & Real-Time Trading Performance Matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono text-emerald-400 font-semibold uppercase">
              Firestore Sync Active
            </span>
          </div>
        </div>

        {/* Client Profile Overview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Avatar & Personal Info (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              {/* WhatsApp-Style Default Photo Logo fallback if photoURL empty */}
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.username}
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-xl shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 shadow-inner relative overflow-hidden shrink-0">
                  <div className="w-8 h-8 rounded-full bg-slate-600/70 mb-[-10px] flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-300" />
                  </div>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-white truncate">
                  {user.displayName || user.username}
                </h3>
                <p className="text-xs text-indigo-400 font-mono truncate">
                  @{user.username}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {user.status}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Meta Details */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Gmail Account
                </span>
                <span className="text-slate-200 font-semibold">{user.email}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> Phone / Contact
                </span>
                <span className="text-slate-200 font-semibold">
                  {user.phone || "Not Provided"}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" /> Primary Asset
                </span>
                <span className="text-indigo-400 font-bold">
                  {user.tradingPair || "BTC/USDT"}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" /> Starting Capital
                </span>
                <span className="text-emerald-400 font-bold">
                  {user.startingCapital || startingCapital || "$100"}
                </span>
              </div>
            </div>

            {/* Strategy Bio */}
            {user.bio && (
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-mono">
                  Strategy Bio & Model
                </span>
                <p className="italic font-sans text-slate-300">{user.bio}</p>
              </div>
            )}
          </div>

          {/* Right: Live Trading Plan Performance Stats (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
              Live Journal Performance Matrix
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                  Net Realized P&L
                </span>
                <span
                  className={`text-base sm:text-lg font-bold font-mono ${
                    stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {stats.totalPnl >= 0 ? "+" : ""}$
                  {stats.totalPnl.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                  Current Balance
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-indigo-400">
                  $
                  {stats.finalBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                  Overall ROI %
                </span>
                <span
                  className={`text-base sm:text-lg font-bold font-mono ${
                    parseFloat(stats.overallRoi) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {parseFloat(stats.overallRoi) >= 0 ? "+" : ""}
                  {stats.overallRoi}%
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                  Win Rate %
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-amber-400">
                  {stats.winRate}%
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                  Green / Red Days
                </span>
                <span className="text-xs sm:text-sm font-bold font-mono text-slate-200">
                  <span className="text-emerald-400">{stats.greenDays}W</span> /{" "}
                  <span className="text-rose-400">{stats.redDays}L</span>
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                  Total Logged Days
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-slate-200">
                  {stats.greenDays + stats.redDays + stats.neutralDays}
                </span>
              </div>
            </div>

            {/* Audit Log Banner */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" /> Host Admin Firestore Path
                </span>
                <span className="font-mono text-indigo-400">users/{user.email}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All client entries, profile avatar uploads, starting capital changes, and day-by-day P&L records are continuously streamed into Firestore for instant Host Admin oversight.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
