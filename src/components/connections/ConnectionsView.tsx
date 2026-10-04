'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Check,
  X,
  Ban,
  MessageSquare,
  Phone,
  Video,
  Clock,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { PeerContact } from '@/types';

interface ConnectionsViewProps {
  currentUserId: string;
  accepted: { connectionId: string; peer: PeerContact; updatedAt?: number }[];
  incoming: { connectionId: string; peer: PeerContact; createdAt?: number }[];
  outgoing: { connectionId: string; peer: PeerContact; createdAt?: number }[];
  blocked: { connectionId: string; peer: PeerContact }[];
  onOpenSendModal: () => void;
  onRespondRequest: (peerId: string, action: 'accept' | 'reject' | 'block') => Promise<void>;
  onStartChat: (peer: PeerContact) => void;
  onStartCall: (peer: PeerContact, mode: 'voice-1to1' | 'video-1to1') => void;
  onViewSafetyNumber: (peer: PeerContact) => void;
  onRemoveConnection: (peerId: string) => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  currentUserId,
  accepted,
  incoming,
  outgoing,
  blocked,
  onOpenSendModal,
  onRespondRequest,
  onStartChat,
  onStartCall,
  onViewSafetyNumber,
  onRemoveConnection,
}) => {
  const [activeTab, setActiveTab] = useState<'accepted' | 'incoming' | 'outgoing' | 'blocked'>('accepted');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAccepted = accepted.filter(
    (c) =>
      c.peer.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.peer.personalId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1E1B] tracking-tight">Private Connections</h1>
          <p className="text-xs text-[#4A4E47] mt-0.5">
            Communication is strictly restricted to mutually verified contacts.
          </p>
        </div>

        <button
          onClick={onOpenSendModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42] transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Connection by ID</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#CBCCC7] mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('accepted')}
          className={`flex items-center gap-2 py-2 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'accepted'
              ? 'border-[#525C51] text-[#1C1E1B]'
              : 'border-transparent text-[#6E746A] hover:text-[#1C1E1B]'
          }`}
        >
          <span>Connected</span>
          <span className="py-0.5 px-2 rounded-full bg-[#D0CABA] text-[10px] text-[#1C1E1B]">
            {accepted.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center gap-2 py-2 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors relative ${
            activeTab === 'incoming'
              ? 'border-[#525C51] text-[#1C1E1B]'
              : 'border-transparent text-[#6E746A] hover:text-[#1C1E1B]'
          }`}
        >
          <span>Incoming Requests</span>
          {incoming.length > 0 && (
            <span className="py-0.5 px-2 rounded-full bg-[#8E4B4B] text-[10px] text-[#F8F8F4] font-bold">
              {incoming.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex items-center gap-2 py-2 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'outgoing'
              ? 'border-[#525C51] text-[#1C1E1B]'
              : 'border-transparent text-[#6E746A] hover:text-[#1C1E1B]'
          }`}
        >
          <span>Outgoing Sent</span>
          <span className="py-0.5 px-2 rounded-full bg-[#D0CABA] text-[10px] text-[#1C1E1B]">
            {outgoing.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('blocked')}
          className={`flex items-center gap-2 py-2 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'blocked'
              ? 'border-[#525C51] text-[#1C1E1B]'
              : 'border-transparent text-[#6E746A] hover:text-[#1C1E1B]'
          }`}
        >
          <span>Blocked</span>
          <span className="py-0.5 px-2 rounded-full bg-[#D0CABA] text-[10px] text-[#1C1E1B]">
            {blocked.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Accepted Connections */}
      {activeTab === 'accepted' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6E746A]" />
            <input
              type="text"
              placeholder="Search contacts by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs text-[#1C1E1B] placeholder:text-[#6E746A] outline-hidden focus:border-[#525C51]"
            />
          </div>

          {filteredAccepted.length === 0 ? (
            <div className="text-center py-16 px-4 bg-[#E0E0D5] rounded-2xl border border-[#CBCCC7]">
              <Users className="w-10 h-10 text-[#6E746A] mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-[#1C1E1B]">No Connections Found</h3>
              <p className="text-xs text-[#4A4E47] max-w-sm mx-auto mt-1 mb-4">
                You have no connected contacts matching your filter. Use &quot;Add Connection by ID&quot; to connect with peers.
              </p>
              <button
                onClick={onOpenSendModal}
                className="py-2 px-4 rounded-xl text-xs font-medium bg-[#525C51] text-[#F8F8F4] hover:bg-[#434B42]"
              >
                Send Connection Request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredAccepted.map(({ connectionId, peer }) => (
                <div
                  key={connectionId}
                  className="p-4 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] hover:border-[#B8AB90] transition-colors flex flex-col justify-between shadow-2xs"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={peer.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-[#1C1E1B] truncate">{peer.displayName}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#D0CABA] text-[#1C1E1B] border border-[#B8AB90]">
                          {peer.personalId}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A4E47] truncate mt-0.5">{peer.bio || 'Private Lunaris peer'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#CBCCC7]/60">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onStartChat(peer)}
                        className="p-2 rounded-xl bg-[#D0CABA] hover:bg-[#CBCCC7] text-[#1C1E1B] text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Open End-to-End Encrypted Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#525C51]" />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={() => onStartCall(peer, 'voice-1to1')}
                        className="p-2 rounded-xl bg-[#D0CABA] hover:bg-[#CBCCC7] text-[#1C1E1B] text-xs transition-colors"
                        title="Start Private Voice Call"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#525C51]" />
                      </button>

                      <button
                        onClick={() => onStartCall(peer, 'video-1to1')}
                        className="p-2 rounded-xl bg-[#D0CABA] hover:bg-[#CBCCC7] text-[#1C1E1B] text-xs transition-colors"
                        title="Start Private Video Call"
                      >
                        <Video className="w-3.5 h-3.5 text-[#525C51]" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onViewSafetyNumber(peer)}
                        className="p-1.5 rounded-lg text-[#4A4E47] hover:text-[#1C1E1B] hover:bg-[#CBCCC7]"
                        title="Inspect Safety Number"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#476B4D]" />
                      </button>

                      <button
                        onClick={() => onRemoveConnection(peer.personalId)}
                        className="p-1.5 rounded-lg text-[#6E746A] hover:text-[#8E4B4B] hover:bg-[#EBDADA]"
                        title="Remove Connection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Incoming Requests */}
      {activeTab === 'incoming' && (
        <div className="space-y-4">
          <p className="text-xs text-[#4A4E47]">
            These users entered your exact ID to request a secure connection. Messaging and calls are only enabled after you accept.
          </p>

          {incoming.length === 0 ? (
            <div className="text-center py-14 px-4 bg-[#E0E0D5] rounded-2xl border border-[#CBCCC7]">
              <ShieldCheck className="w-10 h-10 text-[#6E746A] mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-[#1C1E1B]">No Pending Incoming Requests</h3>
              <p className="text-xs text-[#4A4E47] mt-1">Share your immutable ID with contacts you trust.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incoming.map(({ connectionId, peer }) => (
                <div
                  key={connectionId}
                  className="p-4 rounded-2xl bg-[#E0E0D5] border border-[#B8AB90] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={peer.displayName} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-[#1C1E1B]">{peer.displayName}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#D0CABA] text-[#1C1E1B]">
                          {peer.personalId}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A4E47] mt-0.5">{peer.bio || 'Wants to connect securely on Lunaris'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onRespondRequest(peer.personalId, 'accept')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42] flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5 text-[#CBCCC7]" />
                      <span>Accept</span>
                    </button>

                    <button
                      onClick={() => onRespondRequest(peer.personalId, 'reject')}
                      className="px-3 py-1.5 rounded-xl bg-[#D0CABA] text-[#1C1E1B] text-xs font-medium hover:bg-[#CBCCC7] flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => onRespondRequest(peer.personalId, 'block')}
                      className="p-2 rounded-xl text-[#8E4B4B] hover:bg-[#EBDADA] text-xs transition-colors"
                      title="Block User"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Outgoing Pending Requests */}
      {activeTab === 'outgoing' && (
        <div className="space-y-4">
          <p className="text-xs text-[#4A4E47]">
            Requests you have sent. To maintain strict privacy, messaging remains locked until the recipient accepts.
          </p>

          {outgoing.length === 0 ? (
            <div className="text-center py-14 px-4 bg-[#E0E0D5] rounded-2xl border border-[#CBCCC7]">
              <Clock className="w-10 h-10 text-[#6E746A] mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-[#1C1E1B]">No Outgoing Requests Pending</h3>
              <p className="text-xs text-[#4A4E47] mt-1">All requests have been answered or none sent.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outgoing.map(({ connectionId, peer }) => (
                <div
                  key={connectionId}
                  className="p-4 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={peer.displayName} size="sm" />
                    <div>
                      <p className="font-semibold text-xs text-[#1C1E1B]">{peer.displayName}</p>
                      <p className="font-mono text-[10px] text-[#6E746A]">{peer.personalId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6E746A] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#B8AB90]" />
                      <span>Awaiting Acceptance</span>
                    </span>
                    <button
                      onClick={() => onRemoveConnection(peer.personalId)}
                      className="px-2.5 py-1 text-[11px] rounded-lg border border-[#B8AB90] hover:bg-[#D0CABA] text-[#6E746A]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Blocked Users */}
      {activeTab === 'blocked' && (
        <div className="space-y-4">
          <p className="text-xs text-[#4A4E47]">
            Blocked contacts cannot send you connection requests, packets, or call invites.
          </p>

          {blocked.length === 0 ? (
            <div className="text-center py-14 px-4 bg-[#E0E0D5] rounded-2xl border border-[#CBCCC7]">
              <Ban className="w-10 h-10 text-[#6E746A] mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-[#1C1E1B]">No Blocked Users</h3>
              <p className="text-xs text-[#4A4E47] mt-1">Your blocklist is clean.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocked.map(({ connectionId, peer }) => (
                <div
                  key={connectionId}
                  className="p-3.5 rounded-xl bg-[#E0E0D5] border border-[#CBCCC7] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={peer.displayName} size="sm" />
                    <div>
                      <p className="font-medium text-xs text-[#1C1E1B]">{peer.displayName}</p>
                      <p className="font-mono text-[10px] text-[#6E746A]">{peer.personalId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRespondRequest(peer.personalId, 'reject')}
                    className="px-3 py-1 text-xs rounded-lg border border-[#B8AB90] text-[#1C1E1B] hover:bg-[#D0CABA]"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
