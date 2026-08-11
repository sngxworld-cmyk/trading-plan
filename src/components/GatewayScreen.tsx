import React, { useState, useEffect, useRef } from "react";
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, Flame, TrendingUp, PhoneCall, ArrowRight, KeyRound, Camera, Phone, Tag } from "lucide-react";
import { UserProfile } from "../types";
import { registerUserInFirestore, loginUserInFirestore } from "../lib/userStore";

interface GatewayScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onRegisteredPending: (user: UserProfile) => void;
}

export const GatewayScreen: React.FC<GatewayScreenProps> = ({
  onLoginSuccess,
  onRegisteredPending,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [tradingPair, setTradingPair] = useState("BTC/USDT");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const regFileInputRef = useRef<HTMLInputElement>(null);

  // Handle Photo Upload during Registration
  const handleRegPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage("Image file must be under 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setPhotoURL(canvas.toDataURL("image/jpeg", 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Asset selection & Live Tickers
  const [selectedAsset, setSelectedAsset] = useState<"BTC" | "ETH" | "SOL">("BTC");
  const [liveTickers, setLiveTickers] = useState<{
    BTC: { price: number; change: number };
    ETH: { price: number; change: number };
    SOL: { price: number; change: number };
  }>({
    BTC: { price: 64050, change: 1.2 },
    ETH: { price: 3420, change: 0.8 },
    SOL: { price: 148, change: 2.5 },
  });

  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);

  // Fetch Live Ticker Prices
  useEffect(() => {
    let isMounted = true;
    const fetchTickers = async () => {
      try {
        const res = await fetch("/api/market/tickers");
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && isMounted) {
          const newMap: any = {};
          data.data.forEach((t: any) => {
            const sym = t.symbol.replace("USDT", "") as "BTC" | "ETH" | "SOL";
            if (sym === "BTC" || sym === "ETH" || sym === "SOL") {
              newMap[sym] = {
                price: parseFloat(t.lastPrice) || 0,
                change: parseFloat(t.priceChangePercent) || 0,
              };
            }
          });
          if (Object.keys(newMap).length > 0) {
            setLiveTickers((prev) => ({ ...prev, ...newMap }));
          }
        }
      } catch (e) {}
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Live Real Market Chart Stream
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart if present
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 320,
      height: container.clientHeight || 224,
      layout: {
        background: { color: "#0f172a" },
        textColor: "#94a3b8",
        attributionLogo: false,
      } as any,
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    let ws: WebSocket | null = null;
    let isSubscribed = true;

    // Load initial 150 real market candles from backend / Binance API
    const loadRealKlines = async () => {
      const symbol = `${selectedAsset}USDT`;
      let historyData: any[] = [];

      try {
        const res = await fetch(`/api/market/klines?symbol=${symbol}`);
        const result = await res.json();

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          historyData = result.data.map((item: any) => ({
            time: Math.floor(item[0] / 1000) as UTCTimestamp,
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
          }));
        }
      } catch (err) {
        console.warn("Proxy klines error, fallback to direct fetch:", err);
      }

      if (historyData.length === 0) {
        try {
          const directRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=150`);
          const directData = await directRes.json();
          if (Array.isArray(directData) && directData.length > 0) {
            historyData = directData.map((item: any) => ({
              time: Math.floor(item[0] / 1000) as UTCTimestamp,
              open: parseFloat(item[1]),
              high: parseFloat(item[2]),
              low: parseFloat(item[3]),
              close: parseFloat(item[4]),
            }));
          }
        } catch (e) {}
      }

      // Guaranteed fallback generator if API call failed
      if (historyData.length === 0) {
        const now = Math.floor(Date.now() / 1000);
        let basePrice = selectedAsset === "BTC" ? 64000 : selectedAsset === "ETH" ? 3400 : 145;
        for (let i = 120; i >= 0; i--) {
          const time = (now - i * 60) as UTCTimestamp;
          const delta = (Math.random() - 0.49) * (basePrice * 0.002);
          const open = basePrice;
          const close = open + delta;
          const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
          const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
          basePrice = close;
          historyData.push({ time, open, high, low, close });
        }
      }

      if (!isSubscribed) return;

      if (historyData.length > 0) {
        series.setData(historyData);
        chart.timeScale().fitContent();

        const lastCandle = historyData[historyData.length - 1];
        setLiveTickers((prev) => ({
          ...prev,
          [selectedAsset]: {
            ...prev[selectedAsset],
            price: lastCandle.close,
          },
        }));
      }

      // Real-Time Live WebSocket Stream
      try {
        const wsUrl = `wss://stream.binance.com:9443/ws/${selectedAsset.toLowerCase()}usdt@kline_1m`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg && msg.k) {
              const k = msg.k;
              const candle = {
                time: Math.floor(k.t / 1000) as UTCTimestamp,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
              };
              if (seriesRef.current) {
                seriesRef.current.update(candle);
              }
              setLiveTickers((prev) => ({
                ...prev,
                [selectedAsset]: {
                  ...prev[selectedAsset],
                  price: parseFloat(k.c),
                },
              }));
            }
          } catch (e) {}
        };
      } catch (e) {
        console.warn("WebSocket connection error:", e);
      }
    };

    loadRealKlines();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth || 320;
        const height = chartContainerRef.current.clientHeight || 250;
        chartRef.current.applyOptions({
          width,
          height,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Initial resize check after layout renders
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      isSubscribed = false;
      if (ws) {
        ws.close();
      }
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [selectedAsset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password || (isRegisterMode && !username)) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }

    setLoading(true);

    const safeFetchJson = async (url: string, options?: RequestInit) => {
      try {
        const res = await fetch(url, options);
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          return { isJson: false, status: res.status, ok: false, data: null };
        }
        const data = await res.json();
        return { isJson: true, status: res.status, ok: res.ok, data };
      } catch {
        return { isJson: false, status: 0, ok: false, data: null };
      }
    };

    try {
      if (isRegisterMode) {
        // Direct Firestore registration (works across all devices, mobile phones, Vercel, etc.)
        const newUser = await registerUserInFirestore({
          email,
          username,
          password,
          displayName: displayName || username,
          photoURL,
          phone,
          bio,
          tradingPair,
        });

        // Also sync with server endpoint if backend is available
        fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password }),
        }).catch(() => {});

        if (newUser.status === "approved") {
          setSuccessMessage("Pre-approved access! Logging you in...");
          setTimeout(() => onLoginSuccess(newUser), 800);
        } else {
          setSuccessMessage("Account registered! Status: UNDER REVIEW. Awaiting Host Admin approval.");
          setTimeout(() => onRegisteredPending(newUser), 800);
        }
      } else {
        // Direct Firestore login
        const { user: loggedInUser, status } = await loginUserInFirestore(email, password);

        // Also sync with server endpoint if backend is available
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password }),
        }).catch(() => {});

        if (status === "pending") {
          onRegisteredPending(loggedInUser);
        } else {
          onLoginSuccess(loggedInUser);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-6xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Brand, Candlestick Chart & Market Tickers */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Header Title */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> Core Gateway Infrastructure
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
              SNGz<span className="text-indigo-500">TRADES</span> Pro Journal
            </h1>
            <p className="text-sm text-slate-400 max-w-lg">
              Enterprise Multi-Year Trade Journal Tracker Infrastructure.
            </p>
          </div>

          {/* Chart Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Live Market Stream
                </span>
              </div>

              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="BTC">BTC / USDT Live</option>
                <option value="ETH">ETH / USDT Live</option>
                <option value="SOL">SOL / USDT Live</option>
              </select>
            </div>

            {/* Candle Container */}
            <div
              ref={chartContainerRef}
              className="w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-800/80"
            ></div>

            {/* Market Tickers Strip */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {(["BTC", "ETH", "SOL"] as const).map((asset) => {
                const info = liveTickers[asset];
                const isPos = info.change >= 0;
                return (
                  <div key={asset} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">{asset} / USDT</span>
                    <span className={`text-xs font-bold font-mono ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                      ${info.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`block text-[9px] font-mono ${isPos ? "text-emerald-500" : "text-rose-500"}`}>
                      {isPos ? "+" : ""}{info.change.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>


        </div>

        {/* Right Column: Geometric Balance Auth Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                {isRegisterMode ? "Create Client Account" : "Welcome Back"}
              </h2>
              <p className="text-xs text-slate-400">
                {isRegisterMode
                  ? "Enter your Gmail to request access to Trade Journal Tracker"
                  : "Login with your Gmail or Username to access app"}
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  {isRegisterMode ? "Gmail / Email Address" : "Gmail or Username"}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type={isRegisterMode ? "email" : "text"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isRegisterMode ? "Enter your Gmail" : "Enter Gmail or Username"}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm sm:text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              {isRegisterMode && (
                <>
                  {/* Profile Picture Upload Header */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                    <div className="relative group shrink-0">
                      {photoURL ? (
                        <img
                          src={photoURL}
                          alt="Profile preview"
                          className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">Upload Profile Photo</p>
                      <p className="text-[10px] text-slate-400">Essential for Chat & Host Admin Inspector</p>
                      <input
                        type="file"
                        ref={regFileInputRef}
                        onChange={handleRegPhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => regFileInputRef.current?.click()}
                        className="mt-1 px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" /> Select Photo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                      Unique Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="trader_pro"
                        required={isRegisterMode}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm sm:text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                      Full Name / Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                        Phone / Contact
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 019"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                        Trading Asset
                      </label>
                      <input
                        type="text"
                        value={tradingPair}
                        onChange={(e) => setTradingPair(e.target.value)}
                        placeholder="BTC/USDT"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  Security Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm sm:text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>{isRegisterMode ? "Register Client Account" : "Log In to Trading App"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {isRegisterMode ? (
                  <span>Already registered? <strong className="text-indigo-400 underline">Log in here</strong></span>
                ) : (
                  <span>Don't have an account? <strong className="text-indigo-400 underline">Register here</strong></span>
                )}
              </button>
            </div>

            {/* Emergency Support Line Badge */}
            <div className="mt-6 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                Direct Support Line
              </span>
              <span className="text-xs font-bold text-amber-400 font-mono flex items-center justify-center gap-1.5 mt-0.5">
                <PhoneCall className="w-3.5 h-3.5" /> +94 75 284 0841
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-center text-[10px] text-slate-600 font-mono">
              SNGxJOURNAL Ecosystem Systems Hub v4.2
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
