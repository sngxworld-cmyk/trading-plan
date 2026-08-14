import React, { useState, useEffect, useRef } from "react";
import { SignalGroup, SignalItem, UserProfile, GroupChatMessage } from "../types";
import { RoleBadge, getEffectiveRole, isPendingUser } from "../utils/roleUtils";
import {
  getSignals,
  finishTradeStartFeedback,
  castSignalVote,
  recalculateGroupStats,
  updateGroupSubscriptionPricing,
  adminToggleGroupVerification,
  getGroupChatMessages,
  sendGroupChatMessage,
  updateGroupChatSettings,
  toggleMemberChatPermission,
  deleteGroupChatMessage,
  deleteSignalGroup,
  canUserChatInGroup,
  sendDirectMessage,
  getSignalGroups,
} from "../lib/communityStore";
import { downloadImageToLocal } from "../utils/fileUtils";
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Lock,
  Unlock,
  MessageSquare,
  Users,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Info,
  Maximize2,
  X,
  DollarSign,
  Award,
  Settings,
  ShieldCheck,
  Send,
  Mic,
  Trash2,
  Megaphone,
  Radio,
  Volume2,
  UserCheck,
  UserX,
  Sparkles,
  Key,
  HelpCircle,
  Download,
} from "lucide-react";
import { CreateSignalModal } from "./CreateSignalModal";
import { CommunityGuidelinesModal } from "./CommunityGuidelinesModal";

interface SignalGroupDetailViewProps {
  group: SignalGroup;
  currentUser: UserProfile;
  onBack: () => void;
  onOpenProfile: (user: any) => void;
}

export const SignalGroupDetailView: React.FC<SignalGroupDetailViewProps> = ({
  group: initialGroup,
  currentUser,
  onBack,
  onOpenProfile,
}) => {
  const [group, setGroup] = useState<SignalGroup>(initialGroup);
  const [activeTab, setActiveTab] = useState<"signals" | "chat" | "members">("signals");

  // Signals State
  const [signals, setSignals] = useState<SignalItem[]>(() => {
    return getSignals().filter((s) => s.groupId === initialGroup.id);
  });
  const [isCreateSignalOpen, setIsCreateSignalOpen] = useState(false);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);

  // Group Chat State
  const [chatMessages, setChatMessages] = useState<GroupChatMessage[]>(() => {
    return getGroupChatMessages(initialGroup.id);
  });
  const [messageInput, setMessageInput] = useState("");
  const [photoAttachmentUrl, setPhotoAttachmentUrl] = useState("");
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSuccessToast, setChatSuccessToast] = useState<string | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceTimerRef = useRef<any>(null);

  // VIP Subscription Form State
  const [vipPaid, setVipPaid] = useState(group.isPaid);
  const [vipPrice, setVipPrice] = useState(group.priceUsd || 15);
  const [vipError, setVipError] = useState<string | null>(null);
  const [vipSuccess, setVipSuccess] = useState<string | null>(null);

  // Group Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isHost =
    currentUser.email.toLowerCase() === "sngxworld@gmail.com" || currentUser.role === "admin";
  const isGroupAdmin = group.adminEmail.toLowerCase() === currentUser.email.toLowerCase();
  const isAdmin = isGroupAdmin || isHost;

  const isEligibleVip = group.isVerified || (group.totalSignals >= 30 && group.winRate >= 75.0) || isHost;

  // Real-time Chat & Permission Status
  const userChatStatus = canUserChatInGroup(currentUser, group);
  const allowedList = (group.allowedChatMembers || []).map((e) => e.toLowerCase());
  const isExplicitlyAllowed = allowedList.includes(currentUser.email.toLowerCase());

  // Polling / Auto-refresh for group chat & signals
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(getSignals().filter((s) => s.groupId === group.id));
      setChatMessages(getGroupChatMessages(group.id));
      const freshGroup = getSignalGroups().find((g) => g.id === group.id);
      if (freshGroup) {
        setGroup(freshGroup);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [group.id]);

  // Scroll to bottom of chat on new message or tab switch
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  const refreshSignals = () => {
    setSignals(getSignals().filter((s) => s.groupId === group.id));
  };

  const refreshChat = () => {
    setChatMessages(getGroupChatMessages(group.id));
  };

  const handleDeleteGroup = () => {
    setDeleteError(null);
    const res = deleteSignalGroup(currentUser, group.id);
    if (res.success) {
      onBack();
    } else {
      setDeleteError(res.error || "Failed to delete group.");
    }
  };

  const handleFinishTrade = (sigId: string) => {
    const res = finishTradeStartFeedback(currentUser, sigId);
    if (res.success) {
      refreshSignals();
    } else {
      alert(res.error || "Failed to initiate trade feedback.");
    }
  };

  const handleVote = (sigId: string, vote: "tp" | "sl") => {
    const res = castSignalVote(currentUser, sigId, vote);
    if (res.success) {
      setVoteMessage(`Vote recorded: ${vote.toUpperCase()}! Results remain hidden until 3-day window ends.`);
      setTimeout(() => setVoteMessage(null), 3500);
      refreshSignals();
    } else {
      alert(res.error || "Voting failed.");
    }
  };

  const handleSaveVipSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setVipError(null);
    setVipSuccess(null);

    const res = updateGroupSubscriptionPricing(currentUser, group.id, {
      isPaid: vipPaid,
      priceUsd: vipPaid ? vipPrice : 0,
    });

    if (!res.success || !res.group) {
      setVipError(res.error || "Failed to update VIP subscription settings.");
      return;
    }

    setGroup(res.group);
    setVipSuccess("VIP Subscription Settings successfully updated!");
    setTimeout(() => {
      setVipSuccess(null);
      setIsVipModalOpen(false);
    }, 1500);
  };

  const handleHostToggleVerification = () => {
    const newStatus = !group.isVerified;
    const res = adminToggleGroupVerification(currentUser, group.id, newStatus);
    if (res.success && res.group) {
      setGroup(res.group);
    } else {
      alert(res.error || "Failed to update verification status.");
    }
  };

  // --- GROUP CHAT ACTIONS ---

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setChatError(null);

    if (!messageInput.trim() && !photoAttachmentUrl) {
      return;
    }

    const res = sendGroupChatMessage(
      group.id,
      currentUser,
      messageInput,
      photoAttachmentUrl,
      undefined,
      isAnnouncementMode
    );

    if (!res.success) {
      setChatError(res.error || "Failed to send message.");
      return;
    }

    setMessageInput("");
    setPhotoAttachmentUrl("");
    setShowPhotoInput(false);
    setIsAnnouncementMode(false);
    refreshChat();
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setChatError("Image size must be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPhotoAttachmentUrl(reader.result);
          setShowPhotoInput(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Voice note simulator
  const handleStartVoiceRecording = () => {
    setIsVoiceRecording(true);
    setVoiceSeconds(0);
    voiceTimerRef.current = setInterval(() => {
      setVoiceSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopAndSendVoice = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    setIsVoiceRecording(false);

    const simulatedAudioUrl = `voice_memo_${Date.now()}`;
    const res = sendGroupChatMessage(
      group.id,
      currentUser,
      `🎙️ Voice Analysis Note (${voiceSeconds}s)`,
      undefined,
      simulatedAudioUrl
    );

    if (res.success) {
      refreshChat();
    } else {
      setChatError(res.error || "Failed to send voice note.");
    }
    setVoiceSeconds(0);
  };

  const handleCancelVoice = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    setIsVoiceRecording(false);
    setVoiceSeconds(0);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    const res = deleteGroupChatMessage(currentUser, group.id, messageId);
    if (res.success) {
      refreshChat();
    } else {
      alert(res.error || "Could not delete message.");
    }
  };

  // Admin Quick Toggle Chat Mode (Admin-Only Talk vs Open Member Chat)
  const handleQuickToggleAdminOnly = () => {
    const newAdminOnly = !group.adminOnlyChat;
    const res = updateGroupChatSettings(currentUser, group.id, {
      adminOnlyChat: newAdminOnly,
      allowMemberChat: !newAdminOnly,
      allowedChatMembers: group.allowedChatMembers,
    });

    if (res.success && res.group) {
      setGroup(res.group);
      setChatSuccessToast(
        newAdminOnly
          ? "Admin-Only Talk Mode is now ACTIVE. Only admin & authorized members can text."
          : "Open Community Chat is now ACTIVE. All members can chat!"
      );
      setTimeout(() => setChatSuccessToast(null), 4000);
      refreshChat();
    } else {
      alert(res.error || "Failed to toggle chat mode.");
    }
  };

  // Admin Toggle Individual Member Chat Permission
  const handleToggleMemberPermission = (memberEmail: string) => {
    const res = toggleMemberChatPermission(currentUser, group.id, memberEmail);
    if (res.success && res.group) {
      setGroup(res.group);
      const isNowAllowed = res.isNowAllowed;
      setChatSuccessToast(
        isNowAllowed
          ? `Granted messaging permission to ${memberEmail}!`
          : `Revoked messaging permission for ${memberEmail}.`
      );
      setTimeout(() => setChatSuccessToast(null), 3500);
    } else {
      alert(res.error || "Failed to modify member chat permission.");
    }
  };

  // Regular Member: Send Permission Request DM to Admin
  const handleRequestChatAccess = () => {
    const res = sendDirectMessage(
      currentUser,
      {
        email: group.adminEmail,
        username: group.adminUsername,
        displayName: group.adminDisplayName,
      },
      `Hi ${group.adminDisplayName || group.adminUsername}, I would like to request chat/messaging permission in your signal group "${group.name}". Thank you!`,
      false,
      group.name,
      group.id
    );

    if (res.success) {
      setChatSuccessToast("Chat access request sent directly to group admin!");
      setTimeout(() => setChatSuccessToast(null), 4000);
    } else {
      alert(res.error || "Failed to send request.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-300 font-bold font-mono">
              {group.logoUrl ? (
                <img
                  src={group.logoUrl}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-indigo-400">{group.name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 font-mono">{group.name}</h1>
                <RoleBadge role={group.adminRole} size="xs" />
                {group.isVerified ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> VERIFIED VIP (≥75% WIN)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono font-bold">
                    FREE COMMUNITY GROUP
                  </span>
                )}
                {group.isPaid && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> VIP ${group.priceUsd}/mo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                Admin:{" "}
                <button
                  onClick={() =>
                    onOpenProfile({
                      email: group.adminEmail,
                      username: group.adminUsername,
                      displayName: group.adminDisplayName,
                      role: group.adminRole,
                    })
                  }
                  className="text-indigo-400 hover:underline font-semibold"
                >
                  {group.adminDisplayName || group.adminUsername}
                </button>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {group.membersCount} members
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">
                  {group.winRate > 0 ? `${group.winRate}% Win Rate` : "Win Rate calculating..."} ({group.totalSignals} closed)
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsGuidelinesOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-amber-400" /> Guidelines
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsVipModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                title="VIP Monetization Settings"
              >
                <Settings className="w-3.5 h-3.5" /> VIP Subscription
              </button>
            )}

            {isHost && (
              <button
                onClick={handleHostToggleVerification}
                className={`px-3 py-2 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-colors ${
                  group.isVerified
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/60"
                    : "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60"
                }`}
                title="Host Admin VIP Override"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> {group.isVerified ? "Revoke VIP" : "Host Verify VIP"}
              </button>
            )}

            {(isHost || isGroupAdmin) && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-mono flex items-center gap-1.5 transition-colors shadow-sm"
                title={isHost ? "Host Admin: Delete Any Group (Verified or Free)" : "Delete Group"}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Group
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setIsCreateSignalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-4 h-4" /> Give a Signal
              </button>
            )}
          </div>
        </div>

        {/* Group Description */}
        <p className="mt-4 text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 leading-relaxed">
          {group.description}
        </p>

        {/* VIP Qualification Progress Banner */}
        <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <Award className={`w-4 h-4 shrink-0 ${group.isVerified ? "text-emerald-400" : "text-amber-400"}`} />
            <div>
              <span className="font-bold text-slate-200 block">
                {group.isVerified
                  ? "VIP Status: Qualified & Verified (75%–85%+ Win Rate)"
                  : "VIP Status Progress Tracker (30 Closed Trades & 75%–85% Win Rate)"}
              </span>
              <span className="text-[11px] text-slate-400">
                Closed Trades: <strong className="text-indigo-300">{group.totalSignals}/30</strong> • Win Rate: <strong className="text-emerald-400">{group.winRate}%</strong> • Won: {group.wonSignals} | Lost: {group.lostSignals}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {group.isVerified ? (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                VIP Monetization Active
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                {Math.max(0, 30 - group.totalSignals)} more trades needed
              </span>
            )}
          </div>
        </div>

        {/* Free Tier Disclaimer Alert */}
        {!group.isVerified && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300 font-mono">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>ALERT: THESE AREN'T VERIFIED SIGNALS SO TAKE YOUR OWN RISK</span>
          </div>
        )}
      </div>

      {/* Interactive Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("signals")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === "signals"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Trade Signals ({signals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 transition-all relative ${
            activeTab === "chat"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Group Chat & Talk</span>
          {group.adminOnlyChat ? (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Admin Only
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/30">
              Open
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === "members"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members & Permissions ({group.membersCount})</span>
        </button>
      </div>

      {chatSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {chatSuccessToast}
        </div>
      )}

      {voteMessage && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" /> {voteMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: TRADE SIGNALS FEED */}
      {/* ========================================================================= */}
      {activeTab === "signals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" /> Published Trade Setups ({signals.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Max 10 signals/day • 3-day member voting
            </span>
          </div>

          {signals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-300 font-mono">No Trade Signals Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The group administrator has not published any trade setups today.
              </p>
              {isAdmin && (
                <button
                  onClick={() => setIsCreateSignalOpen(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Give First Signal
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {signals.map((sig) => {
                const hasVoted = sig.votes && sig.votes[currentUser.email.toLowerCase()];
                const isVotingActive = sig.status === "voting";
                const isClosed = sig.status === "closed";

                return (
                  <div
                    key={sig.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
                  >
                    {/* Signal Header */}
                    <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 font-mono bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                          {sig.tradeNumberStr}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          -(USER) {sig.adminEmail.split("@")[0].toUpperCase()} (ADMIN)
                        </span>
                      </div>

                      {/* Status Indicator */}
                      {sig.status === "open" && (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" /> ACTIVE RUNNING
                        </span>
                      )}
                      {sig.status === "voting" && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 3-DAY FEEDBACK VOTING
                        </span>
                      )}
                      {sig.status === "closed" && (
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 border ${
                            sig.result === "tp"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : sig.result === "sl"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {sig.result === "tp"
                            ? "HIT TP (WIN)"
                            : sig.result === "sl"
                            ? "HIT SL (LOSS)"
                            : "INCONCLUSIVE"}
                        </span>
                      )}
                    </div>

                    {/* Signal Body: Chart Photo + Setup Grid */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Chart Photo View */}
                      <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                        <img
                          src={sig.chartPhotoUrl}
                          alt="Trade Chart Analysis"
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setZoomedImage(sig.chartPhotoUrl)}
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImageToLocal(sig.chartPhotoUrl, `${sig.coin}_${sig.tradeNumberStr.replace(/\s+/g, "_")}_chart.png`);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 hover:bg-indigo-600 text-slate-200 text-xs font-mono flex items-center gap-1 shadow-lg transition-all border border-slate-800 hover:border-indigo-500"
                            title="Download Chart to Local Device"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-300" />
                            <span className="text-[10px] font-bold">Download</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomedImage(sig.chartPhotoUrl)}
                            className="p-1.5 rounded-lg bg-slate-950/90 text-slate-300 hover:text-white border border-slate-800"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Trade Parameters Grid */}
                      <div className="flex flex-col justify-between space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">COIN PAIR</span>
                            <strong className="text-indigo-300 text-sm">{sig.coin}</strong>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">LEVERAGE</span>
                            <strong className="text-slate-200 text-sm">{sig.leverage}</strong>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">ENTRY PRICE</span>
                            <strong className="text-slate-200">{sig.entry}</strong>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">RISK %</span>
                            <strong className="text-slate-200">{sig.riskPercent || "1-2%"}</strong>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-950 border border-emerald-950">
                            <span className="text-[10px] text-emerald-400 block">TAKE PROFIT 1 (TP1)</span>
                            <strong className="text-emerald-300">{sig.tp1}</strong>
                          </div>

                          {sig.tp2 ? (
                            <div className="p-2 rounded-xl bg-slate-950 border border-emerald-950">
                              <span className="text-[10px] text-emerald-400/80 block">TAKE PROFIT 2 (TP2)</span>
                              <strong className="text-emerald-300/80">{sig.tp2}</strong>
                            </div>
                          ) : (
                            <div className="p-2 rounded-xl bg-slate-950 border border-rose-950">
                              <span className="text-[10px] text-rose-400 block">STOP LOSS (SL)</span>
                              <strong className="text-rose-300">{sig.sl}</strong>
                            </div>
                          )}

                          {sig.tp2 && (
                            <div className="p-2 rounded-xl bg-slate-950 border border-rose-950 col-span-2">
                              <span className="text-[10px] text-rose-400 block">STOP LOSS (SL)</span>
                              <strong className="text-rose-300">{sig.sl}</strong>
                            </div>
                          )}
                        </div>

                        {/* Trade Description */}
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
                          <strong className="text-[10px] text-slate-500 uppercase tracking-wide block font-mono mb-0.5">
                            Analysis & Execution Notes:
                          </strong>
                          {sig.description}
                        </div>
                      </div>
                    </div>

                    {/* Signal Footer Actions: Finish Trade & Voting */}
                    <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      {sig.status === "open" && isAdmin && (
                        <button
                          onClick={() => handleFinishTrade(sig.id)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all"
                        >
                          <Clock className="w-4 h-4" /> Trade Finish Start Feedback (3 Days)
                        </button>
                      )}

                      {isVotingActive && (
                        <div className="w-full flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span>3-Day Member Voting Window Active (Results Hidden)</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500 mr-2">Did trade hit:</span>
                            <button
                              onClick={() => handleVote(sig.id, "tp")}
                              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                hasVoted === "tp"
                                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                                  : "bg-slate-800 hover:bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" /> [ TP ] {hasVoted === "tp" ? "✓" : ""}
                            </button>
                            <button
                              onClick={() => handleVote(sig.id, "sl")}
                              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                hasVoted === "sl"
                                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                                  : "bg-slate-800 hover:bg-rose-950/60 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" /> [ SL ] {hasVoted === "sl" ? "✓" : ""}
                            </button>
                          </div>
                        </div>
                      )}

                      {isClosed && (
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Trade feedback concluded & certified. Verified Outcome: <strong className="text-white uppercase">{sig.result}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REAL-TIME GROUP CHAT & TALK */}
      {/* ========================================================================= */}
      {activeTab === "chat" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
          {/* Chat Mode Control Header */}
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-200 font-mono">
                    {group.name} Channel Chat
                  </h3>
                  {group.adminOnlyChat ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> ADMIN ONLY TALK
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                      <Users className="w-3 h-3" /> OPEN DISCUSSION
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {group.adminOnlyChat
                    ? "Only the signal admin & authorized members can text. Members can read updates."
                    : "All group members can text, share chart ideas, and ask questions."}
                </p>
              </div>
            </div>

            {/* Admin Chat Controls */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickToggleAdminOnly}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                    group.adminOnlyChat
                      ? "bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-900/60"
                      : "bg-emerald-950/40 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60"
                  }`}
                  title="Toggle Admin-Only Talk Mode"
                >
                  {group.adminOnlyChat ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-400" /> Mode: Admin Talk Only (Click to Open)
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" /> Mode: Open Chat (Click for Admin Only)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-500">
                <MessageSquare className="w-10 h-10 stroke-1 text-slate-600" />
                <p className="text-xs font-mono">No messages posted in this channel yet.</p>
                <p className="text-[11px] text-slate-600 max-w-xs">
                  {group.adminOnlyChat
                    ? "The group admin will post signal updates and announcements here."
                    : "Be the first to say hello or discuss the latest market trends!"}
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMsgAdmin =
                  msg.senderEmail.toLowerCase() === group.adminEmail.toLowerCase() ||
                  msg.senderEmail.toLowerCase() === "sngxworld@gmail.com";
                const isMe = msg.senderEmail.toLowerCase() === currentUser.email.toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 group animate-in fade-in duration-200 ${
                      msg.isAnnouncement
                        ? "p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 my-2"
                        : ""
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 font-mono font-bold text-xs text-indigo-300">
                      {msg.senderPhotoURL ? (
                        <img
                          src={msg.senderPhotoURL}
                          alt={msg.senderDisplayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        msg.senderDisplayName.substring(0, 2).toUpperCase()
                      )}
                    </div>

                    {/* Content Box */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() =>
                            onOpenProfile({
                              email: msg.senderEmail,
                              username: msg.senderUsername,
                              displayName: msg.senderDisplayName,
                              role: msg.senderRole,
                            })
                          }
                          className="text-xs font-bold text-slate-200 hover:text-indigo-400 font-mono truncate"
                        >
                          {msg.senderDisplayName}
                        </button>
                        <RoleBadge role={msg.senderRole} size="xs" />
                        {isMsgAdmin && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono font-bold">
                            GROUP ADMIN
                          </span>
                        )}
                        {msg.isAnnouncement && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold flex items-center gap-0.5">
                            <Megaphone className="w-2.5 h-2.5" /> ANNOUNCEMENT
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono ml-auto shrink-0">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        {/* Delete message button (Admin or author) */}
                        {(isAdmin || isMe) && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Text content */}
                      {msg.content && (
                        <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}

                      {/* Photo Attachment with Zoom & Download */}
                      {msg.photoUrl && (
                        <div className="mt-2 relative max-w-sm rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group">
                          <img
                            src={msg.photoUrl}
                            alt="Attached chart"
                            className="w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-95"
                            onClick={() => setZoomedImage(msg.photoUrl || null)}
                          />
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImageToLocal(msg.photoUrl!, `chat_photo_${msg.id}.png`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-950/90 hover:bg-indigo-600 text-slate-200 text-[10px] font-mono flex items-center gap-1 shadow-lg transition-all border border-slate-800 hover:border-indigo-500"
                              title="Download Photo to Device"
                            >
                              <Download className="w-3 h-3 text-indigo-300" />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Audio Note player */}
                      {msg.audioUrl && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-center gap-3 max-w-xs">
                          <button
                            onClick={() =>
                              setPlayingAudioId(playingAudioId === msg.id ? null : msg.id)
                            }
                            className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-1 h-3">
                              {[30, 60, 40, 80, 50, 90, 70, 40, 60, 85, 30].map((h, i) => (
                                <div
                                  key={i}
                                  className={`w-1 rounded-full ${
                                    playingAudioId === msg.id ? "bg-indigo-400 animate-pulse" : "bg-slate-700"
                                  }`}
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] text-indigo-300 font-mono block mt-1">
                              {playingAudioId === msg.id ? "Playing audio..." : "Voice Analysis Note"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Composer Bar */}
          <div className="p-4 bg-slate-950/90 border-t border-slate-800">
            {chatError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center justify-between">
                <span>{chatError}</span>
                <button onClick={() => setChatError(null)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* If user CAN chat in this group */}
            {userChatStatus.allowed ? (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {/* Image attachment preview */}
                {photoAttachmentUrl && (
                  <div className="relative inline-block border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
                    <img
                      src={photoAttachmentUrl}
                      alt="Attachment"
                      className="h-16 w-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoAttachmentUrl("");
                        setShowPhotoInput(false);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-950/80 text-rose-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Voice recording in progress */}
                {isVoiceRecording ? (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-mono">
                      <Radio className="w-4 h-4 animate-ping" />
                      <span>Recording Voice Memo: {voiceSeconds}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCancelVoice}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleStopAndSendVoice}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Send Voice Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
                      title="Attach Chart Photo"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleStartVoiceRecording}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Record Voice Note"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsAnnouncementMode(!isAnnouncementMode)}
                        className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-1 transition-all ${
                          isAnnouncementMode
                            ? "bg-amber-600/30 border-amber-500 text-amber-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400"
                        }`}
                        title="Broadcast as Official Announcement"
                      >
                        <Megaphone className="w-4 h-4" />
                      </button>
                    )}

                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={
                        isAnnouncementMode
                          ? "Broadcast official group announcement..."
                          : isExplicitlyAllowed && group.adminOnlyChat
                          ? "Type message (You have granted permission)..."
                          : "Send a message or trade analysis to this group..."
                      }
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:border-indigo-500 focus:outline-none"
                    />

                    <button
                      type="submit"
                      disabled={!messageInput.trim() && !photoAttachmentUrl}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition-all shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </form>
            ) : isPendingUser(currentUser) ? (
              /* Pending user cannot chat anywhere */
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300 block">
                      Pending & Trial Account Restriction
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Pending users can view group chat messages & signals, but cannot send messages until approved by Host Admin.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGuidelinesOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono transition-all"
                >
                  View Terms
                </button>
              </div>
            ) : (
              /* User DOES NOT have chat permission (Admin-Only Talk Mode) */
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-200 block">
                      Admin-Only Talk Mode Enabled
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Only the Group Admin (@{group.adminUsername}) and members granted message permissions can text here.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRequestChatAccess}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono flex items-center gap-1.5 transition-all"
                >
                  <Key className="w-3.5 h-3.5" /> Request Messaging Access
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MEMBERS & PERMISSIONS MANAGER */}
      {/* ========================================================================= */}
      {activeTab === "members" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Group Members & Talk Permissions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Manage who is authorized to send messages and announcements in this group.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={handleQuickToggleAdminOnly}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border shadow-lg transition-all ${
                  group.adminOnlyChat
                    ? "bg-amber-950/40 border-amber-600/50 text-amber-300"
                    : "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
                }`}
              >
                {group.adminOnlyChat ? (
                  <>
                    <Lock className="w-4 h-4 text-amber-400" /> Mode: Admin-Only Talk
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-emerald-400" /> Mode: All Members Can Talk
                  </>
                )}
              </button>
            )}
          </div>

          {/* Mode Explanation Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-slate-400 block font-bold">1. Admin-Only Talk Mode</span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                When active, all standard members are in read-only mode to prevent spam. Only the Group Admin and members you explicitly whitelist below can post.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 block font-bold">2. Open Discussion Mode</span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                When active, all registered group members can freely text, share trading charts, and send voice analysis notes.
              </p>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Group Participants ({group.members.length})
            </h3>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
              {group.members.map((memberEmail) => {
                const isMemberAdmin =
                  memberEmail.toLowerCase() === group.adminEmail.toLowerCase() ||
                  memberEmail.toLowerCase() === "sngxworld@gmail.com";
                const isMemberWhitelisted = (group.allowedChatMembers || [])
                  .map((e) => e.toLowerCase())
                  .includes(memberEmail.toLowerCase());
                const canCurrentlyTalk = !group.adminOnlyChat || isMemberAdmin || isMemberWhitelisted;

                return (
                  <div
                    key={memberEmail}
                    className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-indigo-300">
                        {memberEmail.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200 font-mono">
                            {memberEmail.split("@")[0]}
                          </span>
                          {isMemberAdmin && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-mono font-bold">
                              ADMIN
                            </span>
                          )}
                          {isMemberWhitelisted && !isMemberAdmin && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> AUTHORIZED TO CHAT
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono block">
                          {memberEmail}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          canCurrentlyTalk
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {canCurrentlyTalk ? "Can Post Messages" : "Read-Only"}
                      </span>

                      {/* Admin Toggle Button for Individual Members */}
                      {isAdmin && !isMemberAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleMemberPermission(memberEmail)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                            isMemberWhitelisted
                              ? "bg-rose-950/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60"
                              : "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50"
                          }`}
                        >
                          {isMemberWhitelisted ? (
                            <>
                              <UserX className="w-3.5 h-3.5" /> Revoke Chat Access
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" /> Grant Chat Access
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS: VIP SETTINGS, ZOOM CHART, CREATE SIGNAL, GUIDELINES */}
      {/* ========================================================================= */}

      {/* VIP Subscription Settings Modal */}
      {isVipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">
                  VIP Monthly Subscription Settings
                </h3>
              </div>
              <button
                onClick={() => setIsVipModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVipSettings} className="p-5 space-y-4">
              {vipError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                  {vipError}
                </div>
              )}
              {vipSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                  {vipSuccess}
                </div>
              )}

              {/* Eligibility Check Callout */}
              {!isEligibleVip ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs font-mono text-amber-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-400" /> Paid Subscriptions Locked
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    VIP Monthly subscriptions can only be enabled after completing 30 closed trades with an audited 75%–85%+ win rate calculation.
                  </p>
                  <p className="text-[10px] text-slate-400 pt-1">
                    Current: {group.totalSignals}/30 trades • {group.winRate}% win rate
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>VIP Trader Status Verified! You are authorized to monetize your signal group.</span>
                </div>
              )}

              {/* Toggle Paid / Free */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block font-mono">
                    VIP Paid Membership
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Enable monthly subscription fee for new members
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!isEligibleVip}
                  onClick={() => setVipPaid(!vipPaid)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    vipPaid ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {vipPaid ? "PAID VIP" : "FREE"}
                </button>
              </div>

              {/* Price Input */}
              {vipPaid && (
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1 font-mono">
                    Monthly Price in USD ($) (Max Limit: $17.00 USD / 5000 LKR)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                    <input
                      type="number"
                      min="1"
                      max="17"
                      step="1"
                      value={vipPrice}
                      onChange={(e) => setVipPrice(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-emerald-300 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!isEligibleVip && vipPaid}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider font-mono shadow-lg shadow-indigo-600/30 transition-all"
              >
                Save Subscription Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Zoom Chart / Photo Modal with Local Download */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl flex flex-col w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> High-Resolution Photo Viewer
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageToLocal(zoomedImage, `sngx_chart_${Date.now()}.png`)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download to Device
                </button>
                <button
                  type="button"
                  onClick={() => setZoomedImage(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-60px)] flex items-center justify-center bg-slate-950 p-2">
              <img
                src={zoomedImage}
                alt="Zoomed Chart Analysis"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal (Host Admin & Group Admin) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base font-mono">
                  Delete Signal Group?
                </h3>
                <p className="text-xs text-rose-300/80 font-mono">
                  {isHost ? "Host Admin Master Authority" : "Group Admin Authority"}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white font-mono">{group.name}</strong> ({group.isVerified ? "Verified VIP" : "Free Community"})? All trade signals, history, and community group chats will be permanently deleted.
            </p>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-rose-600/30"
              >
                Confirm & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Give a Signal Modal */}
      {isCreateSignalOpen && (
        <CreateSignalModal
          group={group}
          currentUser={currentUser}
          isOpen={isCreateSignalOpen}
          onClose={() => setIsCreateSignalOpen(false)}
          onSignalCreated={() => refreshSignals()}
        />
      )}

      {/* Community Guidelines Modal */}
      {isGuidelinesOpen && (
        <CommunityGuidelinesModal
          isOpen={isGuidelinesOpen}
          onClose={() => setIsGuidelinesOpen(false)}
        />
      )}
    </div>
  );
};
