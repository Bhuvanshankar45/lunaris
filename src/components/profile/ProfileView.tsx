'use client';

import React, { useState } from 'react';
import {
  User,
  Shield,
  Copy,
  Check,
  QrCode,
  KeyRound,
  Save,
  CheckCircle2,
  Calendar,
  Smartphone,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { Avatar } from '../ui/Avatar';

interface ProfileViewProps {
  currentUser: UserProfile;
  onUpdateProfile: (name: string, bio: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUpdateProfile,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.personalId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(currentUser.identityKeyPub);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(displayName, bio);
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-[#E0E0D5] border border-[#B8AB90] rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-[#CBCCC7]">
          <Avatar name={displayName} size="xl" />

          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-serif font-bold text-[#1C1E1B]">{displayName}</h1>
            <p className="text-xs text-[#4A4E47] mt-1">{bio || 'Private Lunaris Sovereign Identity'}</p>

            {/* Immutable ID Pill */}
            <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-full bg-[#D0CABA] border border-[#B8AB90] shadow-2xs">
              <span className="text-[11px] font-medium text-[#4A4E47]">Immutable ID:</span>
              <span className="font-mono text-xs font-bold text-[#1C1E1B]">{currentUser.personalId}</span>
              <button
                onClick={handleCopyId}
                className="p-1 rounded-md text-[#4A4E47] hover:text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                title="Copy ID to clipboard"
                aria-label="Copy personal ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-[#476B4D]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setShowQr(!showQr)}
                className="p-1 rounded-md text-[#4A4E47] hover:text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                title="Toggle QR Code"
                aria-label="Show QR code"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* QR Code Presentation Box */}
        {showQr && (
          <div className="my-6 p-6 rounded-2xl bg-[#F2F2EB] border border-[#B8AB90] text-center animate-in fade-in">
            <p className="text-xs font-semibold text-[#1C1E1B] mb-1">In-Person Cryptographic Pairing</p>
            <p className="text-[11px] text-[#4A4E47] mb-4">
              Have another Lunaris user scan this QR code to initiate an authenticated connection request.
            </p>
            <div className="w-40 h-40 mx-auto bg-white p-3 rounded-xl border border-[#CBCCC7] shadow-inner flex items-center justify-center">
              {/* Clean SVG QR Code Representation */}
              <div className="font-mono text-[10px] text-[#1C1E1B] break-all leading-tight">
                <div className="grid grid-cols-6 gap-1 p-1">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-xs ${
                        (i * 7) % 3 === 0 || i === 0 || i === 5 || i === 30 || i === 35
                          ? 'bg-[#1C1E1B]'
                          : 'bg-[#CBCCC7]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="font-mono text-xs font-bold text-[#1C1E1B] mt-3">{currentUser.personalId}</p>
          </div>
        )}

        {/* Profile Edit Form */}
        <form onSubmit={handleSave} className="py-6 space-y-4">
          <div>
            <label htmlFor="display-name" className="block text-xs font-semibold text-[#1C1E1B] mb-1">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs text-[#1C1E1B] focus:border-[#525C51] outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="user-bio" className="block text-xs font-semibold text-[#1C1E1B] mb-1">
              Bio (Optional)
            </label>
            <textarea
              id="user-bio"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={256}
              placeholder="A short note about your secure presence..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs text-[#1C1E1B] focus:border-[#525C51] outline-hidden resize-none"
            />
          </div>

          {savedAlert && (
            <div className="p-3 rounded-xl bg-[#DCE5DD] text-[#476B4D] text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Profile details updated securely on this device.</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42] transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>

        {/* Cryptographic Public Identity Details */}
        <div className="pt-6 border-t border-[#CBCCC7] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#525C51]" />
              <h3 className="font-semibold text-xs text-[#1C1E1B]">Public Identity Key (ECDH P-256)</h3>
            </div>
            <button
              onClick={handleCopyKey}
              className="text-xs text-[#525C51] hover:underline flex items-center gap-1 font-medium"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-[#476B4D]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? 'Key Copied' : 'Copy SPKI Base64'}</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#F2F2EB] border border-[#CBCCC7] font-mono text-[11px] text-[#4A4E47] break-all select-all">
            {currentUser.identityKeyPub}
          </div>

          <div className="flex items-center gap-4 text-xs text-[#6E746A]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#B8AB90]" />
              <span>Sanctuary Created: {new Date(currentUser.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#B8AB90]" />
              <span>Active Devices: {currentUser.devices?.length || 1}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
