'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';
import { AuthModal } from '@/components/auth/AuthModal';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { ChatView } from '@/components/chat/ChatView';
import { ConnectionsView } from '@/components/connections/ConnectionsView';
import { CallLobby } from '@/components/calling/CallLobby';
import { CallView } from '@/components/calling/CallView';
import { ProfileView } from '@/components/profile/ProfileView';
import { PrivacyView } from '@/components/privacy/PrivacyView';
import { SettingsView } from '@/components/settings/SettingsView';
import { SendRequestModal } from '@/components/ui/Modals';

import { AppScreen, CallMode, PeerContact, UserProfile, ActiveCallState } from '@/types';
import { StoredLocalMessage } from '@/lib/crypto/types';
import { vault, DEFAULT_SETTINGS, UserSettings } from '@/lib/storage/vault';
import { DoubleRatchetSession } from '@/lib/crypto/double-ratchet';
import { deriveSafetyNumber } from '@/lib/crypto/primitives';
import { encryptFileForRelay, decryptFileFromRelay } from '@/lib/crypto/file-encryption';
import { DEMO_PREKEYS_PRIV } from '@/lib/crypto/demo-keys';
import { WifiOff, Radio } from 'lucide-react';

export default function LunarisSanctuaryApp() {
  // App Navigation & Session
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('welcome');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [sendRequestModalOpen, setSendRequestModalOpen] = useState(false);

  // Settings & Theme
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isOnline, setIsOnline] = useState(true);

  // Connections
  const [acceptedConnections, setAcceptedConnections] = useState<
    { connectionId: string; peer: PeerContact; updatedAt?: number }[]
  >([]);
  const [incomingRequests, setIncomingRequests] = useState<
    { connectionId: string; peer: PeerContact; createdAt?: number }[]
  >([]);
  const [outgoingRequests, setOutgoingRequests] = useState<
    { connectionId: string; peer: PeerContact; createdAt?: number }[]
  >([]);
  const [blockedUsers, setBlockedUsers] = useState<{ connectionId: string; peer: PeerContact }[]>([]);

  // Active Chat & Messages
  const [activePeer, setActivePeer] = useState<PeerContact | null>(null);
  const [messages, setMessages] = useState<StoredLocalMessage[]>([]);
  const [safetyNumber, setSafetyNumber] = useState<string>('');
  const [isSafetyVerified, setIsSafetyVerified] = useState(false);

  // Call States
  const [callLobbyPeer, setCallLobbyPeer] = useState<PeerContact | null>(null);
  const [callLobbyMode, setCallLobbyMode] = useState<CallMode>('video-1to1');
  const [activeCallState, setActiveCallState] = useState<ActiveCallState | null>(null);
  const [inCallMessages, setInCallMessages] = useState<
    { id: string; senderName: string; text: string; time: string }[]
  >([]);

  // Double Ratchet Sessions cache in memory
  const ratchetSessionsRef = useRef<Map<string, DoubleRatchetSession>>(new Map());

  // Initialize from client storage
  useEffect(() => {
    const loadedSettings = vault.getSettings();
    setSettings(loadedSettings);
    applyTheme(loadedSettings.theme);

    // Check online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial default user: Alice for zero-friction exploration
    handleSwitchPeer('ID:ALIC8821');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyTheme = (theme: 'light' | 'dark') => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  };

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    const updated = vault.updateSettings(newSettings);
    setSettings(updated);
    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }
  };

  // Fetch connections for user
  const fetchConnections = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/connections/list?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setAcceptedConnections(data.accepted || []);
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
        setBlockedUsers(data.blocked || []);
      }
    } catch (err) {
      console.warn('Could not fetch connections:', err);
    }
  }, []);

  // Poll for incoming encrypted relay packets
  const pollRelayPackets = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/relay/poll?recipientId=${currentUser.personalId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.packets && data.packets.length > 0) {
          for (const packet of data.packets) {
            // Find or get Double Ratchet session
            let session = ratchetSessionsRef.current.get(packet.senderId);
            if (!session) {
              const saved = vault.getSession(packet.senderId);
              if (saved) {
                session = new DoubleRatchetSession(saved);
                ratchetSessionsRef.current.set(packet.senderId, session);
              } else {
                const privKey = DEMO_PREKEYS_PRIV[currentUser.personalId];
                if (privKey && packet.ephemeralPublicKey) {
                  try {
                    session = await DoubleRatchetSession.respondToSession(
                      currentUser.personalId,
                      packet.senderId,
                      privKey,
                      packet.ephemeralPublicKey
                    );
                    ratchetSessionsRef.current.set(packet.senderId, session);
                    vault.saveSession(packet.senderId, session.getState());
                  } catch (initErr) {
                    console.warn('Responder session init error:', initErr);
                  }
                }
              }
            }

            if (session) {
              try {
                const plaintext = await session.decrypt(packet);
                vault.saveSession(packet.senderId, session.getState());

                // If media is attached, decrypt file blob locally
                let localFile = undefined;
                if (plaintext.file) {
                  const { decryptedBlob } = await decryptFileFromRelay({
                    name: plaintext.file.name,
                    size: plaintext.file.size,
                    mimeType: plaintext.file.mimeType,
                    encryptedBlobBase64: plaintext.file.encryptedBlobBase64,
                    fileKeyBase64: plaintext.file.fileKeyBase64,
                    ivBase64: plaintext.file.ivBase64,
                  });
                  localFile = {
                    name: plaintext.file.name,
                    size: plaintext.file.size,
                    mimeType: plaintext.file.mimeType,
                    dataUrl: URL.createObjectURL(decryptedBlob),
                  };
                }

                const receivedMsg: StoredLocalMessage = {
                  id: plaintext.id || packet.packetId,
                  chatId: packet.senderId,
                  senderId: packet.senderId,
                  recipientId: currentUser.personalId,
                  text: plaintext.text,
                  replyToId: plaintext.replyToId,
                  timestamp: packet.createdAt,
                  status: 'delivered',
                  file: localFile,
                  expiresAt: packet.disappearingTimerSeconds
                    ? Date.now() + packet.disappearingTimerSeconds * 1000
                    : undefined,
                };

                vault.saveMessage(packet.senderId, receivedMsg);

                // If currently viewing this chat, refresh messages
                if (activePeer && activePeer.personalId === packet.senderId) {
                  setMessages(vault.getMessagesForChat(packet.senderId));
                }
              } catch (decErr) {
                console.warn('Could not decrypt packet:', decErr);
              }
            }
          }
        }
      }
    } catch {
      // offline or network hiccup
    }
  }, [currentUser, activePeer]);

  // Periodic polling for real-time messages
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      pollRelayPackets();
    }, 2500);
    return () => clearInterval(interval);
  }, [currentUser, pollRelayPackets]);

  // Switch Peer Simulator
  const handleSwitchPeer = async (peerId: string) => {
    try {
      const res = await fetch(`/api/users/lookup?id=${peerId}`);
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        setCurrentUser({
          id: `usr_${user.personalId}`,
          personalId: user.personalId,
          displayName: user.displayName,
          bio: user.bio,
          avatarId: user.avatarId,
          identityKeyPub: user.identityKeyPub,
          signedPreKeyPub: user.signedPreKeyPub,
          createdAt: user.createdAt,
          devices: [{ id: 'dev_local', name: 'Verified Browser Session', lastActive: Date.now() }],
        });
        setCurrentScreen('dashboard');
        fetchConnections(user.personalId);
        setActivePeer(null);
      }
    } catch (err) {
      console.warn('Failed to switch peer:', err);
    }
  };

  // Start chat with a peer
  const handleStartChat = async (peer: PeerContact) => {
    setActivePeer(peer);
    setCurrentScreen('chat');

    // Load local messages
    const localMsgs = vault.getMessagesForChat(peer.personalId);
    setMessages(localMsgs);

    // Compute deterministic 60-digit safety number
    if (currentUser) {
      const derived = await deriveSafetyNumber(
        currentUser.personalId,
        currentUser.identityKeyPub,
        peer.personalId,
        peer.identityKeyPub
      );
      setSafetyNumber(derived);
      setIsSafetyVerified(vault.isSafetyNumberVerified(peer.personalId));
    }

    // Ensure Double Ratchet session is initialized
    try {
      if (!ratchetSessionsRef.current.has(peer.personalId)) {
        const savedSession = vault.getSession(peer.personalId);
        if (savedSession) {
          ratchetSessionsRef.current.set(peer.personalId, new DoubleRatchetSession(savedSession));
        } else if (currentUser) {
          const { session } = await DoubleRatchetSession.initiateSession(
            currentUser.personalId,
            peer.personalId,
            {
              identityKeyPub: peer.identityKeyPub,
              signedPreKeyPub: peer.signedPreKeyPub,
            }
          );
          ratchetSessionsRef.current.set(peer.personalId, session);
          vault.saveSession(peer.personalId, session.getState());
        }
      }
    } catch (err) {
      console.warn('Session restore failed, re-initiating:', err);
      vault.deleteSession(peer.personalId);
      if (currentUser) {
        try {
          const { session } = await DoubleRatchetSession.initiateSession(
            currentUser.personalId,
            peer.personalId,
            {
              identityKeyPub: peer.identityKeyPub,
              signedPreKeyPub: peer.signedPreKeyPub,
            }
          );
          ratchetSessionsRef.current.set(peer.personalId, session);
          vault.saveSession(peer.personalId, session.getState());
        } catch (e2) {
          console.warn('Re-initiation failed:', e2);
        }
      }
    }
  };

  // Send an encrypted message
  const handleSendMessage = async (text: string, replyToId?: string) => {
    if (!currentUser || !activePeer) return;

    let session = ratchetSessionsRef.current.get(activePeer.personalId);
    if (!session) {
      const saved = vault.getSession(activePeer.personalId);
      if (saved) {
        try {
          session = new DoubleRatchetSession(saved);
          ratchetSessionsRef.current.set(activePeer.personalId, session);
        } catch {
          // ignore corrupted saved session
        }
      }
    }

    if (!session) {
      try {
        const { session: newSession } = await DoubleRatchetSession.initiateSession(
          currentUser.personalId,
          activePeer.personalId,
          {
            identityKeyPub: activePeer.identityKeyPub,
            signedPreKeyPub: activePeer.signedPreKeyPub,
          }
        );
        session = newSession;
        ratchetSessionsRef.current.set(activePeer.personalId, session);
      } catch (initErr) {
        console.warn('Session initiation warning in handleSendMessage:', initErr);
      }
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const plaintextPayload = {
      id: msgId,
      text,
      replyToId,
    };

    // Encrypt with Double Ratchet forward secrecy (with self-healing retry if key is stale)
    let encryptedPacket;
    try {
      if (session) {
        encryptedPacket = await session.encrypt(
          currentUser.personalId,
          activePeer.personalId,
          plaintextPayload,
          'message',
          settings.disappearingTimerSeconds || undefined
        );
      }
    } catch (encErr) {
      console.warn('Encryption failed on current session, refreshing session:', encErr);
      try {
        const { session: freshSession } = await DoubleRatchetSession.initiateSession(
          currentUser.personalId,
          activePeer.personalId,
          {
            identityKeyPub: activePeer.identityKeyPub,
            signedPreKeyPub: activePeer.signedPreKeyPub,
          }
        );
        session = freshSession;
        ratchetSessionsRef.current.set(activePeer.personalId, session);
        encryptedPacket = await session.encrypt(
          currentUser.personalId,
          activePeer.personalId,
          plaintextPayload,
          'message',
          settings.disappearingTimerSeconds || undefined
        );
      } catch (freshErr) {
        console.warn('Fallback session encryption error:', freshErr);
      }
    }

    if (session) {
      vault.saveSession(activePeer.personalId, session.getState());
    }

    // Save locally
    const localMsg: StoredLocalMessage = {
      id: msgId,
      chatId: activePeer.personalId,
      senderId: currentUser.personalId,
      recipientId: activePeer.personalId,
      text,
      replyToId,
      timestamp: Date.now(),
      status: 'sent',
      expiresAt: settings.disappearingTimerSeconds
        ? Date.now() + settings.disappearingTimerSeconds * 1000
        : undefined,
    };
    vault.saveMessage(activePeer.personalId, localMsg);
    setMessages(vault.getMessagesForChat(activePeer.personalId));

    // Send packet to ephemeral relay
    try {
      await fetch('/api/relay/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedPacket),
      });
      // Mark as delivered
      vault.updateMessage(activePeer.personalId, msgId, (m) => ({ ...m, status: 'delivered' }));
      setMessages(vault.getMessagesForChat(activePeer.personalId));
    } catch (err) {
      console.warn('Relay failed:', err);
    }
  };

  // Send an encrypted file attachment (<10MB)
  const handleSendEncryptedFile = async (file: File) => {
    if (!currentUser || !activePeer) return;

    try {
      // 1. Client-side media encryption
      const encryptedPkg = await encryptFileForRelay(file);

      let session = ratchetSessionsRef.current.get(activePeer.personalId);
      if (!session) {
        try {
          const { session: newSession } = await DoubleRatchetSession.initiateSession(
            currentUser.personalId,
            activePeer.personalId,
            {
              identityKeyPub: activePeer.identityKeyPub,
              signedPreKeyPub: activePeer.signedPreKeyPub,
            }
          );
          session = newSession;
          ratchetSessionsRef.current.set(activePeer.personalId, session);
        } catch (initErr) {
          console.warn('Session init warning in handleSendEncryptedFile:', initErr);
        }
      }

      if (!session) {
        throw new Error('Unable to establish encryption session. Please check contact keys.');
      }

      const msgId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const plaintextPayload = {
        id: msgId,
        file: encryptedPkg,
      };

      const packet = await session.encrypt(
        currentUser.personalId,
        activePeer.personalId,
        plaintextPayload,
        'media',
        settings.disappearingTimerSeconds || undefined
      );

      vault.saveSession(activePeer.personalId, session.getState());

      const localMsg: StoredLocalMessage = {
        id: msgId,
        chatId: activePeer.personalId,
        senderId: currentUser.personalId,
        recipientId: activePeer.personalId,
        timestamp: Date.now(),
        status: 'sent',
        file: {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          dataUrl: URL.createObjectURL(file),
        },
      };

      vault.saveMessage(activePeer.personalId, localMsg);
      setMessages(vault.getMessagesForChat(activePeer.personalId));

      await fetch('/api/relay/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      });
    } catch (err: any) {
      alert(`File encryption error: ${err.message}`);
    }
  };

  // Send voice note
  const handleSendVoiceNote = async (audioBlob: Blob) => {
    const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
      type: 'audio/webm',
    });
    await handleSendEncryptedFile(audioFile);
  };

  // Edit message within 15 minutes
  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!activePeer) return;
    vault.updateMessage(activePeer.personalId, messageId, (m) => ({
      ...m,
      text: newText,
      editedAt: Date.now(),
    }));
    setMessages(vault.getMessagesForChat(activePeer.personalId));
  };

  // Delete message for self
  const handleDeleteMessageForSelf = (messageId: string) => {
    if (!activePeer) return;
    vault.deleteMessageForSelf(activePeer.personalId, messageId);
    setMessages(vault.getMessagesForChat(activePeer.personalId));
  };

  // React to message with emoji
  const handleReactMessage = (messageId: string, emoji: string) => {
    if (!activePeer || !currentUser) return;
    vault.updateMessage(activePeer.personalId, messageId, (m) => {
      const current = m.reactions || {};
      return {
        ...m,
        reactions: {
          ...current,
          [currentUser.personalId]: emoji,
        },
      };
    });
    setMessages(vault.getMessagesForChat(activePeer.personalId));
  };

  // Clear Chat permanently
  const handleClearChat = async (peerId: string) => {
    if (!currentUser) return;
    // Wipe client storage
    vault.clearChat(peerId);
    ratchetSessionsRef.current.delete(peerId);
    setMessages([]);

    // Shred transit relay packets on server
    try {
      await fetch('/api/privacy/clear-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIdA: currentUser.personalId, userIdB: peerId }),
      });
    } catch (err) {
      console.warn('Clear chat server relay purge error:', err);
    }
  };

  // Send Connection Request
  const handleSendConnectionRequest = async (targetId: string) => {
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    const res = await fetch('/api/connections/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId: currentUser.personalId, toUserId: targetId }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.error || 'Failed to send request' };
    fetchConnections(currentUser.personalId);
    return { success: true, message: data.message };
  };

  // Respond to connection request (accept, reject, block)
  const handleRespondRequest = async (peerId: string, action: 'accept' | 'reject' | 'block') => {
    if (!currentUser) return;
    await fetch('/api/connections/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentUserId: currentUser.personalId,
        targetUserId: peerId,
        action,
      }),
    });
    fetchConnections(currentUser.personalId);
  };

  // Remove connection
  const handleRemoveConnection = async (peerId: string) => {
    if (!currentUser) return;
    if (confirm('Remove this secure connection? Messaging and calling will be permanently locked.')) {
      await handleRespondRequest(peerId, 'reject');
      if (activePeer?.personalId === peerId) {
        setActivePeer(null);
        setCurrentScreen('dashboard');
      }
    }
  };

  // Calling Controls
  const handleStartCall = (peer: PeerContact, mode: 'voice-1to1' | 'video-1to1') => {
    setCallLobbyPeer(peer);
    setCallLobbyMode(mode);
    setCurrentScreen('call-lobby');
  };

  const handleJoinCallFromLobby = ({ isMuted, isVideoOff }: { isMuted: boolean; isVideoOff: boolean }) => {
    if (!currentUser) return;

    const participants = [];
    // Self
    participants.push({
      id: currentUser.personalId,
      personalId: currentUser.personalId,
      displayName: currentUser.displayName,
      avatarId: currentUser.avatarId,
      isMuted,
      isVideoOff,
      isSpeaking: false,
    });

    if (callLobbyPeer) {
      participants.push({
        id: callLobbyPeer.personalId,
        personalId: callLobbyPeer.personalId,
        displayName: callLobbyPeer.displayName,
        avatarId: callLobbyPeer.avatarId,
        isMuted: false,
        isVideoOff: callLobbyMode === 'voice-1to1',
        isSpeaking: true,
      });
    } else {
      // Simulate group room participants (Google Meet style)
      participants.push(
        {
          id: 'usr_clara',
          personalId: 'ID:CLAR3310',
          displayName: 'Dr. Clara Sterling',
          avatarId: 'avatar-3',
          isMuted: false,
          isVideoOff: false,
          isSpeaking: true,
        },
        {
          id: 'usr_bob',
          personalId: 'ID:BOBX4492',
          displayName: 'Bob Miller',
          avatarId: 'avatar-2',
          isMuted: true,
          isVideoOff: false,
          isSpeaking: false,
        }
      );
    }

    setActiveCallState({
      callId: `call_${Date.now()}`,
      mode: callLobbyPeer ? callLobbyMode : 'group-meet',
      roomTitle: callLobbyPeer ? `Direct Call: ${callLobbyPeer.displayName}` : 'Arca Sanctuary Group Meet',
      initiatorId: currentUser.personalId,
      participants,
      startTime: Date.now(),
      isMuted,
      isVideoOff,
      isScreenSharing: false,
      inCallChatOpen: false,
      pinnedParticipantId: null,
    });

    setInCallMessages([]);
    setCurrentScreen('active-call');
  };

  const handleEndCall = () => {
    setActiveCallState(null);
    setInCallMessages([]);
    setCurrentScreen('dashboard');
  };

  const handleSendInCallMessage = (text: string) => {
    if (!currentUser) return;
    setInCallMessages((prev) => [
      ...prev,
      {
        id: `in_call_${Date.now()}`,
        senderName: currentUser.displayName,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Abuse Report
  const handleSubmitAbuseReport = async (reportedId: string, category: string, notes: string) => {
    if (!currentUser) return;
    await fetch('/api/privacy/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: currentUser.personalId,
        reportedId,
        category,
        notes,
      }),
    });
  };

  // Cryptographic Account Deletion
  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    await fetch('/api/privacy/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalId: currentUser.personalId }),
    });
    vault.wipeEntireVault();
    setCurrentUser(null);
    setCurrentScreen('welcome');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EAEAE0] text-[#1C1E1B] antialiased selection:bg-[#B8AB90]/30 selection:text-[#1C1E1B]">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-[#8E4B4B] text-[#F8F8F4] px-4 py-2 text-xs font-semibold text-center flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>You are currently offline. Encrypted packets will automatically queue and sync upon reconnection.</span>
        </div>
      )}

      {/* Main Top Navbar */}
      {currentUser && (
        <Navbar
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
          currentUser={currentUser}
          onSwitchPeer={handleSwitchPeer}
          onOpenAuth={(m) => {
            setAuthInitialMode(m);
            setAuthModalOpen(true);
          }}
          isOnline={isOnline}
          theme={settings.theme}
          onToggleTheme={() =>
            handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          }
          unreadCount={0}
          pendingRequestsCount={incomingRequests.length}
        />
      )}

      {/* Screen Router */}
      <div className="flex-1 pb-16 md:pb-0">
        {currentScreen === 'welcome' && (
          <WelcomeScreen
            onOpenAuth={(m) => {
              setAuthInitialMode(m);
              setAuthModalOpen(true);
            }}
            onEnterAsDemo={handleSwitchPeer}
          />
        )}

        {currentUser && currentScreen === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            acceptedConnections={acceptedConnections}
            incomingRequests={incomingRequests}
            onNavigate={setCurrentScreen}
            onStartChat={handleStartChat}
            onOpenAddConnection={() => setSendRequestModalOpen(true)}
          />
        )}

        {currentUser && currentScreen === 'chat' && (
          <ChatView
            currentUser={currentUser}
            activePeer={activePeer}
            connections={acceptedConnections}
            messages={messages}
            onSelectPeer={handleStartChat}
            onSendMessage={handleSendMessage}
            onSendEncryptedFile={handleSendEncryptedFile}
            onSendVoiceNote={handleSendVoiceNote}
            onEditMessage={handleEditMessage}
            onDeleteMessageForSelf={handleDeleteMessageForSelf}
            onReactMessage={handleReactMessage}
            onClearChat={handleClearChat}
            onStartCall={handleStartCall}
            onViewSafetyNumber={(p) => {
              setActivePeer(p);
              handleStartChat(p);
            }}
            safetyNumber={safetyNumber}
            isSafetyVerified={isSafetyVerified}
            onToggleSafetyVerified={(v) => {
              if (activePeer) {
                vault.setSafetyNumberVerified(activePeer.personalId, v);
                setIsSafetyVerified(v);
              }
            }}
            optInReadReceipts={settings.optInReadReceipts}
            disappearingTimer={settings.disappearingTimerSeconds}
            onSetDisappearingTimer={(sec) => handleUpdateSettings({ disappearingTimerSeconds: sec })}
          />
        )}

        {currentUser && currentScreen === 'connections' && (
          <ConnectionsView
            currentUserId={currentUser.personalId}
            accepted={acceptedConnections}
            incoming={incomingRequests}
            outgoing={outgoingRequests}
            blocked={blockedUsers}
            onOpenSendModal={() => setSendRequestModalOpen(true)}
            onRespondRequest={handleRespondRequest}
            onStartChat={handleStartChat}
            onStartCall={handleStartCall}
            onViewSafetyNumber={handleStartChat}
            onRemoveConnection={handleRemoveConnection}
          />
        )}

        {currentUser && currentScreen === 'call-lobby' && (
          <CallLobby
            mode={callLobbyMode}
            peerContact={callLobbyPeer}
            roomCode={`room_${Math.random().toString(36).substring(2, 7)}`}
            onJoin={handleJoinCallFromLobby}
            onCancel={() => setCurrentScreen('dashboard')}
          />
        )}

        {currentUser && currentScreen === 'active-call' && activeCallState && (
          <CallView
            callState={activeCallState}
            onEndCall={handleEndCall}
            onToggleMute={() =>
              setActiveCallState((s) => (s ? { ...s, isMuted: !s.isMuted } : null))
            }
            onToggleVideo={() =>
              setActiveCallState((s) => (s ? { ...s, isVideoOff: !s.isVideoOff } : null))
            }
            onToggleScreenShare={() =>
              setActiveCallState((s) => (s ? { ...s, isScreenSharing: !s.isScreenSharing } : null))
            }
            onPinParticipant={(pId) =>
              setActiveCallState((s) => (s ? { ...s, pinnedParticipantId: pId } : null))
            }
            onSendInCallMessage={handleSendInCallMessage}
            inCallMessages={inCallMessages}
            safetyNumber={safetyNumber || '01234 56789 12345 67890 12345 67890 12345 67890 12345 67890 12345 67890'}
            isSafetyVerified={isSafetyVerified}
            onToggleSafetyVerified={(v) => {
              if (activePeer) {
                vault.setSafetyNumberVerified(activePeer.personalId, v);
                setIsSafetyVerified(v);
              }
            }}
          />
        )}

        {currentUser && currentScreen === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onUpdateProfile={(name, bio) => {
              setCurrentUser((u) => (u ? { ...u, displayName: name, bio } : null));
            }}
          />
        )}

        {currentUser && currentScreen === 'privacy' && (
          <PrivacyView
            currentUser={currentUser}
            blockedUsers={blockedUsers.map((b) => b.peer.personalId)}
            onUnblockUser={(uId) => handleRespondRequest(uId, 'reject')}
            onClearLocalVault={() => {
              vault.wipeEntireVault();
              setMessages([]);
            }}
            onDeleteAccount={handleDeleteAccount}
            onSubmitAbuseReport={handleSubmitAbuseReport}
          />
        )}

        {currentUser && currentScreen === 'settings' && (
          <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {currentUser && currentScreen !== 'active-call' && (
        <MobileNav
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
          unreadCount={0}
          pendingRequestsCount={incomingRequests.length}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setCurrentScreen('dashboard');
          fetchConnections(user.personalId);
        }}
      />

      {/* Add Connection by ID Modal */}
      <SendRequestModal
        isOpen={sendRequestModalOpen}
        onClose={() => setSendRequestModalOpen(false)}
        onSend={handleSendConnectionRequest}
      />
    </div>
  );
}
