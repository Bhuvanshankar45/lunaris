'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  MessageSquare,
  Users,
  Video,
  Lock,
  Copy,
  Check,
  UserPlus,
  ArrowRight,
  Shield,
  KeyRound,
  Trash2,
  Phone,
} from 'lucide-react';
import { AppScreen, PeerContact, UserProfile } from '@/types';
import { Avatar } from '../ui/Avatar';

interface DashboardViewProps {
  currentUser: UserProfile;
  acceptedConnections: { connectionId: string; peer: PeerContact }[];
  incomingRequests: { connectionId: string; peer: PeerContact }[];
  onNavigate: (screen: AppScreen) => void;
  onStartChat: (peer: PeerContact) => void;
  onOpenAddConnection: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  acceptedConnections,
  incomingRequests,
  onNavigate,
  onStartChat,
  onOpenAddConnection,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.personalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Banner: Sovereign Identity Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <Avatar name={currentUser.displayName} size="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1E1B]">
                  Welcome, {currentUser.displayName}
                </h1>
                <span className="p-1 rounded-full bg-[#DCE5DD] text-[#476B4D]" title="Cryptographically active">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xs text-[#4A4E47] mt-0.5">
                {currentUser.bio || 'Zero-Knowledge Sovereign Identity Active'}
              </p>

              {/* Immutable ID Pill */}
              <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-[#D0CABA] border border-[#B8AB90]">
                <span className="text-[11px] font-medium text-[#4A4E47]">Shareable ID:</span>
                <span className="font-mono text-xs font-bold text-[#1C1E1B]">{currentUser.personalId}</span>
                <button
                  onClick={handleCopyId}
                  className="p-1 rounded-md text-[#4A4E47] hover:text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                  title="Copy ID"
                  aria-label="Copy personal ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#476B4D]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenAddConnection}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42] transition-colors shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add by ID</span>
            </button>

            <button
              onClick={() => onNavigate('call-lobby')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D0CABA] text-[#1C1E1B] text-xs font-semibold hover:bg-[#CBCCC7] border border-[#B8AB90] transition-colors"
            >
              <Video className="w-4 h-4 text-[#525C51]" />
              <span>Start Meet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Incoming Requests Attention Banner */}
      {incomingRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#D0CABA] border border-[#B8AB90] flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#8E4B4B] text-[#F8F8F4]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#1C1E1B]">
                {incomingRequests.length === 1
                  ? `${incomingRequests[0].peer.displayName || 'A contact'} wants to connect`
                  : `${incomingRequests.length} Incoming Connection Requests`}
              </p>
              <p className="text-[11px] text-[#4A4E47]">
                Pending review. Messaging is strictly locked until you approve.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('connections')}
            className="px-4 py-1.5 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42] whitespace-nowrap"
          >
            Review Requests
          </button>
        </div>
      )}

      {/* Main Grid: Quick Actions & Connected Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Connected Contacts & Recent Chats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1C1E1B] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#525C51]" />
              <span>Secure Conversations ({acceptedConnections.length})</span>
            </h2>
            <button
              onClick={() => onNavigate('connections')}
              className="text-xs font-medium text-[#525C51] hover:underline flex items-center gap-1"
            >
              <span>Manage all contacts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {acceptedConnections.length === 0 ? (
            <div className="p-8 text-center bg-[#E0E0D5] rounded-3xl border border-[#CBCCC7]">
              <Lock className="w-8 h-8 text-[#B8AB90] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1C1E1B]">No Active Contacts Yet</p>
              <p className="text-xs text-[#4A4E47] mt-1 mb-4">
                Share your ID ({currentUser.personalId}) or add a friend&apos;s ID to unlock encrypted chats.
              </p>
              <button
                onClick={onOpenAddConnection}
                className="px-4 py-2 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-medium hover:bg-[#434B42]"
              >
                Enter Peer ID
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {acceptedConnections.map(({ connectionId, peer }) => {
                const displayName = peer.nickname || peer.displayName;
                return (
                  <div
                    key={connectionId}
                    className="p-4 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] hover:border-[#B8AB90] transition-colors flex flex-col justify-between shadow-2xs"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar name={displayName} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-semibold text-xs sm:text-sm text-[#1C1E1B] truncate">{displayName}</h4>
                          {peer.nickname && (
                            <span className="text-[10px] text-[#6E746A] truncate">({peer.displayName})</span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-[#6E746A]">{peer.personalId}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#CBCCC7]/60">
                      <button
                        onClick={() => onStartChat(peer)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-[#D0CABA] hover:bg-[#CBCCC7] text-xs font-medium text-[#1C1E1B] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#525C51]" />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Privacy Architecture Metrics */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-[#1C1E1B] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#525C51]" />
            <span>Cryptographic Guarantees</span>
          </h2>

          <div className="p-5 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] space-y-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#D0CABA] text-[#476B4D]">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C1E1B]">Signal Protocol Ratchet</p>
                <p className="text-[11px] text-[#4A4E47] leading-relaxed">
                  Ephemeral symmetric key generated for every message payload.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#D0CABA] text-[#525C51]">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C1E1B]">10-Min Relay Expiry</p>
                <p className="text-[11px] text-[#4A4E47] leading-relaxed">
                  Queued transit packets automatically shredded upon delivery or after 600 seconds.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#D0CABA] text-[#525C51]">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C1E1B]">DTLS-SRTP Calls</p>
                <p className="text-[11px] text-[#4A4E47] leading-relaxed">
                  Peer-to-peer live media stream encryption with zero server recording.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
