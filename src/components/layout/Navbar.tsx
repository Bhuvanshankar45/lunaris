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
  LogIn,
} from 'lucide-react';
import { AppScreen, UserProfile } from '@/types';
import { Avatar } from '../ui/Avatar';

interface NavbarProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  onSwitchPeer: (peerId: string) => void;
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
  onSwitchPeer,
  onOpenAuth,
  isOnline,
  theme,
  onToggleTheme,
  unreadCount = 0,
  pendingRequestsCount = 0,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPeerSwitcher, setShowPeerSwitcher] = useState(false);

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

        {/* Right Tools: Peer Switcher, Theme & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Peer Simulator Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowPeerSwitcher(!showPeerSwitcher)}
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium bg-[#CBCCC7]/60 hover:bg-[#CBCCC7] border border-[#B8AB90] text-[#1C1E1B] transition-colors"
              title="Test real-time E2EE by switching between peers"
              aria-label="Switch active demo peer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#525C51]" />
              <span className="hidden lg:inline">Switch Peer:</span>
              <span className="font-semibold">{currentUser.displayName.split(' ')[0]}</span>
            </button>

            {showPeerSwitcher && (
              <div className="absolute right-0 mt-2 w-64 bg-[#E0E0D5] border border-[#B8AB90] rounded-2xl p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-[#CBCCC7] mb-1">
                  <p className="text-[11px] font-semibold text-[#1C1E1B]">Instant Peer Simulator</p>
                  <p className="text-[10px] text-[#4A4E47]">Simulate real-time 2-way ratcheted chats</p>
                </div>
                <div className="space-y-1">
                  {[
                    { id: 'ID:ALIC8821', name: 'Alice Vance', avatar: 'avatar-1' },
                    { id: 'ID:BOBX4492', name: 'Bob Miller', avatar: 'avatar-2' },
                    { id: 'ID:CLAR3310', name: 'Dr. Clara Sterling', avatar: 'avatar-3' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSwitchPeer(p.id);
                        setShowPeerSwitcher(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors ${
                        currentUser.personalId === p.id
                          ? 'bg-[#525C51] text-[#F8F8F4]'
                          : 'hover:bg-[#CBCCC7] text-[#1C1E1B]'
                      }`}
                    >
                      <Avatar name={p.name} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-[10px] font-mono opacity-80">{p.id}</p>
                      </div>
                      {currentUser.personalId === p.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>

                {onOpenAuth && (
                  <div className="border-t border-[#CBCCC7] mt-2 pt-1.5 space-y-1">
                    <button
                      onClick={() => {
                        setShowPeerSwitcher(false);
                        onOpenAuth('register');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs hover:bg-[#CBCCC7] text-[#1C1E1B] font-medium transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#525C51]" />
                      <span>Create New Sovereign Account</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowPeerSwitcher(false);
                        onOpenAuth('login');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs hover:bg-[#CBCCC7] text-[#1C1E1B] font-medium transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5 text-[#525C51]" />
                      <span>Sign In to Existing Account</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
