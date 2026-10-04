'use client';

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, UserPlus, X, Copy, Check, QrCode } from 'lucide-react';
import { isValidPersonalId, normalizePersonalId } from '@/lib/crypto/id-generator';

// --- Safety Number Modal ---
interface SafetyNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  peerId: string;
  peerName: string;
  safetyNumber: string;
  isVerified: boolean;
  onToggleVerify: (verified: boolean) => void;
}

export const SafetyNumberModal: React.FC<SafetyNumberModalProps> = ({
  isOpen,
  onClose,
  peerId,
  peerName,
  safetyNumber,
  isVerified,
  onToggleVerify,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-number-title"
    >
      <div className="bg-[#E0E0D5] text-[#1C1E1B] border border-[#B8AB90] rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#4A4E47] hover:bg-[#CBCCC7] transition-colors"
          aria-label="Close safety number modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-[#D0CABA] text-[#476B4D]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 id="safety-number-title" className="font-semibold text-lg text-[#1C1E1B]">
              Verify Safety Number
            </h3>
            <p className="text-xs text-[#4A4E47]">Comparing cryptographic keys with {peerName}</p>
          </div>
        </div>

        <p className="text-xs text-[#4A4E47] leading-relaxed mb-4">
          Compare this 60-digit number with {peerName}&apos;s device to verify your end-to-end encryption. If they match, no third party can intercept or modify your communications.
        </p>

        {/* 60-digit safety number grid */}
        <div className="bg-[#F2F2EB] p-4 rounded-xl border border-[#CBCCC7] mb-4">
          <div className="font-mono text-center tracking-widest text-sm font-semibold text-[#1C1E1B] leading-relaxed select-all">
            {safetyNumber || '01234 56789 12345 67890 12345 67890 12345 67890 12345 67890 12345 67890'}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            onClick={handleCopy}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[#B8AB90] bg-[#E0E0D5] hover:bg-[#D0CABA] text-xs font-medium text-[#1C1E1B] transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-[#476B4D]" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied code' : 'Copy 60 digits'}</span>
          </button>

          <button
            onClick={() => onToggleVerify(!isVerified)}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
              isVerified
                ? 'bg-[#476B4D] text-[#F8F8F4] hover:bg-[#3B5A40]'
                : 'bg-[#525C51] text-[#F8F8F4] hover:bg-[#434B42]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isVerified ? 'Verified ✓' : 'Mark as Verified'}</span>
          </button>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-[#6E746A]">
            Safety numbers change only if {peerName} reinstalls Lunaris or switches devices.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Clear Chat Modal ---
interface ClearChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  peerName: string;
}

export const ClearChatModal: React.FC<ClearChatModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  peerName,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-chat-title"
    >
      <div className="bg-[#E0E0D5] text-[#1C1E1B] border border-[#B8AB90] rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-[#EBDADA] text-[#8E4B4B]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 id="clear-chat-title" className="font-semibold text-lg text-[#1C1E1B]">
              Clear Chat with {peerName}?
            </h3>
            <p className="text-xs text-[#8E4B4B] font-medium">Permanent cryptographic deletion</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-[#4A4E47] mb-6 bg-[#F2F2EB] p-3.5 rounded-xl border border-[#CBCCC7]">
          <p className="font-medium text-[#1C1E1B]">This action will immediately and irreversibly:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Permanently delete the local encrypted message history from this device.</li>
            <li>Destroy associated session ratchet keys for this conversation.</li>
            <li>Delete all cached thumbnails, media files, and audio notes.</li>
            <li>Purge any queued transit packets between you and {peerName} on the relay.</li>
          </ul>
          <p className="text-[11px] text-[#6E746A] pt-1">
            Because Lunaris maintains zero cloud backups, deleted messages can never be recovered.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-[#B8AB90] hover:bg-[#D0CABA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#8E4B4B] text-[#F8F8F4] hover:bg-[#783D3D] transition-colors"
          >
            Permanently Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Send Connection Request Modal ---
interface SendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (targetId: string) => Promise<{ success: boolean; message: string }>;
}

export const SendRequestModal: React.FC<SendRequestModalProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const normalized = normalizePersonalId(targetId);
    if (!isValidPersonalId(normalized)) {
      setError('Invalid ID format. Must match ID:CSDX2007');
      return;
    }

    setLoading(true);
    try {
      const res = await onSend(normalized);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          setTargetId('');
          setSuccessMsg(null);
          onClose();
        }, 1500);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-request-title"
    >
      <div className="bg-[#E0E0D5] text-[#1C1E1B] border border-[#B8AB90] rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#4A4E47] hover:bg-[#CBCCC7] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-[#D0CABA] text-[#525C51]">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 id="send-request-title" className="font-semibold text-lg text-[#1C1E1B]">
              Add Secure Connection
            </h3>
            <p className="text-xs text-[#4A4E47]">Enter their unique immutable ID</p>
          </div>
        </div>

        <p className="text-xs text-[#4A4E47] mb-4">
          Sending a connection request does <strong>not</strong> open a chat. Messaging and calling are strictly locked until the recipient accepts your request.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="target-personal-id" className="block text-xs font-semibold text-[#1C1E1B] mb-1">
              Personal ID
            </label>
            <input
              id="target-personal-id"
              type="text"
              placeholder="e.g. ID:CSDX2007"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-[#1C1E1B] font-mono text-sm focus:border-[#525C51] focus:ring-1 focus:ring-[#525C51] outline-hidden placeholder:text-[#6E746A]"
              required
            />
          </div>

          {error && <div className="p-2.5 rounded-xl bg-[#EBDADA] text-[#8E4B4B] text-xs">{error}</div>}
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-[#DCE5DD] text-[#476B4D] text-xs font-medium">{successMsg}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-[#B8AB90] hover:bg-[#D0CABA] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-[#525C51] text-[#F8F8F4] hover:bg-[#434B42] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Cryptographic Account Deletion Modal ---
interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmationInput !== 'DELETE') return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div className="bg-[#E0E0D5] text-[#1C1E1B] border border-[#8E4B4B] rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-[#EBDADA] text-[#8E4B4B]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 id="delete-account-title" className="font-semibold text-lg text-[#8E4B4B]">
              Cryptographic Account Shredding
            </h3>
            <p className="text-xs text-[#4A4E47]">Permanent and irreversible</p>
          </div>
        </div>

        <p className="text-xs text-[#4A4E47] mb-3 leading-relaxed">
          Deleting your account permanently destroys your private keys on this device, shreds your public pre-keys from the server directory, breaks all active connections, and wipes all local cached message vaults.
        </p>

        <div className="bg-[#F2F2EB] p-3 rounded-xl border border-[#CBCCC7] mb-4">
          <label htmlFor="confirm-delete-input" className="block text-xs font-semibold text-[#1C1E1B] mb-1">
            Type <span className="font-mono text-[#8E4B4B]">DELETE</span> to proceed:
          </label>
          <input
            id="confirm-delete-input"
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-2 rounded-lg border border-[#CBCCC7] text-sm font-mono bg-white outline-hidden focus:border-[#8E4B4B]"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-[#B8AB90] hover:bg-[#D0CABA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirmationInput !== 'DELETE' || loading}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#8E4B4B] text-[#F8F8F4] hover:bg-[#783D3D] disabled:opacity-40 transition-colors"
          >
            {loading ? 'Shredding...' : 'Permanently Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
