'use client';

import React from 'react';
import { MessageSquare, Users, Video, Lock, Settings } from 'lucide-react';
import { AppScreen } from '@/types';

interface MobileNavProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  unreadCount?: number;
  pendingRequestsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentScreen,
  onNavigate,
  unreadCount = 0,
  pendingRequestsCount = 0,
}) => {
  const tabs = [
    {
      id: 'chat' as AppScreen,
      label: 'Chats',
      icon: MessageSquare,
      badge: unreadCount,
    },
    {
      id: 'connections' as AppScreen,
      label: 'Contacts',
      icon: Users,
      badge: pendingRequestsCount,
    },
    {
      id: 'call-lobby' as AppScreen,
      label: 'Meet',
      icon: Video,
      badge: 0,
    },
    {
      id: 'privacy' as AppScreen,
      label: 'Privacy',
      icon: Lock,
      badge: 0,
    },
    {
      id: 'settings' as AppScreen,
      label: 'Settings',
      icon: Settings,
      badge: 0,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#E0E0D5]/95 backdrop-blur-lg border-t border-[#CBCCC7] px-2 py-1.5 flex items-center justify-around"
      aria-label="Mobile Bottom Navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentScreen === tab.id || (tab.id === 'call-lobby' && currentScreen === 'active-call');

        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
              isActive ? 'text-[#525C51] font-semibold' : 'text-[#4A4E47] hover:text-[#1C1E1B]'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              {tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-4 h-4 rounded-full bg-[#8E4B4B] text-[#F8F8F4] text-[9px] font-bold flex items-center justify-center px-1">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
