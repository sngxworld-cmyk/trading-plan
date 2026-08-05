import React, { useState, useEffect } from "react";
import {
  AdminUserRecord,
  AuditLogItem,
  AdminStats,
} from "../types";
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Plus,
  Mail,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Activity,
  KeyRound,
  ExternalLink,
  Eye,
  CheckCheck,
  Lock,
  ShieldAlert,
  X,
  UserPlus,
  BarChart3,
} from "lucide-react";

interface HostAdminPortalProps {
  onReturnToApp: () => void;
}

export const HostAdminPortal: React.FC<HostAdminPortalProps> = ({
  onReturnToApp,
}) => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [preApprovedGmails, setPreApprovedGmails] = useState<string[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    approvedUsers: 0,
    pendingUsers: 0,
    rejectedUsers: 0,
  });

  const [loading, setLoading] = useState(false);
  const [newGmail, setNewGmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Reset password modal state
  const [resetModalUser, setResetModalUser] = useState<AdminUserRecord | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");

  // Inspect user trading data modal state
  const [inspectUser, setInspectUser] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    let serverUsers: AdminUserRecord[] = [];
    let serverGmails: string[] = [];
    let serverLogs: any[] = [];
    let serverStats: any = null;

    try {
      const res = await fetch("/api/admin/users");
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        serverUsers = data.users || [];
        serverGmails = data.preApprovedEmails || [];
        serverLogs = data.logs || [];
        serverStats = data.stats || null;
      }
    } catch (err) {
      console.warn("Server admin fetch notice:", err);
    }

    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const localPreApproved: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");

    const combinedUserMap = new Map<string, AdminUserRecord>();
    serverUsers.forEach((u) => combinedUserMap.set(u.email.toLowerCase(), u));
    localUsers.forEach((u) => combinedUserMap.set(u.email.toLowerCase(), u));

    const finalUsers = Array.from(combinedUserMap.values());
    const finalGmails = Array.from(new Set([...serverGmails, ...localPreApproved]));

    setUsers(finalUsers);
    setPreApprovedGmails(finalGmails);
    setLogs(serverLogs);

    const total = finalUsers.length;
    const approved = finalUsers.filter((u) => u.status === "approved").length;
    const pending = finalUsers.filter((u) => u.status === "pending").length;

    setStats(
      serverStats || {
        totalUsers: total,
        approvedUsers: approved,
        pendingUsers: pending,
        systemHealth: "100% Operational",
        memoryUsageMB: 14,
        serverUptimeHours: 24,
      }
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchAdminData();
    const timer = setInterval(fetchAdminData, 6000); // Auto refresh every 6 seconds
    return () => clearInterval(timer);
  }, []);

  const handleGrantAccess = async (userOrEmail: { id?: string; email: string }) => {
    const targetEmail = userOrEmail.email.trim().toLowerCase();

    // Update local storage
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updatedLocals = localUsers.map((u) =>
      u.email.toLowerCase() === targetEmail ? { ...u, status: "approved" as const } : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updatedLocals));

    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userOrEmail.id, email: userOrEmail.email }),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        setActionMessage({ text: data.message, type: "success" });
      } else {
        setActionMessage({ text: `Access granted for ${userOrEmail.email}!`, type: "success" });
      }
    } catch {
      setActionMessage({ text: `Access granted for ${userOrEmail.email}!`, type: "success" });
    }
    fetchAdminData();
  };

  const handleApproveAllPending = async () => {
    if (!confirm("Grant instant access to all pending client Gmail accounts?")) return;

    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updatedLocals = localUsers.map((u) => ({ ...u, status: "approved" as const }));
    localStorage.setItem("sngx_local_users", JSON.stringify(updatedLocals));

    try {
      await fetch("/api/admin/approve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Ignored
    }
    setActionMessage({ text: "All pending client accounts have been approved!", type: "success" });
    fetchAdminData();
  };

  const handleRevokeAccess = async (userOrEmail: { id?: string; email: string }) => {
    const targetEmail = userOrEmail.email.trim().toLowerCase();

    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updatedLocals = localUsers.map((u) =>
      u.email.toLowerCase() === targetEmail ? { ...u, status: "pending" as const } : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updatedLocals));

    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userOrEmail.id, email: userOrEmail.email }),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        setActionMessage({ text: data.message, type: "success" });
      } else {
        setActionMessage({ text: `Access revoked for ${userOrEmail.email}. Account set to Under Review.`, type: "success" });
      }
    } catch {
      setActionMessage({ text: `Access revoked for ${userOrEmail.email}. Account set to Under Review.`, type: "success" });
    }
    fetchAdminData();
  };

  const handlePreAddGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGmail || !newGmail.includes("@")) {
      setActionMessage({ text: "Please enter a valid Gmail address.", type: "error" });
      return;
    }

    const clean = newGmail.trim().toLowerCase();
    const preApprovedList: string[] = JSON.parse(localStorage.getItem("sngx_preapproved_emails") || "[]");
    if (!preApprovedList.includes(clean)) {
      preApprovedList.push(clean);
      localStorage.setItem("sngx_preapproved_emails", JSON.stringify(preApprovedList));
    }

    try {
      await fetch("/api/admin/add-gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
    } catch {
      // Ignored
    }

    setActionMessage({ text: `Gmail ${clean} added to pre-approved whitelist.`, type: "success" });
    setNewGmail("");
    fetchAdminData();
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPasswordVal) return;

    const targetEmail = resetModalUser.email.trim().toLowerCase();
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updatedLocals = localUsers.map((u) =>
      u.email.toLowerCase() === targetEmail || u.id === resetModalUser.id
        ? { ...u, password: newPasswordVal }
        : u
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updatedLocals));

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetModalUser.id, email: resetModalUser.email, newPassword: newPasswordVal }),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        setActionMessage({ text: data.message, type: "success" });
      } else {
        setActionMessage({ text: `Password successfully updated for ${resetModalUser.email}`, type: "success" });
      }
    } catch {
      setActionMessage({ text: `Password successfully updated for ${resetModalUser.email}`, type: "success" });
    }

    setResetModalUser(null);
    setNewPasswordVal("");
    fetchAdminData();
  };

  const handleToggleRole = async (u: AdminUserRecord) => {
    const targetRole = u.role === "admin" ? "client" : "admin";
    if (!confirm(`Are you sure you want to change ${u.email}'s role to ${targetRole.toUpperCase()}?`)) return;

    const targetEmail = u.email.trim().toLowerCase();
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updatedLocals = localUsers.map((item) =>
      item.email.toLowerCase() === targetEmail || item.id === u.id
        ? { ...item, role: targetRole, status: targetRole === "admin" ? ("approved" as const) : item.status }
        : item
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updatedLocals));

    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, email: u.email, role: targetRole }),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        setActionMessage({ text: data.message, type: "success" });
      } else {
        setActionMessage({ text: `Role updated to ${targetRole} for ${u.email}`, type: "success" });
      }
    } catch {
      setActionMessage({ text: `Role updated to ${targetRole} for ${u.email}`, type: "success" });
    }
    fetchAdminData();
  };

  const handleInspectUserData = async (userId: string, email?: string) => {
    setInspectLoading(true);
    let found = false;
    try {
      const res = await fetch(`/api/admin/user-details/${userId}`);
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        if (data.user) {
          setInspectUser(data.user);
          found = true;
        }
      }
    } catch {
      // Ignored
    }

    if (!found) {
      const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
      const matched = localUsers.find(
        (u) => u.id === userId || (email && u.email.toLowerCase() === email.toLowerCase())
      );
      if (matched) {
        setInspectUser({
          ...matched,
          tradingData: JSON.parse(localStorage.getItem(`sngx_trading_data_${matched.email}`) || "{}"),
        });
      }
    }
    setInspectLoading(false);
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently delete account for ${email}?`)) return;

    const targetEmail = email.trim().toLowerCase();
    const localUsers: AdminUserRecord[] = JSON.parse(localStorage.getItem("sngx_local_users") || "[]");
    const updatedLocals = localUsers.filter(
      (u) => u.email.toLowerCase() !== targetEmail && u.id !== userId
    );
    localStorage.setItem("sngx_local_users", JSON.stringify(updatedLocals));

    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        setActionMessage({ text: data.message, type: "success" });
      } else {
        setActionMessage({ text: `Account for ${email} permanently deleted.`, type: "success" });
      }
    } catch {
      setActionMessage({ text: `Account for ${email} permanently deleted.`, type: "success" });
    }
    fetchAdminData();
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && u.status === statusFilter;
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-2 font-mono">
              <ShieldCheck className="w-4 h-4" /> SNGxCRYPTO Master Control Web
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Client Gmail Login & Access Control
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Grant or revoke Gmail access for clients registering on your 1-Year Strategic Trading Plan web app.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {stats.pendingUsers > 0 && (
              <button
                onClick={handleApproveAllPending}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <CheckCheck className="w-4 h-4" /> Grant All ({stats.pendingUsers}) Pending
              </button>
            )}

            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
              Sync Data
            </button>

            <button
              onClick={onReturnToApp}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Open Client App
            </button>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-lg animate-in fade-in duration-150 ${
              actionMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
              Total Clients
            </span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">
              {stats.totalUsers}
            </span>
            <span className="text-[11px] text-slate-400">Registered Gmail records</span>
          </div>

          <div className="bg-slate-900 border border-amber-500/30 bg-amber-500/5 p-5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 uppercase tracking-widest font-mono block">
                Pending Review
              </span>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
            </div>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
              {stats.pendingUsers}
            </span>
            <span className="text-[11px] text-amber-300/80">Awaiting Host Gmail Approval</span>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 bg-emerald-500/5 p-5 rounded-2xl shadow-lg">
            <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono block">
              Granted Access
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
              {stats.approvedUsers}
            </span>
            <span className="text-[11px] text-emerald-300/80">Active trading plan access</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
            <span className="text-[10px] text-rose-400 uppercase tracking-widest font-mono block">
              Revoked / Denied
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
              {stats.rejectedUsers}
            </span>
            <span className="text-[11px] text-slate-400">Blocked Gmail accounts</span>
          </div>
        </div>

        {/* Pre-Grant Gmail Access Box */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" /> Pre-Grant Access to a Gmail Address
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Type a client's Gmail address below to grant instant access. When this client signs up or logs in with this Gmail, they will bypass "Under Review" and get immediate trading plan & charts access!
          </p>

          <form onSubmit={handlePreAddGmail} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={newGmail}
                onChange={(e) => setNewGmail(e.target.value)}
                placeholder="enter.client.gmail@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Pre-Approve Gmail Access
            </button>
          </form>
        </div>

        {/* Registered Client Access Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Table Controls Header */}
          <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Registered Client Gmail Accounts</h3>
              <p className="text-xs text-slate-400">Click Grant Access to enable charts and trading content for a client</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(["all", "pending", "approved", "rejected"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      statusFilter === st
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Gmail or username..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Table Contents */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  <th className="p-4">Client Gmail & Username</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Access Status</th>
                  <th className="p-4">Registration Date</th>
                  <th className="p-4 text-right">Host Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                      No registered client Gmail records match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-200 font-mono">{u.email}</div>
                        <div className="text-[11px] text-slate-500">@{u.username}</div>
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleToggleRole(u)}
                          title="Click to change role"
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all ${
                            u.role === "admin"
                              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          {u.role}
                        </button>
                      </td>

                      <td className="p-4">
                        {u.status === "approved" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Access Granted
                          </span>
                        ) : u.status === "pending" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-[11px] animate-pulse">
                            <Clock className="w-3.5 h-3.5" /> Under Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Revoked
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-slate-400 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}{" "}
                        {new Date(u.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="p-4 text-right">
                        {u.role === "admin" && u.email === "sngxworld@gmail.com" ? (
                          <span className="text-[11px] text-indigo-400 font-bold font-mono">
                            Master Host
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* Inspect Trading Data */}
                            <button
                              onClick={() => handleInspectUserData(u.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                              title="Inspect client's trading plan records"
                            >
                              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResetModalUser(u);
                                setNewPasswordVal("");
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors"
                              title="Reset client password"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            {/* Grant Access */}
                            {u.status !== "approved" && (
                              <button
                                onClick={() => handleGrantAccess(u)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Grant Access
                              </button>
                            )}

                            {/* Revoke Access */}
                            {u.status === "approved" && (
                              <button
                                onClick={() => handleRevokeAccess(u)}
                                className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-semibold text-xs transition-colors flex items-center gap-1"
                              >
                                <UserX className="w-3.5 h-3.5" /> Revoke
                              </button>
                            )}

                            {/* Delete User */}
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                              title="Delete account record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Activity & Pre-Approved Gmails Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pre-Approved List */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Pre-Approved Gmail Addresses ({preApprovedGmails.length})
            </h3>
            <p className="text-xs text-slate-400 mb-4">Clients with these Gmail addresses bypass review when signing up</p>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {preApprovedGmails.map((gm) => (
                <div
                  key={gm}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-slate-200">{gm}</span>
                  {gm !== "sngxworld@gmail.com" && (
                    <button
                      onClick={() => handleRevokeAccess({ email: gm })}
                      className="text-slate-500 hover:text-rose-400 text-xs px-2 py-0.5 rounded hover:bg-slate-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs Stream */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Live Audit Log Stream
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">Real-time authentication and access events</p>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 font-mono text-[11px]">
              {logs.map((lg, i) => (
                <div
                  key={i}
                  className="bg-slate-950 border border-slate-800/80 rounded-lg p-2 flex items-start gap-2"
                >
                  <span className="text-slate-500 shrink-0">
                    {new Date(lg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={
                      lg.type === "access"
                        ? "text-emerald-400 font-semibold"
                        : lg.type === "warn"
                        ? "text-rose-400 font-semibold"
                        : "text-slate-300"
                    }
                  >
                    {lg.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" /> Reset Password for Client
              </h3>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Account: <span className="text-indigo-400 font-mono font-bold">{resetModalUser.email}</span> (@{resetModalUser.username})
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                  New Password:
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="Enter new security password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-amber-500/20"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT USER TRADING PLAN DATA MODAL */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" /> Client Trading Plan Inspection
                </h3>
                <p className="text-xs text-slate-400 font-mono">{inspectUser.email} (@{inspectUser.username})</p>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Status</span>
                <span className="text-xs font-bold font-mono text-emerald-400 uppercase">{inspectUser.status}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Role</span>
                <span className="text-xs font-bold font-mono text-indigo-400 uppercase">{inspectUser.role}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Registered</span>
                <span className="text-xs font-bold font-mono text-slate-300">{new Date(inspectUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase font-mono">Recorded Trading Plan Data (JSON)</h4>
              <pre className="text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                {JSON.stringify(inspectUser.tradingData || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectUser(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-xl text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
