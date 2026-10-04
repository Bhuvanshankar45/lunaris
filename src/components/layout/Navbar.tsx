'use client';

import React, { useState } from 'react';
import {
  Shield,
  MessageSquare,
  Users,
  Video,
  User,
  Lock,
  Settings,
  Copy,
  Check,
  Moon,
  Sun,
  Radio,
  ArrowRightLeft,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { AppScreen, UserProfile } from '@/types';
import { Avatar } from '../ui/Avatar';

interface NavbarProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  onLogout?: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  isOnline: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  unreadCount?: number;
  pendingRequestsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  currentUser,
  onLogout,
  onOpenAuth,
  isOnline,
  theme,
  onToggleTheme,
  unreadCount = 0,
  pendingRequestsCount = 0,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.personalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#CBCCC7] bg-[#E0E0D5]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Personal ID Chip */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left group"
            aria-label="Lunaris Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#525C51] text-[#F8F8F4] flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
              <Shield className="w-5 h-5 text-[#CBCCC7]" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-[#1C1E1B]">Lunaris</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded-sm bg-[#D0CABA] text-[#4A4E47] border border-[#B8AB90]">
                E2EE Sanctuary
              </span>
            </div>
          </button>

          {/* User's Immutable ID Pill */}
          <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-[#D0CABA] border border-[#B8AB90] shadow-2xs">
            <span className="text-[10px] font-medium text-[#4A4E47] uppercase">My ID:</span>
            <span className="font-mono text-xs font-semibold text-[#1C1E1B]">{currentUser.personalId}</span>
            <button
              onClick={handleCopyId}
              className="p-1 text-[#4A4E47] hover:text-[#1C1E1B] rounded-sm transition-colors"
              title="Copy your immutable ID"
              aria-label="Copy personal ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#476B4D]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Desktop Screen Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
          <button
            onClick={() => onNavigate('chat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors relative ${
              currentScreen === 'chat'
                ? 'bg-[#525C51] text-[#F8F8F4]'
                : 'text-[#1C1E1B] hover:bg-[#CBCCC7]/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Messages</span>
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#8E4B4B] text-[#F8F8F4] text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('connections')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors relative ${
              currentScreen === 'connections'
                ? 'bg-[#525C51] text-[#F8F8F4]'
                : 'text-[#1C1E1B] hover:bg-[#CBCCC7]/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Connections</span>
            {pendingRequestsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#525C51] text-[#F8F8F4] text-[10px] flex items-center justify-center font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('call-lobby')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              currentScreen === 'call-lobby' || currentScreen === 'active-call'
                ? 'bg-[#525C51] text-[#F8F8F4]'
                : 'text-[#1C1E1B] hover:bg-[#CBCCC7]/60'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Meet & Call</span>
          </button>

          <button
            onClick={() => onNavigate('privacy')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              currentScreen === 'privacy'
                ? 'bg-[#525C51] text-[#F8F8F4]'
                : 'text-[#1C1E1B] hover:bg-[#CBCCC7]/60'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Privacy</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              currentScreen === 'settings'
                ? 'bg-[#525C51] text-[#F8F8F4]'
                : 'text-[#1C1E1B] hover:bg-[#CBCCC7]/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Tools: Sign Out, Theme & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Sign Out / Lock Vault */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium bg-[#CBCCC7]/50 hover:bg-[#8E4B4B] hover:text-[#F8F8F4] border border-[#B8AB90] text-[#1C1E1B] transition-all shadow-2xs"
              title="Lock Vault & Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-[#4A4E47] hover:bg-[#CBCCC7] transition-colors"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-[#D0CABA]" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Profile Button */}
          <button
            onClick={() => onNavigate('profile')}
            className={`p-1 rounded-full border transition-all ${
              currentScreen === 'profile' ? 'border-[#525C51] ring-2 ring-[#525C51]/30' : 'border-transparent'
            }`}
            title="My Profile"
            aria-label="View user profile"
          >
            <Avatar name={currentUser.displayName} size="sm" showPresence isOnline={isOnline} />
          </button>
        </div>
      </div>
    </header>
  );
};
