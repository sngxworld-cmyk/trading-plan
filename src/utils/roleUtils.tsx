import React from "react";
import { PlatformRole, UserProfile } from "../types";
import { Crown, ShieldCheck, Shield, CheckCircle2, User, Clock, Star, Award } from "lucide-react";

export function isPendingUser(user?: Partial<UserProfile> | null): boolean {
  if (!user) return true;
  const emailLower = (user.email || "").toLowerCase();
  if (emailLower === "sngxworld@gmail.com" || user.role === "admin" || user.platformRole === "owner") {
    return false;
  }
  return user.status !== "approved" || user.platformRole === "pending_user";
}

export function getEffectiveRole(user?: Partial<UserProfile> | null): PlatformRole {
  if (!user) return "pending_user";
  if (user.platformRole) return user.platformRole;
  if (user.email?.toLowerCase() === "sngxworld@gmail.com" || user.role === "admin") {
    return "owner";
  }
  if (user.status === "approved") {
    return "member";
  }
  return "pending_user";
}

export function getRoleConfig(role: PlatformRole) {
  switch (role) {
    case "owner":
      return {
        label: "OWNER",
        rankNumber: 1,
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-amber-500/10",
        pillClass: "bg-amber-500 text-slate-950",
        icon: Crown,
        iconColor: "text-amber-400",
        description: "Primary Host & System Owner",
      };
    case "sub_owner":
      return {
        label: "SUB OWNER",
        rankNumber: 2,
        badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-purple-500/10",
        pillClass: "bg-purple-500 text-white",
        icon: Award,
        iconColor: "text-purple-400",
        description: "Ecosystem Co-Owner & Administrator",
      };
    case "verified_signal_provider":
      return {
        label: "VERIFIED SIGNAL PROVIDER",
        rankNumber: 3,
        badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10",
        pillClass: "bg-emerald-500 text-slate-950",
        icon: CheckCircle2,
        iconColor: "text-emerald-400",
        description: "Top-Tier Signal Provider (≥85% Verified Win Rate)",
      };
    case "moderator":
      return {
        label: "MODERATOR",
        rankNumber: 4,
        badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-sky-500/10",
        pillClass: "bg-sky-500 text-slate-950",
        icon: Shield,
        iconColor: "text-sky-400",
        description: "Community Moderator & Security Officer",
      };
    case "signal_provider":
      return {
        label: "SIGNAL PROVIDER",
        rankNumber: 5,
        badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10",
        pillClass: "bg-indigo-500 text-white",
        icon: Star,
        iconColor: "text-indigo-400",
        description: "Public / Free Signal Group Creator",
      };
    case "member":
      return {
        label: "MEMBER",
        rankNumber: 6,
        badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
        pillClass: "bg-slate-700 text-slate-200",
        icon: User,
        iconColor: "text-slate-400",
        description: "Active Approved Trader",
      };
    case "pending_user":
    default:
      return {
        label: "PENDING USER",
        rankNumber: 7,
        badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        pillClass: "bg-rose-500 text-white",
        icon: Clock,
        iconColor: "text-rose-400",
        description: "5-Day Trial / Pending Approval",
      };
  }
}

export const RoleBadge: React.FC<{
  role?: PlatformRole;
  user?: Partial<UserProfile> | null;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
}> = ({ role, user, size = "xs", showIcon = true }) => {
  const effectiveRole = role || getEffectiveRole(user);
  const cfg = getRoleConfig(effectiveRole);
  const Icon = cfg.icon;

  const sizeClasses = {
    xs: "text-[10px] px-2 py-0.5 gap-1",
    sm: "text-xs px-2.5 py-1 gap-1.5",
    md: "text-sm px-3 py-1.5 gap-2",
  }[size];

  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase rounded-md border tracking-wider shadow-sm whitespace-nowrap ${cfg.badgeClass} ${sizeClasses}`}
      title={cfg.description}
    >
      {showIcon && <Icon className={`${iconSizes} ${cfg.iconColor} shrink-0`} />}
      <span>({cfg.label})</span>
    </span>
  );
};
