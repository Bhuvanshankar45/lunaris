import { StoredLocalMessage } from '@/lib/crypto/types';

export type AppScreen =
  | 'welcome'
  | 'dashboard'
  | 'chat'
  | 'connections'
  | 'call-lobby'
  | 'active-call'
  | 'profile'
  | 'privacy'
  | 'settings';

export interface UserProfile {
  id: string;
  personalId: string; // e.g. ID:CSDX2007
  displayName: string;
  bio: string;
  avatarId: string;
  identityKeyPub: string;
  signedPreKeyPub: string;
  createdAt: number;
  devices: {
    id: string;
    name: string;
    lastActive: number;
  }[];
}

export interface PeerContact {
  personalId: string;
  displayName: string;
  bio: string;
  avatarId: string;
  identityKeyPub: string;
  signedPreKeyPub: string;
  createdAt: number;
}

export interface ConnectionItem {
  connectionId: string;
  peer: PeerContact;
  updatedAt?: number;
  createdAt?: number;
  unreadCount?: number;
  lastMessage?: StoredLocalMessage;
}

export type CallMode = 'voice-1to1' | 'video-1to1' | 'group-meet';

export interface CallParticipant {
  id: string;
  personalId: string;
  displayName: string;
  avatarId: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isPinned?: boolean;
  stream?: MediaStream | null;
}

export interface ActiveCallState {
  callId: string;
  mode: CallMode;
  roomTitle: string;
  initiatorId: string;
  participants: CallParticipant[];
  startTime: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  inCallChatOpen: boolean;
  pinnedParticipantId: string | null;
}
