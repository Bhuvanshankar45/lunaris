'use client';

import React from 'react';
import { Settings, Timer, Eye, Bell, Moon, Sun, CheckCircle2, Shield } from 'lucide-react';
import { UserSettings } from '@/lib/storage/vault';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-xl bg-[#525C51] text-[#F8F8F4]">
          <Settings className="w-5 h-5 text-[#CBCCC7]" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-[#1C1E1B]">Sanctuary Settings</h1>
      </div>

      {/* Disappearing Messages Default */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-3">
        <div className="flex items-center gap-2.5">
          <Timer className="w-5 h-5 text-[#525C51]" />
          <div>
            <h2 className="text-sm font-bold text-[#1C1E1B]">Default Disappearing Messages Timer</h2>
            <p className="text-xs text-[#4A4E47]">Applies to new encrypted chats initiated on this device.</p>
          </div>
        </div>

        <select
          value={settings.disappearingTimerSeconds}
          onChange={(e) => onUpdateSettings({ disappearingTimerSeconds: Number(e.target.value) })}
          className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs font-medium text-[#1C1E1B] outline-hidden focus:border-[#525C51]"
        >
          <option value={0}>Off (Manual Deletion / Clear Chat Only)</option>
          <option value={30}>30 Seconds</option>
          <option value={300}>5 Minutes</option>
          <option value={3600}>1 Hour</option>
          <option value={86400}>24 Hours</option>
          <option value={604800}>7 Days</option>
        </select>
      </div>

      {/* Privacy Opt-Ins (Strict Opt-In Rule) */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-[#1C1E1B] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#525C51]" />
          <span>Opt-In Privacy Controls</span>
        </h2>
        <p className="text-xs text-[#4A4E47]">
          Following strict privacy-first principles, read receipts and notification text previews are disabled by default.
        </p>

        <div className="space-y-3 pt-1">
          {/* Read Receipts Toggle */}
          <div className="p-4 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#1C1E1B]">Read Receipts</p>
              <p className="text-[11px] text-[#4A4E47]">
                When enabled, contacts see when you have decrypted and viewed their messages. If disabled, only delivery checkmarks are shown.
              </p>
            </div>
            <button
              onClick={() => onUpdateSettings({ optInReadReceipts: !settings.optInReadReceipts })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.optInReadReceipts ? 'bg-[#476B4D]' : 'bg-[#CBCCC7]'
              }`}
              aria-label="Toggle read receipts"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.optInReadReceipts ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Notification Previews Toggle */}
          <div className="p-4 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#1C1E1B]">Notification Text Previews</p>
              <p className="text-[11px] text-[#4A4E47]">
                Default is generic (&quot;New encrypted message from ID:...&quot;). Enabling displays decrypted message text in push notifications on this device.
              </p>
            </div>
            <button
              onClick={() => onUpdateSettings({ optInPreviews: !settings.optInPreviews })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.optInPreviews ? 'bg-[#476B4D]' : 'bg-[#CBCCC7]'
              }`}
              aria-label="Toggle notification previews"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.optInPreviews ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Appearance Theme */}
      <div className="p-6 rounded-3xl bg-[#E0E0D5] border border-[#B8AB90] shadow-2xs space-y-3">
        <h2 className="text-sm font-bold text-[#1C1E1B] flex items-center gap-2">
          {settings.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          <span>Appearance & Sanctuary Theme</span>
        </h2>

        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <button
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              settings.theme === 'light'
                ? 'bg-[#525C51] text-[#F8F8F4] border-[#525C51] shadow-xs'
                : 'bg-[#F2F2EB] text-[#1C1E1B] border-[#CBCCC7] hover:bg-[#CBCCC7]'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Calm Ivory (Light)</span>
          </button>

          <button
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              settings.theme === 'dark'
                ? 'bg-[#525C51] text-[#F8F8F4] border-[#525C51] shadow-xs'
                : 'bg-[#F2F2EB] text-[#1C1E1B] border-[#CBCCC7] hover:bg-[#CBCCC7]'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Deep Slate (Dark)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
