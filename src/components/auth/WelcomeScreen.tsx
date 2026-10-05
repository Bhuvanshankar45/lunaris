'use client';

import React from 'react';
import {
  ShieldCheck,
  Lock,
  MessageSquare,
  Video,
  KeyRound,
  Trash2,
  EyeOff,
  Radio,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

import { UserProfile } from '@/types';
import { vault } from '@/lib/storage/vault';

interface WelcomeScreenProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSelectAccount?: (user: UserProfile) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenAuth,
  onSelectAccount,
}) => {
  const [savedAccounts, setSavedAccounts] = React.useState<UserProfile[]>([]);

  React.useEffect(() => {
    setSavedAccounts(vault.getSavedAccounts());
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto pt-6 pb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D0CABA] border border-[#B8AB90] text-[#1C1E1B] text-xs font-medium mb-6 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-[#476B4D]" />
          <span>True Zero-Knowledge Real-Time Messaging & Calling</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-[#1C1E1B] tracking-tight mb-6">
          Private by Design. <br />
          <span className="font-sans font-normal text-[#525C51]">Ephemeral by Default.</span>
        </h1>

        <p className="text-base sm:text-lg text-[#4A4E47] leading-relaxed mb-6 max-w-2xl mx-auto">
          Lunaris pairs WhatsApp&apos;s fluid direct messaging with Google Meet&apos;s effortless group video rooms. Built strictly upon proven Signal Protocol-compatible ratcheting and DTLS-SRTP WebRTC media transport.
        </p>

        {/* Saved Accounts on this Device */}
        {savedAccounts.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-[#E0E0D5] border-2 border-[#8EBA94] text-left max-w-md mx-auto shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#1C1E1B] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#476B4D]" />
                Saved Accounts on this Device
              </span>
              <span className="text-[10px] text-[#4A4E47] font-mono">Permanent ID</span>
            </div>
            <div className="space-y-2">
              {savedAccounts.map((account) => (
                <div
                  key={account.personalId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F8F4] border border-[#CBCCC7] hover:border-[#8EBA94] transition-all"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-[#525C51] text-[#F8F8F4] flex items-center justify-center font-bold text-xs shrink-0">
                      {account.displayName ? account.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-[#1C1E1B] truncate">{account.displayName}</p>
                      <p className="text-[11px] font-mono text-[#525C51] font-bold">{account.personalId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onSelectAccount) {
                        onSelectAccount(account);
                      } else {
                        vault.saveCurrentUser(account);
                        window.location.reload();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#525C51] hover:bg-[#434B42] text-[#F8F8F4] text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-3">
          <button
            onClick={() => onOpenAuth('register')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#525C51] text-[#F8F8F4] text-sm font-semibold hover:bg-[#434B42] transition-all shadow-sm hover:scale-[1.02]"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onOpenAuth('login')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#D0CABA] text-[#1C1E1B] text-sm font-semibold hover:bg-[#CBCCC7] border border-[#B8AB90] transition-all"
          >
            <span>Sign In with Existing ID</span>
          </button>
        </div>

        <p className="text-[11px] text-[#6E746A] flex items-center justify-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#476B4D]" />
          <span>Each account has one immutable ID. To keep your ID, choose <strong>Sign In</strong> instead of registering a new account.</span>
        </p>
      </div>

      {/* 4 Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-8">
        <div className="p-5 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#D0CABA] text-[#525C51] flex items-center justify-center mb-4">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-sm text-[#1C1E1B] mb-1.5">Double Ratchet Forward Secrecy</h2>
          <p className="text-xs text-[#4A4E47] leading-relaxed">
            Every direct message generates an ephemeral AES-GCM-256 key. Past keys cannot decrypt future messages; future keys cannot expose history.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#D0CABA] text-[#525C51] flex items-center justify-center mb-4">
            <Radio className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-sm text-[#1C1E1B] mb-1.5">10-Minute Relay TTL</h2>
          <p className="text-xs text-[#4A4E47] leading-relaxed">
            The server only temporarily buffers opaque ciphertexts for offline delivery. Packets are permanently shredded upon receipt or after 10 minutes.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#D0CABA] text-[#525C51] flex items-center justify-center mb-4">
            <Trash2 className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-sm text-[#1C1E1B] mb-1.5">Zero Cloud Backups</h2>
          <p className="text-xs text-[#4A4E47] leading-relaxed">
            Your decrypted chat exists only in local device memory. Clearing a chat permanently destroys the local database and session keys.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#D0CABA] text-[#525C51] flex items-center justify-center mb-4">
            <Video className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-sm text-[#1C1E1B] mb-1.5">Private Meet Video Grid</h2>
          <p className="text-xs text-[#4A4E47] leading-relaxed">
            Google Meet-style group video calling with active-speaker spotlight, DTLS-SRTP media encryption, zero recordings, and zero server transcripts.
          </p>
        </div>
      </div>

      {/* Conservative Privacy Commitment Note */}
      <div className="mt-8 p-4 rounded-2xl bg-[#D0CABA]/40 border border-[#B8AB90] flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#525C51] shrink-0 mt-0.5" />
        <p className="text-xs text-[#4A4E47] leading-relaxed">
          <strong className="text-[#1C1E1B]">Technically Verifiable Privacy:</strong> Lunaris does not make vague marketing claims of &quot;total invisibility.&quot; Minimal non-content records (your public key bundle, immutable personal ID, and accepted connection pairings) are retained solely to route encrypted traffic. Message contents, call audio, and video streams never touch our disks in plaintext.
        </p>
      </div>
    </div>
  );
};
