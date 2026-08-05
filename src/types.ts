export type UserRole = "admin" | "client";
export type UserStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  tradingData?: TradingDataStore | null;
}

export interface DayRecord {
  state: "green" | "red" | "neutral" | "";
  amount: string;
  roi: string;
  notes?: string;
}

export interface MonthData {
  [day: number]: DayRecord;
}

export interface YearRangeStore {
  [monthIdx: number]: MonthData;
}

export interface TradingDataStore {
  [yearRange: string]: YearRangeStore;
}

export interface AppMetadata {
  yearRange: string;
  startMonth: number;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  hasData: boolean;
}

export interface AuditLogItem {
  timestamp: string;
  message: string;
  type: "info" | "access" | "warn";
}

export interface AdminStats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  rejectedUsers: number;
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
}

export interface TickerData {
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
}
