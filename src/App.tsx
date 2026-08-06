import React, { useState, useEffect, useRef } from "react";
import {
  UserProfile,
  TradingDataStore,
  AppMetadata,
  DayRecord,
} from "./types";
import { getUserDataFromFirestore, saveUserDataToFirestore, subscribeUserDataFromFirestore } from "./lib/userStore";
import { Navbar } from "./components/Navbar";
import { GatewayScreen } from "./components/GatewayScreen";
import { UnderReviewModal } from "./components/UnderReviewModal";
import { HostAdminPortal } from "./components/HostAdminPortal";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { exportTradingPlanToExcel } from "./utils/excelExport";
import {
  Download,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  Target,
  BarChart3,
  Table as TableIcon,
  MessageSquare,
  X,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Award,
  AlertTriangle,
  Brain,
  History,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const monthNames = [
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

const monthsDaysArr = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export default function App() {
  // Session starts as null every time to require fresh re-login on page load/refresh
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [activeView, setActiveView] = useState<"app" | "admin">("app");
  const [activeTab, setActiveTab] = useState<"grid" | "summary" | "goal">("grid");

  // Trading Plan Metadata & State
  const [yearRange, setYearRange] = useState("2026");
  const [startMonth, setStartMonth] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);

  // Data Store for PnL / ROI
  const [tradingData, setTradingData] = useState<TradingDataStore>({});

  // Active state popups in grid
  const [activePopupDay, setActivePopupDay] = useState<number | null>(null);

  // AI Chatbot State
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [botMessages, setBotMessages] = useState<
    { sender: "bot" | "user"; text: string }[]
  >([
    {
      sender: "bot",
      text: "Hello! SNGxCRYPTO AI Trading Assistant active. English, Sinhala (සිංහල), or Singlish (e.g. 'kohomada log wenne') support ready.",
    },
  ]);
  const [botInput, setBotInput] = useState("");
  const [isBotThinking, setIsBotThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Clear any persistent session tokens on startup so user must re-log in every time
  useEffect(() => {
    localStorage.removeItem("tradeplan_active_user");
    sessionStorage.removeItem("tradeplan_active_user");
  }, []);

  // Fetch & Subscribe to user trading data & metadata from Firestore & server whenever user logs in with their Gmail
  useEffect(() => {
    if (!currentUser?.email) return;

    // 1. Fetch initial from Firestore
    getUserDataFromFirestore(currentUser.email).then((fsData) => {
      if (fsData?.tradingData && Object.keys(fsData.tradingData).length > 0) {
        setTradingData(fsData.tradingData);
      }
      if (fsData?.yearRange) setYearRange(fsData.yearRange);
      if (fsData?.startMonth !== undefined) {
        setStartMonth(fsData.startMonth);
        setSelectedMonth(fsData.startMonth);
      }
    });

    // 2. Fetch initial from server
    const fetchUserData = async () => {
      try {
        const res = await fetch(`/api/user/data/${encodeURIComponent(currentUser.email)}`);
        const isJson = res.headers.get("content-type")?.includes("application/json");
        if (res.ok && isJson) {
          const data = await res.json();
          if (data.tradingData && Object.keys(data.tradingData).length > 0) {
            setTradingData((prev) => (Object.keys(prev).length === 0 ? data.tradingData : prev));
          }
          if (data.metadata) {
            if (data.metadata.yearRange) setYearRange(data.metadata.yearRange);
            if (data.metadata.startMonth !== undefined) {
              setStartMonth(data.metadata.startMonth);
              setSelectedMonth(data.metadata.startMonth);
            }
          }
        }
      } catch (err) {
        console.warn("Server user data fetch notice:", err);
      }
    };

    fetchUserData();

    // 3. Subscribe to real-time Firestore changes for user Gmail
    const unsubscribe = subscribeUserDataFromFirestore(currentUser.email, (data) => {
      if (data?.status && data.status !== currentUser.status) {
        setCurrentUser((prev) => (prev ? { ...prev, status: data.status } : null));
      }
      if (data?.tradingData && Object.keys(data.tradingData).length > 0) {
        setTradingData(data.tradingData);
      }
      if (data?.yearRange) setYearRange(data.yearRange);
      if (data?.startMonth !== undefined) setStartMonth(data.startMonth);
    });

    return () => unsubscribe();
  }, [currentUser?.email]);

  // Save metadata
  const handleSaveMeta = (newRange: string, newStartM: number) => {
    setYearRange(newRange);
    setStartMonth(newStartM);

    if (currentUser?.email) {
      saveUserDataToFirestore(currentUser.email, tradingData, {
        yearRange: newRange,
        startMonth: newStartM,
      });

      fetch("/api/user/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          tradingData,
          metadata: { yearRange: newRange, startMonth: newStartM },
        }),
      }).catch((e) => console.warn("Failed to save metadata to server:", e));
    }
  };

  // Helper to get days in month
  const getDaysInMonth = (monthIdx: number) => {
    if (monthIdx === 1) {
      const match = yearRange.match(/\d{4}/);
      const year = match ? parseInt(match[0]) : 2026;
      if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) return 29;
      return 28;
    }
    return monthsDaysArr[monthIdx] || 31;
  };

  // Ensure current year range & month exists in state
  const getMonthDayData = (day: number): DayRecord => {
    const rangeData = tradingData[yearRange];
    if (!rangeData) return { state: "", amount: "", roi: "" };
    const mData = rangeData[selectedMonth];
    if (!mData) return { state: "", amount: "", roi: "" };
    return mData[day] || { state: "", amount: "", roi: "" };
  };

  const updateDayData = (day: number, updates: Partial<DayRecord>) => {
    if (!currentUser?.email) return;

    setTradingData((prev) => {
      const nextStore = { ...prev };
      if (!nextStore[yearRange]) {
        nextStore[yearRange] = {};
      }
      if (!nextStore[yearRange][selectedMonth]) {
        nextStore[yearRange][selectedMonth] = {};
      }

      const currentDayObj = nextStore[yearRange][selectedMonth][day] || {
        state: "",
        amount: "",
        roi: "",
      };

      nextStore[yearRange][selectedMonth][day] = {
        ...currentDayObj,
        ...updates,
      };

      // Persist directly to Firestore under user Gmail
      saveUserDataToFirestore(currentUser.email, nextStore, { yearRange, startMonth });

      // Persist to server as backup
      fetch("/api/user/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          tradingData: nextStore,
          metadata: { yearRange, startMonth },
        }),
      }).catch((e) => console.warn("Background server update notice:", e));

      return nextStore;
    });
  };

  // Refresh review status from local state & server
  const handleRefreshStatus = async () => {
    if (!currentUser) return;
    const cleanEmail = currentUser.email.trim().toLowerCase();

    // Check localStorage first
    const localUsers: any[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const matchedLocal = localUsers.find((u) => u.email && u.email.trim().toLowerCase() === cleanEmail);

    let newStatus = matchedLocal?.status;
    let newRole = matchedLocal?.role;

    // Check pre-approved whitelist
    const preApprovedList: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    if (cleanEmail === "sngxworld@gmail.com" || preApprovedList.some((e: string) => e.toLowerCase() === cleanEmail)) {
      newStatus = "approved";
    }

    // Try server endpoint as well
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

  // Export Excel (.xlsx) spreadsheet
  const handleExportData = () => {
    if (Object.keys(tradingData).length === 0) {
      alert("No trading records found to export.");
      return;
    }
    exportTradingPlanToExcel(
      tradingData,
      yearRange,
      currentUser?.email || "Trader",
      startMonth
    );
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported && typeof imported === "object") {
          setTradingData(imported);
          if (currentUser?.email) {
            fetch("/api/user/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: currentUser.id,
                email: currentUser.email,
                tradingData: imported,
                metadata: { yearRange, startMonth },
              }),
            }).catch((e) => console.warn("Failed to sync imported data to server:", e));
          }
          alert("Trade Journal data successfully imported and saved to your Gmail account!");
        }
      } catch (err) {
        alert("Failed to parse JSON file structure.");
      }
    };
    reader.readAsText(files[0]);
  };

  const handleResetData = () => {
    if (
      confirm(
        "Are you sure you want to reset all trading entries? All PnL and ROI entries will be permanently cleared."
      )
    ) {
      setTradingData({});
      if (currentUser?.email) {
        fetch("/api/user/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id,
            email: currentUser.email,
            tradingData: {},
            metadata: { yearRange, startMonth },
          }),
        }).catch((e) => console.warn("Failed to reset data on server:", e));
      }
    }
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
        { sender: "bot", text: data.reply || "SNGxCRYPTO Assistant online." },
      ]);
    } catch (err) {
      setBotMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "SNGxCRYPTO Assistant active. For urgent access assistance, contact host line: +94 75 284 0841.",
        },
      ]);
    } finally {
      setIsBotThinking(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  // Calculate Metrics for Selected Month and Full Year
  const calculateMetrics = () => {
    let mWins = 0,
      mLosses = 0,
      mAmount = 0,
      mRoi = 0;
    const chartLabels: string[] = [];
    const chartPoints: number[] = [];
    let movingCumPnL = 0;

    const daysInSel = getDaysInMonth(selectedMonth);
    for (let d = 1; d <= daysInSel; d++) {
      const dayData = getMonthDayData(d);
      const amt = parseFloat(dayData.amount) || 0;
      const roi = parseFloat(dayData.roi) || 0;

      let adjAmt = dayData.state === "green" ? amt : dayData.state === "red" ? -amt : 0;
      let adjRoi = dayData.state === "green" ? roi : dayData.state === "red" ? -roi : 0;

      if (dayData.state === "green") mWins++;
      if (dayData.state === "red") mLosses++;

      mAmount += adjAmt;
      mRoi += adjRoi;

      movingCumPnL += adjAmt;
      chartLabels.push(`Day ${d}`);
      chartPoints.push(movingCumPnL);
    }

    let yWins = 0,
      yLosses = 0,
      yAmount = 0,
      yRoi = 0;
    const yearData = tradingData[yearRange] || {};

    for (let m = 0; m < 12; m++) {
      const mData = yearData[m] || {};
      const dInM = getDaysInMonth(m);
      for (let d = 1; d <= dInM; d++) {
        const dayData = mData[d] || { state: "", amount: "", roi: "" };
        const amt = parseFloat(dayData.amount) || 0;
        const roi = parseFloat(dayData.roi) || 0;

        if (dayData.state === "green") {
          yWins++;
          yAmount += amt;
          yRoi += roi;
        } else if (dayData.state === "red") {
          yLosses++;
          yAmount -= amt;
          yRoi -= roi;
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
  };

  const metrics = calculateMetrics();

  // If user is not logged in -> Show Gateway Screen
  if (!currentUser) {
    return (
      <GatewayScreen
        onLoginSuccess={(user) => setCurrentUser(user)}
        onRegisteredPending={(user) => setCurrentUser(user)}
      />
    );
  }

  // If user role is admin and active view is "admin" -> Render Host Admin Portal
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

  // Rolling 12 months array starting from startMonth
  const rollingMonths = Array.from({ length: 12 }, (_, i) => (startMonth + i) % 12);

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
          {/* Main Title Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-2 font-mono">
                <TrendingUp className="w-3.5 h-3.5" /> SNGxCRYPTO Enterprise
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                TRADE JOURNAL METRIC PERFORMANCE TRACKER
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Manage risk exposure, track daily PnL, and analyze compound ROI trajectory.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportData}
                title="Export complete trade journal data to a formatted Excel workbook (.xlsx)"
                className="px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Excel Sheet
              </button>

              <button
                onClick={handleResetData}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-400 border border-rose-900/50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              >
                <RotateCcw className="w-4 h-4" /> Reset Journal
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-lg grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Select Year:
              </label>
              <select
                value={yearRange}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM") {
                    const custom = prompt("Enter target year (e.g. 2028 or 2028 - 2029):", "2028");
                    if (custom && custom.trim()) {
                      handleSaveMeta(custom.trim(), startMonth);
                    }
                  } else {
                    handleSaveMeta(e.target.value, startMonth);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
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

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Start Month:
              </label>
              <select
                value={startMonth}
                onChange={(e) => {
                  const newStart = parseInt(e.target.value);
                  handleSaveMeta(yearRange, newStart);
                  setSelectedMonth(newStart);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                View Month Grid:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-bold font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {rollingMonths.map((mIdx) => (
                  <option key={mIdx} value={mIdx}>
                    {monthNames[mIdx]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 mb-6 gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("grid")}
              className={`px-5 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
                activeTab === "grid"
                  ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-lg"
                  : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <TableIcon className="w-4 h-4" /> Data Sheet Grid
            </button>

            <button
              onClick={() => setActiveTab("summary")}
              className={`px-5 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
                activeTab === "summary"
                  ? "bg-slate-900 border-slate-800 text-indigo-400 border-b-2 border-b-indigo-500 shadow-lg"
                  : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Analytics & Summary
            </button>

            <button
              onClick={() => setActiveTab("goal")}
              className={`px-5 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x ${
                activeTab === "goal"
                  ? "bg-slate-900 border-slate-800 text-amber-400 border-b-2 border-b-amber-500 shadow-lg"
                  : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Target className="w-4 h-4" /> Trading Goals
            </button>
          </div>

          {/* TAB 1: DATA SHEET GRID */}
          {activeTab === "grid" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                  {monthNames[selectedMonth]} Daily Log Grid ({getDaysInMonth(selectedMonth)} Days)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Click P/L indicator to toggle Win (Green) / Loss (Red)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="p-3.5 w-24">Date</th>
                      <th className="p-3.5 w-20 text-center">P/L State</th>
                      <th className="p-3.5">Profit / Loss (USDT)</th>
                      <th className="p-3.5">ROI Gain (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                    {Array.from(
                      { length: getDaysInMonth(selectedMonth) },
                      (_, i) => i + 1
                    ).map((day) => {
                      const dayData = getMonthDayData(day);
                      const paddedDay = String(day).padStart(2, "0");
                      const paddedMonth = String(selectedMonth + 1).padStart(2, "0");

                      return (
                        <tr
                          key={day}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            dayData.state === "green"
                              ? "bg-emerald-950/20"
                              : dayData.state === "red"
                              ? "bg-rose-950/20"
                              : ""
                          }`}
                        >
                          <td className="p-3.5 text-slate-300 font-bold">
                            {paddedDay}/{paddedMonth}
                          </td>

                          <td className="p-3.5 text-center relative">
                            {/* Toggle Trigger */}
                            <button
                              onClick={() =>
                                setActivePopupDay(
                                  activePopupDay === day ? null : day
                                )
                              }
                              className={`w-7 h-7 rounded-lg border transition-transform active:scale-90 inline-flex items-center justify-center font-bold text-xs ${
                                dayData.state === "green"
                                  ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30"
                                  : dayData.state === "red"
                                  ? "bg-rose-500 border-rose-400 text-white shadow-md shadow-rose-500/30"
                                  : "bg-slate-800 border-slate-700 text-slate-500"
                              }`}
                            >
                              {dayData.state === "green"
                                ? "W"
                                : dayData.state === "red"
                                ? "L"
                                : "—"}
                            </button>

                            {/* State Selection Popup */}
                            {activePopupDay === day && (
                              <div className="absolute left-1/2 -translate-x-1/2 top-11 z-20 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl flex items-center gap-2 backdrop-blur-xl animate-in fade-in duration-150">
                                <button
                                  onClick={() => {
                                    updateDayData(day, { state: "green" });
                                    setActivePopupDay(null);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:scale-110 transition-transform"
                                  title="Mark Win"
                                >
                                  W
                                </button>
                                <button
                                  onClick={() => {
                                    updateDayData(day, { state: "red" });
                                    setActivePopupDay(null);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-rose-500 text-white font-bold text-xs hover:scale-110 transition-transform"
                                  title="Mark Loss"
                                >
                                  L
                                </button>
                                <button
                                  onClick={() => {
                                    updateDayData(day, { state: "" });
                                    setActivePopupDay(null);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 font-bold text-xs hover:scale-110 transition-transform"
                                  title="Clear State"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 transition-colors">
                              <span
                                className={`text-xs mr-1 font-bold ${
                                  dayData.state === "green"
                                    ? "text-emerald-400"
                                    : dayData.state === "red"
                                    ? "text-rose-400"
                                    : "text-slate-600"
                                }`}
                              >
                                {dayData.state === "green"
                                  ? "+"
                                  : dayData.state === "red"
                                  ? "-"
                                  : ""}
                              </span>
                              <input
                                type="number"
                                step="0.001"
                                placeholder="0.000"
                                value={dayData.amount}
                                onChange={(e) =>
                                  updateDayData(day, { amount: e.target.value })
                                }
                                className={`w-full bg-transparent text-right outline-none font-mono text-xs ${
                                  dayData.state === "green"
                                    ? "text-emerald-400 font-bold"
                                    : dayData.state === "red"
                                    ? "text-rose-400 font-bold"
                                    : "text-slate-200"
                                }`}
                              />
                              <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                                USDT
                              </span>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 transition-colors">
                              <span
                                className={`text-xs mr-1 font-bold ${
                                  dayData.state === "green"
                                    ? "text-emerald-400"
                                    : dayData.state === "red"
                                    ? "text-rose-400"
                                    : "text-slate-600"
                                }`}
                              >
                                {dayData.state === "green"
                                  ? "+"
                                  : dayData.state === "red"
                                  ? "-"
                                  : ""}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={dayData.roi}
                                onChange={(e) =>
                                  updateDayData(day, { roi: e.target.value })
                                }
                                className={`w-full bg-transparent text-right outline-none font-mono text-xs ${
                                  dayData.state === "green"
                                    ? "text-emerald-400 font-bold"
                                    : dayData.state === "red"
                                    ? "text-rose-400 font-bold"
                                    : "text-slate-200"
                                }`}
                              />
                              <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                                %
                              </span>
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

          {/* TAB 2: ANALYTICS & SUMMARY */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              {/* Month Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-widest mb-4 border-l-2 border-indigo-500 pl-2">
                  {monthNames[selectedMonth]} Performance Overview
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Win Days
                    </span>
                    <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                      {metrics.mWins}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Loss Days
                    </span>
                    <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
                      {metrics.mLosses}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Net PnL
                    </span>
                    <span
                      className={`text-xl font-black font-mono mt-1 block ${
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

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Total ROI Gain
                    </span>
                    <span
                      className={`text-xl font-black font-mono mt-1 block ${
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

              {/* Cumulative Yearly Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-widest mb-4 border-l-2 border-amber-500 pl-2">
                  Cumulative Yearly Totals ({yearRange})
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Yearly Wins
                    </span>
                    <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                      {metrics.yWins}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Yearly Losses
                    </span>
                    <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
                      {metrics.yLosses}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Yearly Net PnL
                    </span>
                    <span
                      className={`text-xl font-black font-mono mt-1 block ${
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

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">
                      Yearly ROI Gain
                    </span>
                    <span
                      className={`text-xl font-black font-mono mt-1 block ${
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

              {/* Chart.js Performance Graph */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest mb-4 border-l-2 border-emerald-500 pl-2">
                  Cumulative Month Profit/Loss Trajectory
                </h3>

                <div className="h-72 w-full bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <Line
                    data={{
                      labels: metrics.chartLabels,
                      datasets: [
                        {
                          label: "Cumulative PnL (USDT)",
                          data: metrics.chartPoints,
                          borderColor: "#10b981",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          fill: true,
                          tension: 0.3,
                          pointBackgroundColor: "#10b981",
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

          {/* TAB 3: TRADING GOALS */}
          {activeTab === "goal" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 uppercase">
                  TRADING GOALS & RULES
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Execution Framework & Risk Parameters
                </p>
              </div>

              <div className="space-y-6">
                {/* Core Goals List */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></div>
                      <span>Short term goal: Aim to grow the account by 20 - 40% per month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></div>
                      <span>Long term goal: Compound gain to reach 1000 USDT within 6-12 months</span>
                    </li>
                  </ul>
                </div>

                {/* Risk Management */}
                <div>
                  <h3 className="text-xs font-bold text-rose-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> RISK MANAGEMENT
                  </h3>
                  <div className="bg-slate-950 border border-rose-900/30 rounded-xl p-5">
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span>Maximum risk per trade - 3% of your main balance [100 USDT = 3 USDT]</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span>Maximum daily loss - 6% of the trade [3 USDT = 0.18 USDT]</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span>Use stop loss to limit potential losses on each trade</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Strategy Selection */}
                <div>
                  <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> STRATEGY SELECTION
                  </h3>
                  <div className="bg-slate-950 border border-amber-900/30 rounded-xl p-5">
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                        <span>Choose simple strategy: RETAIL trading or SMC (Smart Money Concepts) trading</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                        <span>Focus on liquid order blocks, liquidity sweeps, and high probability setups</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Entry and Exit Rules */}
                <div>
                  <h3 className="text-xs font-bold text-cyan-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> ENTRY AND EXIT RULES
                  </h3>
                  <div className="bg-slate-950 border border-cyan-900/30 rounded-xl p-5">
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                        <span>Use technical analysis to identify clear entry points, targets, and stop loss</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                        <span>Set a fixed minimum risk to reward (2:1 ratio — 4 profit : 2 stop loss)</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Position Sizing */}
                <div>
                  <h3 className="text-xs font-bold text-purple-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4" /> POSITION SIZING
                  </h3>
                  <div className="bg-slate-950 border border-purple-900/30 rounded-xl p-5">
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                        <span>Use less than 100 USDT for a trade</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                        <span>Determine position size based strictly on maximum risk per trade</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Trading Psychology */}
                <div>
                  <h3 className="text-xs font-bold text-pink-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> TRADING PSYCHOLOGY
                  </h3>
                  <div className="bg-slate-950 border border-pink-900/30 rounded-xl p-5">
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                        <span>Maintain discipline and stick to the trade journal at all times</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                        <span>Control emotions and NEVER revenge trade after a loss</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                        <span>Focus on the process and follow execution rules systematically</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Back Testing & Review */}
                <div>
                  <h3 className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <History className="w-4 h-4" /> BACK TESTING & MONITORING
                  </h3>
                  <div className="bg-slate-950 border border-indigo-900/30 rounded-xl p-5">
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-medium">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        <span>Back test your strategy on historical data to validate performance</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        <span>Regularly review your trades to ensure you're following the trade journal</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        <span>Analyze both winning and losing trades to identify areas for improvement</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating AI Assistant Chatbot Button */}
      <button
        onClick={() => setIsBotOpen(!isBotOpen)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-600/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-indigo-400/30"
        title="Open SNGxCRYPTO AI Assistant"
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
                SNGxCRYPTO AI Assistant
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
