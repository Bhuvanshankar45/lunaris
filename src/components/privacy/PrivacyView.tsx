'use client';

import React, { useState } from 'react';
import {
  Shield,
  Smartphone,
  Ban,
  Trash2,
  AlertTriangle,
  FileText,
  Lock,
  Flag,
  CheckCircle2,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { DeleteAccountModal } from '../ui/Modals';

interface PrivacyViewProps {
  currentUser: UserProfile;
  blockedUsers: string[];
  onUnblockUser: (userId: string) => void;
  onClearLocalVault: () => void;
  onDeleteAccount: () => Promise<void>;
  onSubmitAbuseReport: (reportedId: string, category: string, notes: string) => Promise<void>;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({
  currentUser,
  blockedUsers,
  onUnblockUser,
  onClearLocalVault,
  onDeleteAccount,
  onSubmitAbuseReport,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportCategory, setReportCategory] = useState('spam');
  const [reportNotes, setReportNotes] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [vaultClearedAlert, setVaultClearedAlert] = useState(false);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetId.trim()) return;
    await onSubmitAbuseReport(reportTargetId.trim(), reportCategory, reportNotes);
    setReportSuccess(true);
    setReportTargetId('');
    setReportNotes('');
    setTimeout(() => setReportSuccess(false), 3000);
  };

  const handleVaultWipe = () => {
    if (
      confirm(
        'Are you sure you want to shred all local encrypted caches and session keys on this device? You will remain signed in, but local message history will be permanently deleted.'
      )
    ) {
      onClearLocalVault();
      setVaultClearedAlert(true);
      setTimeout(() => setVaultClearedAlert(false), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-xl bg-[#525C51] text-[#F8F8F4]">
            <Shield className="w-5 h-5 text-[#CBCCC7]" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1C1E1B]">Privacy & Security Sanctuary</h1>
        </div>
        <p className="text-xs text-[#4A4E47] max-w-2xl leading-relaxed">
          Lunaris minimizes metadata collection strictly to the minimum required to authenticate sessions, prevent abuse, and route encrypted packets.
        </p>
      </div>

      {/* SECTION 1: Transparent Privacy Architecture & Technical Model */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-[#1C1E1B] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#525C51]" />
          <span>Verifiable Privacy Architecture & Data Retention Policy</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7]">
            <h3 className="font-semibold text-[#1C1E1B] mb-1">What Is Temporarily Processed</h3>
            <ul className="list-disc pl-4 space-y-1 text-[#4A4E47]">
              <li>
                <strong>Ephemeral Relay Packets:</strong> Held in memory for offline delivery with a strict 10-minute maximum TTL. Shredded upon receipt or expiry.
              </li>
              <li>
                <strong>Public Key Prekey Bundles:</strong> Necessary for peers to initiate X3DH cryptographic key agreements without server assistance.
              </li>
              <li>
                <strong>Connection Pairings:</strong> Accepted ID pairs to enforce mutual consent before routing packets.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7]">
            <h3 className="font-semibold text-[#1C1E1B] mb-1">What Is NEVER Stored or Processed</h3>
            <ul className="list-disc pl-4 space-y-1 text-[#4A4E47]">
              <li>
                <strong>Plaintext Message Bodies:</strong> Encrypted on sender device; decrypted only on recipient device.
              </li>
              <li>
                <strong>Media, Audio, & File Contents:</strong> Encrypted client-side with AES-GCM before relay.
              </li>
              <li>
                <strong>Call Audio/Video:</strong> Flows peer-to-peer via DTLS-SRTP. Zero recording or transcripts.
              </li>
              <li>
                <strong>Cloud Backups & Analytics:</strong> No message archives, no Google Analytics, no tracking SDKs.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* SECTION 2: Active Devices Management */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#525C51]" />
            <h2 className="text-sm font-bold text-[#1C1E1B]">Signed-In Devices</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#D0CABA] text-[#1C1E1B]">
            {currentUser.devices?.length || 1} Device Active
          </span>
        </div>

        <div className="space-y-2">
          {(currentUser.devices || [{ id: 'dev_1', name: 'Current Browser Session', lastActive: Date.now() }]).map(
            (dev) => (
              <div
                key={dev.id}
                className="p-3.5 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7] flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-[#1C1E1B]">{dev.name}</p>
                  <p className="text-[11px] text-[#6E746A]">
                    Last active: {new Date(dev.lastActive).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-[#476B4D] bg-[#DCE5DD] px-2 py-0.5 rounded-full">
                  This Device (Secure)
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* SECTION 3: Trust & Safety (Abuse Reporting without Content) */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-[#525C51]" />
          <h2 className="text-sm font-bold text-[#1C1E1B]">Report Misconduct or Abuse</h2>
        </div>
        <p className="text-xs text-[#4A4E47]">
          To preserve zero-knowledge principles, abuse reports do not transmit message logs or call recordings. Reports register metadata flags for operator review.
        </p>

        <form onSubmit={handleReport} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-target" className="block text-xs font-medium text-[#1C1E1B] mb-1">
                Target User ID
              </label>
              <input
                id="report-target"
                type="text"
                placeholder="e.g. ID:CSDX2007"
                value={reportTargetId}
                onChange={(e) => setReportTargetId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs font-mono text-[#1C1E1B] outline-hidden focus:border-[#525C51]"
                required
              />
            </div>

            <div>
              <label htmlFor="report-category" className="block text-xs font-medium text-[#1C1E1B] mb-1">
                Category
              </label>
              <select
                id="report-category"
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs text-[#1C1E1B] outline-hidden focus:border-[#525C51]"
              >
                <option value="spam">Spam / Excessive Connection Requests</option>
                <option value="harassment">Harassment</option>
                <option value="impersonation">Impersonation</option>
                <option value="malicious">Suspected Malicious Activity</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="report-notes" className="block text-xs font-medium text-[#1C1E1B] mb-1">
              Context Notes (Do not include private personal info)
            </label>
            <input
              id="report-notes"
              type="text"
              placeholder="Brief summary of conduct..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs text-[#1C1E1B] outline-hidden focus:border-[#525C51]"
            />
          </div>

          {reportSuccess && (
            <div className="p-2.5 rounded-xl bg-[#DCE5DD] text-[#476B4D] text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Report filed securely without collecting any message content.</span>
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42] transition-colors"
          >
            Submit Safety Report
          </button>
        </form>
      </div>

      {/* SECTION 4: Blocked Users Management */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-[#8E4B4B]" />
          <h2 className="text-sm font-bold text-[#1C1E1B]">Blocked Users ({blockedUsers.length})</h2>
        </div>

        {blockedUsers.length === 0 ? (
          <p className="text-xs text-[#6E746A]">No users are currently blocked.</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((userId) => (
              <div
                key={userId}
                className="p-3 rounded-xl bg-[#F2F2EB] border border-[#CBCCC7] flex items-center justify-between"
              >
                <span className="font-mono text-xs font-semibold text-[#1C1E1B]">{userId}</span>
                <button
                  onClick={() => onUnblockUser(userId)}
                  className="px-3 py-1 rounded-lg border border-[#B8AB90] text-xs hover:bg-[#D0CABA] text-[#1C1E1B]"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 5: Cryptographic Shredding & Destruction */}
      <div className="p-6 rounded-3xl bg-[#EBDADA]/60 border border-[#8E4B4B] shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-[#8E4B4B]">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-sm font-bold">Cryptographic Shredding & Account Destruction</h2>
        </div>
        <p className="text-xs text-[#4A4E47] leading-relaxed">
          Because Lunaris uses true zero-knowledge encryption, you retain sovereign ownership of your keys. You can locally wipe cached data or permanently delete your account across the network.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleVaultWipe}
            className="px-4 py-2.5 rounded-xl border border-[#8E4B4B] bg-white text-[#8E4B4B] text-xs font-semibold hover:bg-[#EBDADA] transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Shred Local Cached Vault</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#8E4B4B] text-[#F8F8F4] text-xs font-semibold hover:bg-[#783D3D] transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Permanently Delete Account</span>
          </button>
        </div>

        {vaultClearedAlert && (
          <div className="p-2.5 rounded-xl bg-[#DCE5DD] text-[#476B4D] text-xs font-medium">
            Local encrypted vault, cached files, and session keys permanently shredded.
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={onDeleteAccount}
      />
    </div>
  );
};
