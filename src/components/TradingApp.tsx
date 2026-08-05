import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  UserProfile,
  TradingDataStore,
  DayRecord,
  MonthData,
} from "../types";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import { exportTradingPlanToExcel } from "../utils/excelExport";
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
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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
  const [activeTab, setActiveTab] = useState<"grid" | "summary" | "goal">("grid");
  const [yearRange, setYearRange] = useState("2026");
  const [startMonth, setStartMonth] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);

  // Trading Data Store
  const [dataStore, setDataStore] = useState<TradingDataStore>(() => {
    if (user.tradingData) return user.tradingData;
    const local = localStorage.getItem(`trading_store_${user.email}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    return {};
  });

  const [activePopupDay, setActivePopupDay] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto save data
  useEffect(() => {
    localStorage.setItem(`trading_store_${user.email}`, JSON.stringify(dataStore));
    onSaveDataToServer(dataStore);
  }, [dataStore]);

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

  // Month list starting from startMonth
  const rollingMonths = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const idx = (startMonth + i) % 12;
      arr.push({ idx, name: MONTH_NAMES[idx] });
    }
    return arr;
  }, [startMonth]);

  // Current Month Data
  const currentMonthData = useMemo(() => {
    const currentStore = ensureRangeStore({ ...dataStore }, yearRange);
    return currentStore[yearRange][selectedMonth] || {};
  }, [dataStore, yearRange, selectedMonth]);

  const updateDayRecord = (day: number, updates: Partial<DayRecord>) => {
    setDataStore((prev) => {
      const next = { ...prev };
      ensureRangeStore(next, yearRange);
      const existing = next[yearRange][selectedMonth][day] || { state: "", amount: "", roi: "" };
      next[yearRange][selectedMonth][day] = { ...existing, ...updates };
      return { ...next };
    });
  };

  const setRowState = (day: number, state: "green" | "red" | "") => {
    updateDayRecord(day, { state });
    setActivePopupDay(null);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const currentStore = dataStore[yearRange] || {};

    // Month metrics
    let mWins = 0,
      mLosses = 0,
      mAmount = 0,
      mRoi = 0;
    const daysInSelMonth = getDaysInMonth(selectedMonth);
    const mData = currentStore[selectedMonth] || {};

    const chartLabels: string[] = [];
    const chartPoints: number[] = [];
    let cumulative = 0;

    for (let d = 1; d <= daysInSelMonth; d++) {
      const rec = mData[d] || { state: "", amount: "", roi: "" };
      const pAmt = parseFloat(rec.amount) || 0;
      const pRoi = parseFloat(rec.roi) || 0;

      if (rec.state === "green") {
        mWins++;
        mAmount += pAmt;
        mRoi += pRoi;
        cumulative += pAmt;
      } else if (rec.state === "red") {
        mLosses++;
        mAmount -= pAmt;
        mRoi -= pRoi;
        cumulative -= pAmt;
      }

      chartLabels.push(`Day ${d}`);
      chartPoints.push(cumulative);
    }

    // Yearly metrics (12 months)
    let yWins = 0,
      yLosses = 0,
      yAmount = 0,
      yRoi = 0;

    for (let m = 0; m < 12; m++) {
      const daysCount = getDaysInMonth(m);
      const monthRecs = currentStore[m] || {};

      for (let d = 1; d <= daysCount; d++) {
        const rec = monthRecs[d] || { state: "", amount: "", roi: "" };
        const pAmt = parseFloat(rec.amount) || 0;
        const pRoi = parseFloat(rec.roi) || 0;

        if (rec.state === "green") {
          yWins++;
          yAmount += pAmt;
          yRoi += pRoi;
        } else if (rec.state === "red") {
          yLosses++;
          yAmount -= pAmt;
          yRoi -= pRoi;
        }
      }
    }

    return {
      mWins,
      mLosses,
      mAmount,
      mRoi,
      yWins,
      yLosses,
      yAmount,
      yRoi,
      chartLabels,
      chartPoints,
    };
  }, [dataStore, yearRange, selectedMonth]);

  const handleExport = () => {
    if (Object.keys(dataStore).length === 0) {
      alert("No trading records found to export.");
      return;
    }
    exportTradingPlanToExcel(dataStore, yearRange, user.email, 0);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setDataStore(parsed);
        alert("Trade journal data successfully imported!");
      } catch (err) {
        alert("Failed to parse trade journal JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm("Reset Trade Journal? All input history, win/loss ticks, and ROI metrics will be wiped out.")) {
      setDataStore({});
      localStorage.removeItem(`trading_store_${user.email}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-100 p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase font-mono tracking-wider text-emerald-400">
              Multi-Year Strategic Trade Journal Terminal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            TRADE JOURNAL METRIC PERFORMANCE TRACKER
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Client: <span className="text-indigo-400 font-mono font-semibold">{user.email}</span> | Mode: SMC / Order Block Strategy
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            title="Export complete trade journal data to a formatted Excel workbook (.xlsx)"
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10 active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export Excel Sheet
          </button>

          <button
            onClick={handleReset}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Journal
          </button>
        </div>
      </div>

      {/* Control Parameters Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
            Select Year
          </label>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3 pointer-events-none z-10" />
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {["2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033", "2034", "2035"]
                .concat(yearRange && !["2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033", "2034", "2035"].includes(yearRange) ? [yearRange] : [])
                .map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              <option value="CUSTOM">+ Add Custom Year / Range...</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
            Starting Month
          </label>
          <select
            value={startMonth}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setStartMonth(val);
              setSelectedMonth(val);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
            View Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            {rollingMonths.map((m) => (
              <option key={m.idx} value={m.idx}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x ${
            activeTab === "grid"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-lg"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Grid className="w-4 h-4" /> Data Sheet Grid
        </button>

        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x ${
            activeTab === "summary"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-lg"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Analytics & Summary
        </button>

        <button
          onClick={() => setActiveTab("goal")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all border-t border-x ${
            activeTab === "goal"
              ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-lg"
              : "bg-slate-950 border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Target className="w-4 h-4" /> Trading Goal
        </button>
      </div>

      {/* Panel 1: Data Sheet Grid */}
      {activeTab === "grid" && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
              {MONTH_NAMES[selectedMonth]} Performance Log ({yearRange})
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {getDaysInMonth(selectedMonth)} Days
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                  <th className="p-3 w-20">Date</th>
                  <th className="p-3 w-16 text-center">P/L</th>
                  <th className="p-3">Amount (USDT)</th>
                  <th className="p-3">ROI (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) => i + 1).map((day) => {
                  const dayRec = currentMonthData[day] || { state: "", amount: "", roi: "" };
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
                      <td className="p-3 font-semibold text-slate-300">
                        {paddedDay}/{paddedMonth}
                      </td>

                      <td className="p-3 text-center relative">
                        <button
                          onClick={() => setActivePopupDay(activePopupDay === day ? null : day)}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center mx-auto transition-transform active:scale-95 ${
                            dayRec.state === "green"
                              ? "bg-emerald-500 border-emerald-400 text-slate-950 font-extrabold"
                              : dayRec.state === "red"
                              ? "bg-rose-500 border-rose-400 text-white font-extrabold"
                              : "border-slate-700 hover:border-slate-500 bg-slate-950"
                          }`}
                        >
                          {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                        </button>

                        {/* State selector popup */}
                        {activePopupDay === day && (
                          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2 z-30 shadow-2xl flex items-center gap-2">
                            <button
                              onClick={() => setRowState(day, "green")}
                              className="w-7 h-7 bg-emerald-500 rounded-lg text-slate-950 font-bold flex items-center justify-center hover:scale-105"
                            >
                              +
                            </button>
                            <button
                              onClick={() => setRowState(day, "red")}
                              className="w-7 h-7 bg-rose-500 rounded-lg text-white font-bold flex items-center justify-center hover:scale-105"
                            >
                              -
                            </button>
                            <button
                              onClick={() => setRowState(day, "")}
                              className="w-7 h-7 bg-slate-700 rounded-lg text-slate-300 text-xs flex items-center justify-center hover:scale-105"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 max-w-[180px]">
                          <span className="text-slate-500 font-bold text-xs">
                            {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                          </span>
                          <input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={dayRec.amount}
                            onChange={(e) => updateDayRecord(day, { amount: e.target.value })}
                            className="bg-transparent border-none text-right w-full text-slate-100 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500 uppercase">USDT</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 max-w-[180px]">
                          <span className="text-slate-500 font-bold text-xs">
                            {dayRec.state === "green" ? "+" : dayRec.state === "red" ? "-" : ""}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={dayRec.roi}
                            onChange={(e) => updateDayRecord(day, { roi: e.target.value })}
                            className="bg-transparent border-none text-right w-full text-slate-100 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500">%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel 2: Analytics & Summary */}
      {activeTab === "summary" && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-4 sm:p-6 shadow-xl space-y-6">
          {/* Selected Month Metrics */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono mb-3 border-l-2 border-indigo-500 pl-2">
              Selected Month Analytics ({MONTH_NAMES[selectedMonth]})
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Win Days
                </span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                  {metrics.mWins}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Loss Days
                </span>
                <span className="text-xl font-bold text-rose-400 font-mono mt-1 block">
                  {metrics.mLosses}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Net Month PnL
                </span>
                <span
                  className={`text-xl font-bold font-mono mt-1 block ${
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
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Total Month ROI
                </span>
                <span
                  className={`text-xl font-bold font-mono mt-1 block ${
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
              </div>
            </div>
          </div>

          {/* Yearly Cumulative Summary */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono mb-3 border-l-2 border-indigo-500 pl-2">
              Cumulative Yearly Summary (12 Months Rolling)
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Yearly Wins
                </span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                  {metrics.yWins}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Yearly Losses
                </span>
                <span className="text-xl font-bold text-rose-400 font-mono mt-1 block">
                  {metrics.yLosses}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Yearly Net PnL
                </span>
                <span
                  className={`text-xl font-bold font-mono mt-1 block ${
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
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Yearly Total ROI
                </span>
                <span
                  className={`text-xl font-bold font-mono mt-1 block ${
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
              </div>
            </div>
          </div>

          {/* Chart.js Progression Graph */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono mb-3 border-l-2 border-indigo-500 pl-2">
              Visual Cumulative Performance Progression
            </h3>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-72">
              <Line
                data={{
                  labels: metrics.chartLabels,
                  datasets: [
                    {
                      label: "Cumulative PnL (USDT)",
                      data: metrics.chartPoints,
                      borderColor: "#10b981",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      borderWidth: 2,
                      fill: true,
                      tension: 0.2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: "#94a3b8" } },
                  },
                  scales: {
                    x: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8" } },
                    y: { grid: { color: "#1e293b" }, ticks: { color: "#94a3b8" } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Panel 3: Trading Goal */}
      {activeTab === "goal" && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center pb-4 border-b border-slate-800">
            <h2 className="text-2xl font-black tracking-wider text-white uppercase font-mono">
              TRADING GOALS & STRATEGY MATRIX
            </h2>
            <p className="text-xs text-slate-400">Rules & Parameters for Portfolio Growth</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest font-mono mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Core Growth Objectives
                </h4>
                <ul className="text-xs text-slate-300 space-y-2 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Short Term Goal: Aim to grow account by 20% - 40% per month
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Long Term Goal: Compound gain to reach 1000 USDT within 6-12 months
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest font-mono mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Strict Risk Management
                </h4>
                <ul className="text-xs text-slate-300 space-y-2 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Maximum Risk Per Trade: 3% of main balance (100 USDT = 3 USDT)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Maximum Daily Loss: 6% of balance (0.18 USDT limit)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Hard Stop Loss mandated on every position
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Entry, Exit & R:R Rules
                </h4>
                <ul className="text-xs text-slate-300 space-y-2 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    Strategy: Smart Money Concepts (SMC) & Retail Order Blocks
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    Fixed Minimum Risk-to-Reward Ratio: 2:1 (Target 4 Profit : 2 Stop Loss)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    Use less than 100 USDT capital per position
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Psychology & Execution
                </h4>
                <ul className="text-xs text-slate-300 space-y-2 font-mono">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Maintain discipline and strictly stick to the trading journal
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    No revenge trading after a loss
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Regularly review both winning & losing setups for continuous optimization
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
