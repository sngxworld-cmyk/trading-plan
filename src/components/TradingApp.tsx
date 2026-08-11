import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  UserProfile,
  TradingDataStore,
  DayRecord,
  MonthData,
} from "../types";
import { saveUserDataToFirestore, subscribeUserDataFromFirestore } from "../lib/userStore";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, BarElement } from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { exportTradingPlanToExcel } from "../utils/excelExport";
import { TradingPlanInspector } from "./TradingPlanInspector";
import {
  Download,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  BarChart3,
  Calendar,
  Grid,
  Target,
  Plus,
  Minus,
  CheckCircle2,
  TrendingUp,
  Award,
  DollarSign,
  ShieldAlert,
  Layers,
  Activity,
  FileText,
  PieChart,
  Globe,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface TradingAppProps {
  user: UserProfile;
  onSaveDataToServer: (data: TradingDataStore) => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const TradingApp: React.FC<TradingAppProps> = ({ user, onSaveDataToServer }) => {
  const [activeTab, setActiveTab] = useState<"grid" | "summary" | "goal" | "inspector">("grid");
  const [summarySubTab, setSummarySubTab] = useState<"monthly" | "yearly" | "overall">("monthly");
  
  const [yearRange, setYearRange] = useState("2026");
  const [startMonth, setStartMonth] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [startingCapital, setStartingCapital] = useState<string>("100");

  // Trading Data Store
  const [dataStore, setDataStore] = useState<TradingDataStore>(() => {
    if (user.tradingData && Object.keys(user.tradingData).length > 0) return user.tradingData;
    const local = localStorage.getItem(`trading_store_${user.email}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Object.keys(parsed).length > 0) return parsed;
      } catch (e) {}
    }
    return {};
  });

  const [activePopupDay, setActivePopupDay] = useState<number | null>(null);
  const isInitialMount = useRef(true);

  // Sync prop changes into dataStore
  useEffect(() => {
    if (user.tradingData && Object.keys(user.tradingData).length > 0) {
      setDataStore((prev) => {
        if (!prev || Object.keys(prev).length === 0) return user.tradingData!;
        return { ...user.tradingData, ...prev };
      });
    }
  }, [user.tradingData, user.email]);

  // Subscribe to real-time Firestore data for user's Gmail
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = subscribeUserDataFromFirestore(user.email, (data) => {
      if (data?.tradingData && Object.keys(data.tradingData).length > 0) {
        setDataStore((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data.tradingData)) {
            return data.tradingData;
          }
          return prev;
        });
      }
      if (data?.yearRange) setYearRange(data.yearRange);
      if (data?.startMonth !== undefined) {
        setStartMonth(data.startMonth);
      }
      if (data?.startingCapital !== undefined) {
        setStartingCapital(data.startingCapital);
      }
    });

    return () => unsubscribe();
  }, [user.email]);

  // Auto save data under user's Gmail (Firestore + localStorage + server API)
  useEffect(() => {
    if (!user?.email) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (Object.keys(dataStore).length === 0) return;
    }

    try {
      localStorage.setItem(`trading_store_${user.email}`, JSON.stringify(dataStore));
    } catch (e) {}

    saveUserDataToFirestore(user.email, dataStore, { yearRange, startMonth, startingCapital });
    onSaveDataToServer(dataStore);
  }, [dataStore, user.email, yearRange, startMonth, startingCapital]);

  // Ensure store exists for current year range
  const ensureRangeStore = (store: TradingDataStore, range: string) => {
    if (!store[range]) {
      store[range] = {};
      for (let m = 0; m < 12; m++) {
        store[range][m] = {};
      }
    }
    return store;
  };

  const getDaysInMonth = (mIdx: number) => {
    if (mIdx === 1) {
      const match = yearRange.match(/\d{4}/);
      const year = match ? parseInt(match[0]) : 2026;
      if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) return 29;
      return 28;
    }
    return MONTH_DAYS[mIdx];
  };

  // Rolling 12 Months starting from startMonth
  const rollingMonths = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const idx = (startMonth + i) % 12;
      arr.push({ idx, name: MONTH_NAMES[idx] });
    }
    return arr;
  }, [startMonth]);

  // Current Selected Month Data
  const currentMonthData = useMemo(() => {
    const currentStore = ensureRangeStore({ ...dataStore }, yearRange);
    return currentStore[yearRange][selectedMonth] || {};
  }, [dataStore, yearRange, selectedMonth]);

  const updateDayRecord = (day: number, updates: Partial<DayRecord>) => {
    setDataStore((prev) => {
      const next = { ...prev };
      ensureRangeStore(next, yearRange);
      const existing = next[yearRange][selectedMonth][day] || { state: "", amount: "", roi: "", description: "" };
      next[yearRange][selectedMonth][day] = { ...existing, ...updates };
      return { ...next };
    });
  };

  const setRowState = (day: number, state: "green" | "red" | "") => {
    updateDayRecord(day, { state });
    setActivePopupDay(null);
  };

  // Comprehensive Metrics Engine (Monthly, Yearly, Overall All-Time)
  const metrics = useMemo(() => {
    const currentYearStore = dataStore[yearRange] || {};

    // 1. MONTHLY METRICS (Selected Month)
    let mWins = 0,
      mLosses = 0,
      mAmount = 0,
      mRoi = 0;
    const daysInSelMonth = getDaysInMonth(selectedMonth);
    const mData = currentYearStore[selectedMonth] || {};

    const mChartLabels: string[] = [];
    const mChartPoints: number[] = [];
    let mCumulative = 0;

    for (let d = 1; d <= daysInSelMonth; d++) {
      const rec = mData[d] || { state: "", amount: "", roi: "" };
      const pAmt = parseFloat(rec.amount) || 0;
      const pRoi = parseFloat(rec.roi) || 0;

      if (rec.state === "green") {
        mWins++;
        mAmount += pAmt;
        mRoi += pRoi;
        mCumulative += pAmt;
      } else if (rec.state === "red") {
        mLosses++;
        mAmount -= pAmt;
        mRoi -= pRoi;
        mCumulative -= pAmt;
      }

      mChartLabels.push(`Day ${d}`);
      mChartPoints.push(mCumulative);
    }

    // 2. YEARLY METRICS (Current Year Range)
    let yWins = 0,
      yLosses = 0,
      yAmount = 0,
      yRoi = 0;

    const yChartLabels: string[] = [];
    const yMonthlyAmounts: number[] = [];
    const yCumulativePoints: number[] = [];
    let yCumulative = 0;

    for (let m = 0; m < 12; m++) {
      const monthIdx = (startMonth + m) % 12;
      const daysCount = getDaysInMonth(monthIdx);
      const monthRecs = currentYearStore[monthIdx] || {};

      let thisMonthAmount = 0;

      for (let d = 1; d <= daysCount; d++) {
        const rec = monthRecs[d] || { state: "", amount: "", roi: "" };
        const pAmt = parseFloat(rec.amount) || 0;
        const pRoi = parseFloat(rec.roi) || 0;

        if (rec.state === "green") {
          yWins++;
          yAmount += pAmt;
          yRoi += pRoi;
          thisMonthAmount += pAmt;
        } else if (rec.state === "red") {
          yLosses++;
          yAmount -= pAmt;
          yRoi -= pRoi;
          thisMonthAmount -= pAmt;
        }
      }

      yCumulative += thisMonthAmount;
      yChartLabels.push(MONTH_NAMES[monthIdx].substring(0, 3));
      yMonthlyAmounts.push(thisMonthAmount);
      yCumulativePoints.push(yCumulative);
    }

    // 3. OVERALL ALL-TIME METRICS (Across all recorded years and months in dataStore)
    let oWins = 0,
      oLosses = 0,
      oAmount = 0,
      oRoi = 0;

    const oChartLabels: string[] = [];
    const oCumulativePoints: number[] = [];
    let oCumulative = 0;

    // Get sorted list of years in store
    const availableYears = Object.keys(dataStore).sort((a, b) => a.localeCompare(b));
    if (availableYears.length === 0) {
      availableYears.push(yearRange);
    }

    availableYears.forEach((yr) => {
      const yrStore = dataStore[yr] || {};
      for (let m = 0; m < 12; m++) {
        const monthIdx = (startMonth + m) % 12;
        const daysCount = getDaysInMonth(monthIdx);
        const monthRecs = yrStore[monthIdx] || {};

        let monthNet = 0;
        let monthHasData = false;

        for (let d = 1; d <= daysCount; d++) {
          const rec = monthRecs[d] || { state: "", amount: "", roi: "" };
          const pAmt = parseFloat(rec.amount) || 0;
          const pRoi = parseFloat(rec.roi) || 0;

          if (rec.state === "green") {
            oWins++;
            oAmount += pAmt;
            oRoi += pRoi;
            monthNet += pAmt;
            monthHasData = true;
          } else if (rec.state === "red") {
            oLosses++;
            oAmount -= pAmt;
            oRoi -= pRoi;
            monthNet -= pAmt;
            monthHasData = true;
          }
        }

        oCumulative += monthNet;
        // Label format: "Jan '26"
        const yrShort = yr.slice(-2);
        oChartLabels.push(`${MONTH_NAMES[monthIdx].substring(0, 3)} '${yrShort}`);
        oCumulativePoints.push(oCumulative);
      }
    });

    const initCap = parseFloat(startingCapital) || 100;
    const currentEquity = initCap + oAmount;

    return {
      // Monthly
      mWins,
      mLosses,
      mAmount,
      mRoi,
      mChartLabels,
      mChartPoints,
      // Yearly
      yWins,
      yLosses,
      yAmount,
      yRoi,
      yChartLabels,
      yMonthlyAmounts,
      yCumulativePoints,
      // Overall
      oWins,
      oLosses,
      oAmount,
      oRoi,
      oChartLabels,
      oCumulativePoints,
      initCap,
      currentEquity,
    };
  }, [dataStore, yearRange, selectedMonth, startMonth, startingCapital]);

  const handleExport = () => {
    if (Object.keys(dataStore).length === 0) {
      alert("No trading records found to export.");
      return;
    }
    exportTradingPlanToExcel(
      dataStore,
      yearRange,
      user.email,
      startMonth,
      parseFloat(startingCapital) || 100
    );
  };

  const handleReset = () => {
    if (confirm("Reset Trade Journal? All input history, win/loss ticks, and trade notes will be wiped out.")) {
      setDataStore({});
      localStorage.removeItem(`trading_store_${user.email}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-100 p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800/80 p-5 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase font-mono tracking-widest text-emerald-400">
              Multi-Year Strategic Trade Journal Terminal
            </span>
          </div>
          <h1 className="text-base sm:text-xl font-black text-white tracking-tight leading-snug">
            TRADE JOURNAL METRIC PERFORMANCE TRACKER
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>Client Gmail: <strong className="text-indigo-400 font-mono">{user.email}</strong></span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            onClick={handleExport}
            title="Export complete trade journal data to formatted Excel workbook (.xlsx)"
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/30 active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Excel Sheet
          </button>

          <button
            onClick={handleReset}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-rose-400" /> Reset Journal
          </button>
        </div>
      </div>

      {/* Control Parameters Card */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Select Year
          </label>
          <select
            value={yearRange}
            onChange={(e) => {
              if (e.target.value === "CUSTOM") {
                const custom = prompt("Enter target year (e.g. 2028 or 2028 - 2029):", "2028");
                if (custom && custom.trim()) {
                  setYearRange(custom.trim());
                }
              } else {
                setYearRange(e.target.value);
              }
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors"
          >
            {["2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033", "2034", "2035"]
              .concat(yearRange && !["2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033", "2034", "2035"].includes(yearRange) ? [yearRange] : [])
              .map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            <option value="CUSTOM">+ Add Custom Year...</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Starting Month
          </label>
          <select
            value={startMonth}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setStartMonth(val);
              setSelectedMonth(val);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> View Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {rollingMonths.map((m) => (
              <option key={m.idx} value={m.idx}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Tabs Bar */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === "grid"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-xl"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Grid className="w-4 h-4" /> Data Sheet Grid
        </button>

        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === "summary"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-xl"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Analytics & Summary
        </button>

        <button
          onClick={() => setActiveTab("goal")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === "goal"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-xl"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Target className="w-4 h-4" /> Trading Goal
        </button>

        <button
          onClick={() => setActiveTab("inspector")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === "inspector"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-xl"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" /> Trading Plan Inspector
        </button>
      </div>

      {/* PANEL 1: DATA SHEET GRID */}
      {activeTab === "grid" && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-3 sm:p-6 shadow-2xl space-y-5">
          {/* Starting Capital Input Block - Render ONLY under Starting Month */}
          {selectedMonth === startMonth && (
            <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/50 border border-indigo-500/30 p-3.5 sm:p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-mono">
                    Starting Capital (Initial Deposit)
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                    {MONTH_NAMES[startMonth]} {yearRange}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Set your initial account balance for this trading cycle. Used to calculate equity progression & ROIs.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex items-center bg-slate-950 border border-indigo-500/50 rounded-xl px-3.5 py-2 shadow-inner w-full sm:w-auto">
                  <span className="text-emerald-400 font-bold font-mono text-sm mr-1">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={startingCapital}
                    onChange={(e) => setStartingCapital(e.target.value)}
                    placeholder="100.00"
                    className="bg-transparent border-none text-right font-mono font-bold text-white text-sm w-full sm:w-28 focus:outline-none"
                  />
                  <span className="text-xs font-mono text-slate-400 ml-2">USDT</span>
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                  {["100", "500", "1000", "5000"].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setStartingCapital(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all active:scale-95 whitespace-nowrap ${
                        startingCapital === preset
                          ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Table Header & Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              {MONTH_NAMES[selectedMonth]} Log ({yearRange})
            </h3>
            <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {getDaysInMonth(selectedMonth)} Days
            </span>
          </div>

          {/* MOBILE CARDS VIEW (< md screens) */}
          <div className="block md:hidden space-y-3">
            {Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) => i + 1).map((day) => {
              const dayRec = currentMonthData[day] || { state: "", amount: "", roi: "", description: "" };
              const paddedDay = String(day).padStart(2, "0");
              const paddedMonth = String(selectedMonth + 1).padStart(2, "0");

              return (
                <div
                  key={`mobile-${day}`}
                  className={`p-3.5 rounded-xl border transition-all ${
                    dayRec.state === "green"
                      ? "bg-emerald-950/20 border-emerald-500/40"
                      : dayRec.state === "red"
                      ? "bg-rose-950/20 border-rose-500/40"
                      : "bg-slate-950/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                        {paddedDay}/{paddedMonth}
                      </span>
                      {dayRec.state && (
                        <span
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase ${
                            dayRec.state === "green"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {dayRec.state === "green" ? "+ WIN DAY" : "- LOSS DAY"}
                        </span>
                      )}
                    </div>

                    {/* Quick Touch Win / Loss Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRowState(day, dayRec.state === "green" ? "" : "green")}
                        className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center transition-all active:scale-95 ${
                          dayRec.state === "green"
                            ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                            : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-emerald-400"
                        }`}
                        title="Mark Green (Win)"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setRowState(day, dayRec.state === "red" ? "" : "red")}
                        className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center transition-all active:scale-95 ${
                          dayRec.state === "red"
                            ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                            : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-rose-400"
                        }`}
                        title="Mark Red (Loss)"
                      >
                        -
                      </button>
                      {dayRec.state && (
                        <button
                          onClick={() => setRowState(day, "")}
                          className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 text-xs flex items-center justify-center border border-slate-700"
                          title="Clear Status"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Amount & ROI Inputs */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        Amount (USDT)
                      </label>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 font-bold text-xs">
                          {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.001"
                          placeholder="0.000"
                          value={dayRec.amount}
                          onChange={(e) => updateDayRecord(day, { amount: e.target.value })}
                          className="bg-transparent border-none text-right w-full text-slate-100 font-mono text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        ROI (%)
                      </label>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 font-bold text-xs">
                          {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          value={dayRec.roi}
                          onChange={(e) => updateDayRecord(day, { roi: e.target.value })}
                          className="bg-transparent border-none text-right w-full text-slate-100 font-mono text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Trade notes (e.g. BTC 1h OB retest, TP hit...)"
                      value={dayRec.description ?? dayRec.notes ?? ""}
                      onChange={(e) =>
                        updateDayRecord(day, { description: e.target.value, notes: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= md screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="p-3 w-20">Date</th>
                  <th className="p-3 w-16 text-center">P/L</th>
                  <th className="p-3 w-40">Amount (USDT)</th>
                  <th className="p-3 w-36">ROI (%)</th>
                  <th className="p-3">Trade Description & Setup Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) => i + 1).map((day) => {
                  const dayRec = currentMonthData[day] || { state: "", amount: "", roi: "", description: "" };
                  const paddedDay = String(day).padStart(2, "0");
                  const paddedMonth = String(selectedMonth + 1).padStart(2, "0");

                  return (
                    <tr
                      key={day}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        dayRec.state === "green"
                          ? "bg-emerald-500/5 text-emerald-400"
                          : dayRec.state === "red"
                          ? "bg-rose-500/5 text-rose-400"
                          : ""
                      }`}
                    >
                      <td className="p-3 font-semibold text-slate-300 whitespace-nowrap">
                        {paddedDay}/{paddedMonth}
                      </td>

                      {/* Win / Loss State Button */}
                      <td className="p-3 text-center relative">
                        <button
                          onClick={() => setActivePopupDay(activePopupDay === day ? null : day)}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center mx-auto transition-transform active:scale-95 shadow-sm ${
                            dayRec.state === "green"
                              ? "bg-emerald-500 border-emerald-400 text-slate-950 font-extrabold text-sm"
                              : dayRec.state === "red"
                              ? "bg-rose-500 border-rose-400 text-white font-extrabold text-sm"
                              : "border-slate-700 hover:border-slate-500 bg-slate-950 text-slate-500"
                          }`}
                        >
                          {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                        </button>

                        {/* State selector popup */}
                        {activePopupDay === day && (
                          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2 z-30 shadow-2xl flex items-center gap-2">
                            <button
                              onClick={() => setRowState(day, "green")}
                              className="w-8 h-8 bg-emerald-500 rounded-lg text-slate-950 font-bold flex items-center justify-center hover:scale-105 text-sm"
                              title="Win (+ Green)"
                            >
                              +
                            </button>
                            <button
                              onClick={() => setRowState(day, "red")}
                              className="w-8 h-8 bg-rose-500 rounded-lg text-white font-bold flex items-center justify-center hover:scale-105 text-sm"
                              title="Loss (- Red)"
                            >
                              -
                            </button>
                            <button
                              onClick={() => setRowState(day, "")}
                              className="w-8 h-8 bg-slate-700 rounded-lg text-slate-300 text-xs flex items-center justify-center hover:scale-105"
                              title="Clear Row State"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Amount Input */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 max-w-[160px]">
                          <span className="text-slate-500 font-bold text-xs">
                            {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            placeholder="0.000"
                            value={dayRec.amount}
                            onChange={(e) => updateDayRecord(day, { amount: e.target.value })}
                            className="bg-transparent border-none text-right w-full text-slate-100 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500 uppercase">USDT</span>
                        </div>
                      </td>

                      {/* ROI Input */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 max-w-[140px]">
                          <span className="text-slate-500 font-bold text-xs">
                            {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            placeholder="0.00"
                            value={dayRec.roi}
                            onChange={(e) => updateDayRecord(day, { roi: e.target.value })}
                            className="bg-transparent border-none text-right w-full text-slate-100 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500">%</span>
                        </div>
                      </td>

                      {/* Trade Description Input */}
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="e.g. BTC 1h Order Block retest, TP 2.5:1 hit, Risk 2%..."
                          value={dayRec.description ?? dayRec.notes ?? ""}
                          onChange={(e) =>
                            updateDayRecord(day, { description: e.target.value, notes: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANEL 2: ANALYTICS & SUMMARY (WITH 3 SUBTABS: MONTHLY, YEARLY, OVERALL) */}
      {activeTab === "summary" && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-4 sm:p-6 shadow-2xl space-y-6">
          {/* Subtab Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 max-w-md">
            <button
              onClick={() => setSummarySubTab("monthly")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                summarySubTab === "monthly"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Monthly
            </button>

            <button
              onClick={() => setSummarySubTab("yearly")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                summarySubTab === "yearly"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Yearly
            </button>

            <button
              onClick={() => setSummarySubTab("overall")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                summarySubTab === "overall"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Overall
            </button>
          </div>

          {/* SUBTAB 1: MONTHLY ANALYTICS */}
          {summarySubTab === "monthly" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    {MONTH_NAMES[selectedMonth]} {yearRange} Performance Overview
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Detailed daily statistics & cumulative PnL trajectory for this month
                  </p>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center relative overflow-hidden shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Win Days
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                    {metrics.mWins}
                  </span>
                  <span className="text-[10px] text-emerald-500/80 font-mono mt-1 block">
                    + Green Trades Logged
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center relative overflow-hidden shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Loss Days
                  </span>
                  <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
                    {metrics.mLosses}
                  </span>
                  <span className="text-[10px] text-rose-500/80 font-mono mt-1 block">
                    - Red Trades Logged
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center relative overflow-hidden shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Net Month PnL
                  </span>
                  <span
                    className={`text-2xl font-black font-mono mt-1 block ${
                      metrics.mAmount > 0
                        ? "text-emerald-400"
                        : metrics.mAmount < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {metrics.mAmount > 0 ? "+" : ""}
                    {metrics.mAmount.toFixed(3)} USDT
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Net Profit / Loss
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center relative overflow-hidden shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    ROI For Month
                  </span>
                  <span
                    className={`text-2xl font-black font-mono mt-1 block ${
                      metrics.mRoi > 0
                        ? "text-emerald-400"
                        : metrics.mRoi < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {metrics.mRoi > 0 ? "+" : ""}
                    {metrics.mRoi.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Monthly Percentage Gain
                  </span>
                </div>
              </div>

              {/* Cumulative Month Trajectory Chart */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Cumulative Month Profit/Loss Trajectory (Daily Profits)
                </h4>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 shadow-inner">
                  <Line
                    data={{
                      labels: metrics.mChartLabels,
                      datasets: [
                        {
                          label: `${MONTH_NAMES[selectedMonth]} Daily Cumulative PnL (USDT)`,
                          data: metrics.mChartPoints,
                          borderColor: metrics.mAmount >= 0 ? "#10b981" : "#f43f5e",
                          backgroundColor:
                            metrics.mAmount >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(244, 63, 94, 0.12)",
                          borderWidth: 2.5,
                          pointRadius: 3,
                          pointHoverRadius: 6,
                          fill: true,
                          tension: 0.25,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { labels: { color: "#94a3b8", font: { family: "monospace", size: 11 } } },
                        tooltip: {
                          callbacks: {
                            label: (context) => ` PnL: ${context.parsed.y > 0 ? "+" : ""}${context.parsed.y.toFixed(3)} USDT`,
                          },
                        },
                      },
                      scales: {
                        x: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } } },
                        y: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 2: YEARLY ANALYTICS */}
          {summarySubTab === "yearly" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    Year {yearRange} Performance Overview
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    12-Month rolling performance breakdown for {yearRange}
                  </p>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Yearly Wins
                  </span>
                  <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                    {metrics.yWins}
                  </span>
                  <span className="text-[10px] text-emerald-500/80 font-mono mt-1 block">
                    Win Days in {yearRange}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Yearly Losses
                  </span>
                  <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
                    {metrics.yLosses}
                  </span>
                  <span className="text-[10px] text-rose-500/80 font-mono mt-1 block">
                    Loss Days in {yearRange}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    This Year's Net PnL
                  </span>
                  <span
                    className={`text-2xl font-black font-mono mt-1 block ${
                      metrics.yAmount > 0
                        ? "text-emerald-400"
                        : metrics.yAmount < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {metrics.yAmount > 0 ? "+" : ""}
                    {metrics.yAmount.toFixed(3)} USDT
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Yearly Total Net PnL
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Yearly Total ROI
                  </span>
                  <span
                    className={`text-2xl font-black font-mono mt-1 block ${
                      metrics.yRoi > 0
                        ? "text-emerald-400"
                        : metrics.yRoi < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {metrics.yRoi > 0 ? "+" : ""}
                    {metrics.yRoi.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Cumulative ROI for {yearRange}
                  </span>
                </div>
              </div>

              {/* Yearly Profit/Loss Trajectory Chart (Monthly Profits Included) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  This Year's Profit/Loss Trajectory (Monthly Profits Plotted)
                </h4>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 shadow-inner">
                  <Line
                    data={{
                      labels: metrics.yChartLabels,
                      datasets: [
                        {
                          label: "Monthly Net PnL (USDT)",
                          data: metrics.yMonthlyAmounts,
                          borderColor: "#818cf8",
                          backgroundColor: "rgba(129, 140, 248, 0.15)",
                          borderWidth: 2,
                          fill: false,
                          tension: 0.2,
                        },
                        {
                          label: "Cumulative Yearly Trajectory (USDT)",
                          data: metrics.yCumulativePoints,
                          borderColor: "#10b981",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          borderWidth: 3,
                          fill: true,
                          tension: 0.3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { labels: { color: "#94a3b8", font: { family: "monospace", size: 11 } } },
                        tooltip: {
                          callbacks: {
                            label: (context) => ` ${context.dataset.label}: ${context.parsed.y > 0 ? "+" : ""}${context.parsed.y.toFixed(3)} USDT`,
                          },
                        },
                      },
                      scales: {
                        x: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } } },
                        y: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: OVERALL ANALYTICS */}
          {summarySubTab === "overall" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    Overall All-Time Portfolio Metrics
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete multi-year trajectory from start month to present
                  </p>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Starting Capital
                  </span>
                  <span className="text-xl font-black text-indigo-400 font-mono mt-1 block">
                    ${metrics.initCap.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Initial Deposit
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    Current Total Equity
                  </span>
                  <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                    ${metrics.currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-500/80 font-mono mt-1 block">
                    Capital + All-Time PnL
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    All-Time Net PnL
                  </span>
                  <span
                    className={`text-xl font-black font-mono mt-1 block ${
                      metrics.oAmount > 0
                        ? "text-emerald-400"
                        : metrics.oAmount < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {metrics.oAmount > 0 ? "+" : ""}
                    {metrics.oAmount.toFixed(3)} USDT
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Total All-Time Net
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    All-Time W / L Days
                  </span>
                  <span className="text-xl font-black text-slate-200 font-mono mt-1 block">
                    <span className="text-emerald-400">{metrics.oWins}W</span> /{" "}
                    <span className="text-rose-400">{metrics.oLosses}L</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Win / Loss Ratio
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center shadow-md col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                    All-Time Total ROI
                  </span>
                  <span
                    className={`text-xl font-black font-mono mt-1 block ${
                      metrics.oRoi > 0
                        ? "text-emerald-400"
                        : metrics.oRoi < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {metrics.oRoi > 0 ? "+" : ""}
                    {metrics.oRoi.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Total Portfolio Gain
                  </span>
                </div>
              </div>

              {/* Overall Multi-Year All-Time Trajectory Chart */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  Overall All-Time Profit/Loss Progression Trajectory
                </h4>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 shadow-inner">
                  <Line
                    data={{
                      labels: metrics.oChartLabels,
                      datasets: [
                        {
                          label: "All-Time Cumulative Portfolio PnL (USDT)",
                          data: metrics.oCumulativePoints,
                          borderColor: "#10b981",
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          borderWidth: 3,
                          pointRadius: 4,
                          fill: true,
                          tension: 0.2,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { labels: { color: "#94a3b8", font: { family: "monospace", size: 11 } } },
                        tooltip: {
                          callbacks: {
                            label: (context) => ` Overall PnL: ${context.parsed.y > 0 ? "+" : ""}${context.parsed.y.toFixed(3)} USDT`,
                          },
                        },
                      },
                      scales: {
                        x: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } } },
                        y: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 3: TRADING GOAL */}
      {activeTab === "goal" && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center pb-4 border-b border-slate-800">
            <h2 className="text-2xl font-black tracking-wider text-white uppercase font-mono">
              TRADING GOALS & STRATEGY MATRIX
            </h2>
            <p className="text-xs text-slate-400 mt-1">Rules & Parameters for Compound Portfolio Growth</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Core Growth Objectives
                </h4>
                <ul className="text-xs text-slate-300 space-y-2.5 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    Short Term Goal: Target account growth of 20% - 40% per month
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    Long Term Goal: Compound capital to reach $1,000+ USDT within 6-12 months
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Strict Risk Management Rules
                </h4>
                <ul className="text-xs text-slate-300 space-y-2.5 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>
                    Maximum Risk Per Trade: 3% of main balance
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>
                    Maximum Daily Drawdown Limit: 6% of account balance
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>
                    Hard Stop Loss mandatory on every single position executed
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Entry, Exit & R:R Rules
                </h4>
                <ul className="text-xs text-slate-300 space-y-2.5 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                    Execution Strategy: Smart Money Concepts (SMC) & Order Block Retests
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                    Fixed Minimum Risk-to-Reward Ratio: 2:1
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                    Position sizing adjusted dynamically to match capital balance
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Trading Psychology
                </h4>
                <ul className="text-xs text-slate-300 space-y-2.5 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    Strict discipline — log every trade in the Trade Journal
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    Zero tolerance for revenge trading or breaking plan parameters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    Conduct weekly reviews of setups and execution metrics
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 4: TRADING PLAN INSPECTOR */}
      {activeTab === "inspector" && (
        <TradingPlanInspector
          user={user}
          dataStore={dataStore}
          startingCapital={startingCapital}
        />
      )}
    </div>
  );
};
