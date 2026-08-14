import React, { useState, useRef } from "react";
import { UserProfile, SignalGroup } from "../types";
import { createSignalGroup } from "../lib/communityStore";
import { isPendingUser } from "../utils/roleUtils";
import { X, Plus, Shield, Users, Lock, Share2, Copy, Check, Info, Upload, Image as ImageIcon, Sparkles, Award, AlertTriangle } from "lucide-react";

interface CreateGroupModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: SignalGroup) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hideMembers, setHideMembers] = useState(false);
  const [adminOnlyChat, setAdminOnlyChat] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("Image file size must be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setLogoUrl(reader.result);
          setErrorMessage(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const res = createSignalGroup(currentUser, {
      name,
      description,
      logoUrl,
      hideMembers,
      adminOnlyChat,
      allowMemberChat: !adminOnlyChat,
    });

    if (!res.success || !res.group) {
      setErrorMessage(res.error || "Failed to create group.");
      return;
    }

    onGroupCreated(res.group);
    onClose();
  };

  const inviteLink = `${window.location.origin}/join/${name ? encodeURIComponent(name) : "signals"}`;

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono">
                Create a Signal Group
              </h2>
              <p className="text-xs text-slate-400">
                Launch your real trader signal group (Starts Free)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-5">
          {isPendingUser(currentUser) && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-300">Creation Restricted:</strong>
                Pending & Trial users cannot create signal groups until account approval by Host Admin.
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              {errorMessage}
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Group Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Alpha Signals"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none font-mono"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Group Strategy & Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Describe your signal strategy, target coins, timeframes, and risk rules..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none resize-none font-sans"
            />
          </div>

          {/* Uploadable Group Logo Picture */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              Group Logo (Upload Picture)
            </label>
            
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {logoUrl ? (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="w-14 h-14 rounded-xl border border-indigo-500/40 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                  <img src={logoUrl} alt="Group Logo Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-emerald-400 font-mono flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Logo Picture Uploaded
                  </span>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                    Custom group avatar active
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-mono transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Remove logo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-300 block font-mono">
                    Click or drop image to upload group logo
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    PNG, JPG, WEBP (Max 5MB)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Subscription & VIP Policy Notice */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200 font-mono">
                Performance-Based VIP Subscription Policy
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All newly created signal groups start as <strong className="text-indigo-300">100% Free</strong>. Monthly paid VIP subscriptions (<span className="text-emerald-400 font-mono">$ USD</span>) are restricted and only unlocked for VIP traders once you complete <strong className="text-amber-300">30 trades</strong> with an audited <strong className="text-emerald-400">75%–85%+ win rate</strong> calculation (or chosen by Host Admin).
            </p>
            <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-indigo-400">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">Initial Status: Free Group</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Max VIP Price: $17 USD</span>
            </div>
          </div>

          {/* Chat Mode Setting: Admin-Only Talk vs Open Member Chat */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 block font-mono">
                Group Chat Discussion Mode
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {adminOnlyChat
                  ? "Admin-Only: Only group admin & authorized members can send messages"
                  : "Open Discussion: All members can send messages, photos, and voice notes"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAdminOnlyChat(!adminOnlyChat)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                adminOnlyChat
                  ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                  : "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              {adminOnlyChat ? (
                <>
                  <Lock className="w-3 h-3" /> ADMIN ONLY
                </>
              ) : (
                <>
                  <Users className="w-3 h-3" /> ALL MEMBERS
                </>
              )}
            </button>
          </div>

          {/* Privacy & Member Visibility */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 block font-mono">
                Hide Member List (Privacy)
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Prevent members from viewing other member contacts
              </span>
            </div>
            <button
              type="button"
              onClick={() => setHideMembers(!hideMembers)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                hideMembers
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {hideMembers ? "HIDDEN" : "VISIBLE"}
            </button>
          </div>

          {/* Share & Invite Links (Slide 9) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-indigo-400" /> Share & Invite Members
              </span>
              <button
                type="button"
                onClick={copyInvite}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-400">
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">WhatsApp</span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">TikTok</span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">Instagram</span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">Twitter/X</span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">Telegram</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPendingUser(currentUser)}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all font-mono"
          >
            <Plus className="w-4 h-4" /> {isPendingUser(currentUser) ? "Locked for Pending Accounts" : "Create Signal Group"}
          </button>
        </form>
      </div>
    </div>
  );
};
