'use client';

import React from 'react';

interface AvatarProps {
  avatarId?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showPresence?: boolean;
  isOnline?: boolean; // Only if opted in
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

// Warm, restrained privacy palette colors for avatar backgrounds
const AVATAR_PALETTES = [
  { bg: '#B8AB90', fg: '#1C1E1B' }, // Deep muted taupe
  { bg: '#A9ABA8', fg: '#1C1E1B' }, // Green-gray
  { bg: '#D0CABA', fg: '#2A2D28' }, // Warm beige
  { bg: '#525C51', fg: '#F8F8F4' }, // Forest slate
  { bg: '#8A9188', fg: '#1C1E1B' }, // Neutral green
  { bg: '#6E746A', fg: '#F8F8F4' }, // Muted stone
];

export const Avatar: React.FC<AvatarProps> = ({
  avatarId = 'avatar-1',
  name = 'User',
  size = 'md',
  className = '',
  showPresence = false,
  isOnline = false,
}) => {
  // Deterministic palette pick
  const index = Math.abs(name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % AVATAR_PALETTES.length;
  const palette = AVATAR_PALETTES[index];

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-medium border border-[#CBCCC7] transition-transform select-none shadow-xs`}
        style={{
          backgroundColor: palette.bg,
          color: palette.fg,
        }}
        aria-label={`${name}'s avatar`}
      >
        <span>{initials}</span>
      </div>
      {showPresence && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
            isOnline ? 'bg-[#476B4D]' : 'bg-[#A9ABA8]'
          }`}
          title={isOnline ? 'Active' : 'Offline'}
        />
      )}
    </div>
  );
};
