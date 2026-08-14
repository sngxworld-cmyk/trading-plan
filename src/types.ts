export type UserRole = "admin" | "client";
export type UserStatus = "pending" | "approved" | "rejected" | "revoked";

export type PlatformRole =
  | "owner"
  | "sub_owner"
  | "verified_signal_provider"
  | "moderator"
  | "signal_provider"
  | "member"
  | "pending_user";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  dob?: string;
  bio?: string;
  tradingPair?: string;
  startingCapital?: string;
  role: UserRole;
  platformRole?: PlatformRole;
  status: UserStatus;
  hideIdentity?: boolean;
  createdAt?: string;
  lastLogin?: string;
  tradingData?: TradingDataStore | null;
}

export type User = UserProfile;

export interface ChatMessage {
  id: string;
  senderId: string;
  senderEmail: string;
  senderUsername: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  senderRole: PlatformRole;
  content: string;
  photoUrl?: string;
  audioUrl?: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface SignalVote {
  userEmail: string;
  vote: "tp" | "sl";
  votedAt: string;
}

export interface SignalItem {
  id: string;
  groupId: string;
  groupName: string;
  tradeNumberStr: string; // e.g. "03/08 TRADE 01"
  tradeDateStr: string;
  coin: string; // e.g. "BTCUSDT.P"
  entry: string;
  tp1: string;
  tp2?: string;
  sl: string;
  leverage: string;
  riskPercent?: string;
  description: string;
  chartPhotoUrl: string;
  status: "open" | "voting" | "closed";
  votingEndsAt?: string; // 3 days from when finished
  result?: "tp" | "sl" | "inconclusive";
  tpVotesCount?: number;
  slVotesCount?: number;
  votes?: { [userEmail: string]: "tp" | "sl" };
  createdAt: string;
  closedAt?: string;
  adminEmail: string;
}

export interface GroupChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderEmail: string;
  senderUsername: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  senderRole: PlatformRole;
  content: string;
  photoUrl?: string;
  audioUrl?: string;
  createdAt: string;
  isAnnouncement?: boolean;
}

export interface SignalGroup {
  id: string;
  name: string;
  logoUrl?: string;
  description: string;
  adminEmail: string;
  adminUsername: string;
  adminDisplayName: string;
  adminPhotoURL?: string;
  adminRole: PlatformRole;
  isVerified: boolean; // >= 85% win rate after >= 30 signals
  isPaid: boolean;
  priceUsd: number; // Max $17 (5000 LKR equivalent)
  membersCount: number;
  members: string[]; // List of user emails
  allowMemberChat: boolean; // whether member chat is enabled
  adminOnlyChat?: boolean; // when true, only group admin (and allowedChatMembers) can send messages
  allowedChatMembers?: string[]; // list of specific member emails explicitly given write/chat permissions
  hideMembers: boolean;
  totalSignals: number;
  wonSignals: number;
  lostSignals: number;
  winRate: number; // Percentage (e.g. 86.67)
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  senderEmail: string;
  senderUsername: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  senderRole?: PlatformRole;
  receiverEmail: string;
  receiverUsername: string;
  receiverDisplayName: string;
  content: string;
  createdAt: string;
  isJoinRequest?: boolean;
  targetGroupName?: string;
  targetGroupId?: string;
}

export interface DayRecord {
  state: "green" | "red" | "neutral" | "";
  amount: string;
  roi: string;
  notes?: string;
  description?: string;
  subTrades?: DayRecord[];
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
  startingCapital?: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  dob?: string;
  bio?: string;
  tradingPair?: string;
  startingCapital?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  hasData?: boolean;
}

export interface AuditLogItem {
  id?: string;
  timestamp: string;
  message: string;
  type: "info" | "access" | "warn" | "success" | "warning";
}

export type AuditLog = AuditLogItem;

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
