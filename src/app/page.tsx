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
import { StoredLocalMessage, EncryptedPacket } from '@/lib/crypto/types';
import { vault, DEFAULT_SETTINGS, UserSettings } from '@/lib/storage/vault';
import { DoubleRatchetSession } from '@/lib/crypto/double-ratchet';
import { deriveSafetyNumber } from '@/lib/crypto/primitives';
import { encryptFileForRelay, decryptFileFromRelay } from '@/lib/crypto/file-encryption';
import { DEMO_PREKEYS_PRIV } from '@/lib/crypto/demo-keys';
import { WifiOff, Radio, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { WebRTCService } from '@/lib/webrtc/webrtc-service';

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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    fromId: string;
    fromName: string;
    mode: CallMode;
    roomCode: string;
  } | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<{
    toId: string;
    toName: string;
    mode: CallMode;
  } | null>(null);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const [inCallMessages, setInCallMessages] = useState<
    { id: string; senderName: string; text: string; time: string }[]
  >([]);

  // Double Ratchet Sessions cache in memory
  const ratchetSessionsRef = useRef<Map<string, DoubleRatchetSession>>(new Map());

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

    // Restore real authenticated session from client vault, if present
    const savedUser = vault.getCurrentUser();
    if (savedUser) {
      setCurrentUser(savedUser);
      setCurrentScreen('dashboard');
      fetchConnections(savedUser.personalId);
    } else {
      setCurrentUser(null);
      setCurrentScreen('welcome');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchConnections]);

  // Send call signaling packet via relay
  const sendCallSignal = useCallback(
    async (toPeerId: string, signalPayload: any) => {
      if (!currentUser) return;
      const jsonStr = JSON.stringify(signalPayload);
      const packet: EncryptedPacket = {
        packetId: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        senderId: currentUser.personalId,
        recipientId: toPeerId,
        type: 'signal_call',
        ephemeralPublicKey: '',
        sequenceNumber: 0,
        previousChainLength: 0,
        iv: 'call_sig_iv',
        ciphertext: btoa(unescape(encodeURIComponent(jsonStr))),
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      };

      try {
        await fetch('/api/relay/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(packet),
        });
      } catch (err) {
        console.warn('Call signal relay error:', err);
      }
    },
    [currentUser]
  );

  // Incoming Call Signaling handler
  const handleIncomingCallSignal = useCallback(
    async (fromId: string, payload: any) => {
      const action = payload.callAction;
      console.log('Incoming call signal:', action, 'from:', fromId);

      if (action === 'invite') {
        setIncomingCall({
          fromId,
          fromName: payload.fromName || fromId,
          mode: payload.mode || 'video-1to1',
          roomCode: payload.roomCode || 'lunaris_call',
        });
      } else if (action === 'decline') {
        alert('The peer declined the call.');
        setOutgoingCall(null);
        webrtcServiceRef.current?.endCall();
        webrtcServiceRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        setActiveCallState(null);
        setCurrentScreen('dashboard');
      } else if (action === 'accept') {
        setOutgoingCall(null);
        if (webrtcServiceRef.current) {
          try {
            const offer = await webrtcServiceRef.current.createCallOffer();
            sendCallSignal(fromId, { callAction: 'sdp_offer', sdp: offer });
          } catch (e) {
            console.error('Failed to create call offer:', e);
          }
        }
      } else if (action === 'sdp_offer') {
        if (webrtcServiceRef.current && payload.sdp) {
          try {
            const answer = await webrtcServiceRef.current.handleCallOffer(payload.sdp);
            sendCallSignal(fromId, { callAction: 'sdp_answer', sdp: answer });
          } catch (e) {
            console.error('Failed to handle SDP offer:', e);
          }
        }
      } else if (action === 'sdp_answer') {
        if (webrtcServiceRef.current && payload.sdp) {
          try {
            await webrtcServiceRef.current.handleCallAnswer(payload.sdp);
          } catch (e) {
            console.error('Failed to handle SDP answer:', e);
          }
        }
      } else if (action === 'ice_candidate') {
        if (webrtcServiceRef.current && payload.candidate) {
          await webrtcServiceRef.current.addIceCandidate(payload.candidate);
        }
      } else if (action === 'hangup') {
        webrtcServiceRef.current?.endCall();
        webrtcServiceRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        setIncomingCall(null);
        setOutgoingCall(null);
        setActiveCallState(null);
        setCurrentScreen('dashboard');
      }
    },
    [sendCallSignal]
  );

  // Poll for incoming encrypted relay packets
  const pollRelayPackets = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/relay/poll?recipientId=${currentUser.personalId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.packets && data.packets.length > 0) {
          for (const packet of data.packets) {
            // Check for direct WebRTC call signaling packet
            if (packet.type === 'signal_call') {
              try {
                let payload: any = null;
                try {
                  const decoded = decodeURIComponent(escape(atob(packet.ciphertext)));
                  payload = JSON.parse(decoded);
                } catch {
                  try {
                    payload = JSON.parse(packet.ciphertext);
                  } catch {
                    payload = null;
                  }
                }
                if (payload && payload.callAction) {
                  handleIncomingCallSignal(packet.senderId, payload);
                }
              } catch (err) {
                console.warn('Signal call parse error:', err);
              }
              continue;
            }

            // Find or get Double Ratchet session
            let session = ratchetSessionsRef.current.get(packet.senderId);
            if (!session) {
              const saved = vault.getSession(packet.senderId);
              if (saved) {
                session = new DoubleRatchetSession(saved);
                ratchetSessionsRef.current.set(packet.senderId, session);
              } else {
                const privKey =
                  vault.getSignedPreKeyPriv(currentUser.personalId) ||
                  DEMO_PREKEYS_PRIV[currentUser.personalId];
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

                // If this is an in-band call action
                if (plaintext && (plaintext as any).callAction) {
                  handleIncomingCallSignal(packet.senderId, plaintext as any);
                  continue;
                }

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
  }, [currentUser, activePeer, handleIncomingCallSignal]);

  // Periodic polling for real-time messages
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      pollRelayPackets();
    }, 2500);
    return () => clearInterval(interval);
  }, [currentUser, pollRelayPackets]);

  // User Logout & Lock Session
  const handleLogout = () => {
    vault.saveCurrentUser(null);
    setCurrentUser(null);
    setCurrentScreen('welcome');
    setActivePeer(null);
    setAcceptedConnections([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setBlockedUsers([]);
    setMessages([]);
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

  const handleJoinCallFromLobby = async ({
    isMuted,
    isVideoOff,
    stream,
  }: {
    isMuted: boolean;
    isVideoOff: boolean;
    stream?: MediaStream;
  }) => {
    if (!currentUser) return;

    const webrtc = new WebRTCService({
      onLocalStream: (s) => setLocalStream(s),
      onRemoteStream: (s) => setRemoteStream(s),
      onSendSignal: (sig) => {
        if (callLobbyPeer) {
          sendCallSignal(callLobbyPeer.personalId, sig);
        }
      },
    });
    webrtcServiceRef.current = webrtc;

    let activeStream = stream;
    if (!activeStream) {
      try {
        activeStream = await webrtc.startLocalMedia({
          video: !isVideoOff,
          audio: true,
        });
      } catch (err: any) {
        console.warn('Failed to start local media:', err);
      }
    } else {
      (webrtc as any).localStream = activeStream;
    }
    setLocalStream(activeStream || null);

    if (callLobbyPeer) {
      // 1-on-1 Call with peer: Notify peer and display Outgoing Calling view
      setOutgoingCall({
        toId: callLobbyPeer.personalId,
        toName: callLobbyPeer.displayName,
        mode: callLobbyMode,
      });

      sendCallSignal(callLobbyPeer.personalId, {
        callAction: 'invite',
        fromName: currentUser.displayName,
        mode: callLobbyMode,
      });

      setActiveCallState({
        callId: `call_${Date.now()}`,
        mode: callLobbyMode,
        roomTitle: `Lunaris Call: ${callLobbyPeer.displayName}`,
        initiatorId: currentUser.personalId,
        participants: [
          {
            id: currentUser.personalId,
            personalId: currentUser.personalId,
            displayName: currentUser.displayName,
            avatarId: currentUser.avatarId,
            isMuted,
            isVideoOff,
            isSpeaking: false,
          },
          {
            id: callLobbyPeer.personalId,
            personalId: callLobbyPeer.personalId,
            displayName: callLobbyPeer.displayName,
            avatarId: callLobbyPeer.avatarId,
            isMuted: false,
            isVideoOff: callLobbyMode === 'voice-1to1',
            isSpeaking: false,
          },
        ],
        startTime: Date.now(),
        isMuted,
        isVideoOff,
        isScreenSharing: false,
        inCallChatOpen: false,
        pinnedParticipantId: null,
      });
    } else {
      // Standalone Google Meet style room
      setActiveCallState({
        callId: `call_${Date.now()}`,
        mode: 'group-meet',
        roomTitle: 'Lunaris Sanctuary Meeting',
        initiatorId: currentUser.personalId,
        participants: [
          {
            id: currentUser.personalId,
            personalId: currentUser.personalId,
            displayName: currentUser.displayName,
            avatarId: currentUser.avatarId,
            isMuted,
            isVideoOff,
            isSpeaking: false,
          },
        ],
        startTime: Date.now(),
        isMuted,
        isVideoOff,
        isScreenSharing: false,
        inCallChatOpen: false,
        pinnedParticipantId: null,
      });
      setCurrentScreen('active-call');
    }
  };

  const handleEndCall = () => {
    if (callLobbyPeer) {
      sendCallSignal(callLobbyPeer.personalId, { callAction: 'hangup' });
    } else if (activePeer) {
      sendCallSignal(activePeer.personalId, { callAction: 'hangup' });
    }
    webrtcServiceRef.current?.endCall();
    webrtcServiceRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveCallState(null);
    setInCallMessages([]);
    setCurrentScreen('dashboard');
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      sendCallSignal(incomingCall.fromId, { callAction: 'decline' });
      setIncomingCall(null);
    }
  };

  const handleCancelOutgoingCall = () => {
    if (outgoingCall) {
      sendCallSignal(outgoingCall.toId, { callAction: 'hangup' });
      setOutgoingCall(null);
      webrtcServiceRef.current?.endCall();
      webrtcServiceRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      setActiveCallState(null);
      setCurrentScreen('dashboard');
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall || !currentUser) return;
    const callerId = incomingCall.fromId;
    const mode = incomingCall.mode;

    const webrtc = new WebRTCService({
      onLocalStream: (s) => setLocalStream(s),
      onRemoteStream: (s) => setRemoteStream(s),
      onSendSignal: (sig) => sendCallSignal(callerId, sig),
    });
    webrtcServiceRef.current = webrtc;

    try {
      const stream = await webrtc.startLocalMedia({
        video: mode !== 'voice-1to1',
        audio: true,
      });
      setLocalStream(stream);

      // Signal caller that we accepted!
      sendCallSignal(callerId, { callAction: 'accept' });

      setActiveCallState({
        callId: `call_${Date.now()}`,
        mode,
        roomTitle: `Lunaris Call: ${incomingCall.fromName}`,
        initiatorId: callerId,
        participants: [
          {
            id: currentUser.personalId,
            personalId: currentUser.personalId,
            displayName: currentUser.displayName,
            avatarId: currentUser.avatarId,
            isMuted: false,
            isVideoOff: mode === 'voice-1to1',
            isSpeaking: false,
          },
          {
            id: callerId,
            personalId: callerId,
            displayName: incomingCall.fromName,
            avatarId: 'avatar-2',
            isMuted: false,
            isVideoOff: mode === 'voice-1to1',
            isSpeaking: false,
          },
        ],
        startTime: Date.now(),
        isMuted: false,
        isVideoOff: mode === 'voice-1to1',
        isScreenSharing: false,
        inCallChatOpen: false,
        pinnedParticipantId: null,
      });

      setIncomingCall(null);
      setCurrentScreen('active-call');
    } catch (err: any) {
      alert('Camera and microphone permission required: ' + (err.message || err));
      handleDeclineCall();
    }
  };

  const handleToggleMute = () => {
    if (webrtcServiceRef.current) {
      const isMuted = webrtcServiceRef.current.toggleMute();
      setActiveCallState((s) => (s ? { ...s, isMuted } : null));
    } else {
      setActiveCallState((s) => (s ? { ...s, isMuted: !s.isMuted } : null));
    }
  };

  const handleToggleVideo = () => {
    if (webrtcServiceRef.current) {
      const isVideoOff = webrtcServiceRef.current.toggleVideo();
      setActiveCallState((s) => (s ? { ...s, isVideoOff } : null));
    } else {
      setActiveCallState((s) => (s ? { ...s, isVideoOff: !s.isVideoOff } : null));
    }
  };

  const handleToggleScreenShare = async () => {
    if (webrtcServiceRef.current && activeCallState) {
      const isSharing = await webrtcServiceRef.current.toggleScreenShare(activeCallState.isScreenSharing);
      setActiveCallState((s) => (s ? { ...s, isScreenSharing: isSharing } : null));
    }
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
          onLogout={handleLogout}
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
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
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
            localStream={localStream}
            remoteStream={remoteStream}
            currentUserId={currentUser.personalId}
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
          vault.saveCurrentUser(user);
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

      {/* Incoming Call Ringing Modal */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#1E201D] text-[#F0EFEA] border-2 border-[#8EBA94] rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[#8EBA94]/20 border-2 border-[#8EBA94] flex items-center justify-center mb-4 relative">
              <Avatar name={incomingCall.fromName} size="xl" />
              <span className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[#8EBA94] text-[#1C1E1B] shadow-sm">
                {incomingCall.mode === 'video-1to1' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#F0EFEA]">{incomingCall.fromName}</h3>
            <p className="text-xs font-mono text-[#A9ABA8] mt-0.5">{incomingCall.fromId}</p>
            <p className="text-sm text-[#8EBA94] mt-2 font-medium">
              Incoming {incomingCall.mode === 'video-1to1' ? 'Video' : 'Voice'} Call...
            </p>

            <div className="flex gap-4 mt-6 w-full">
              <button
                onClick={handleDeclineCall}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#8E4B4B] hover:bg-[#783D3D] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>
              <button
                onClick={handleAcceptIncomingCall}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#8EBA94] hover:bg-[#7CA782] text-[#1C1E1B] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Phone className="w-4 h-4" />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing Calling Modal */}
      {outgoingCall && currentScreen !== 'active-call' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#1E201D] text-[#F0EFEA] border border-white/20 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4 relative">
              <Avatar name={outgoingCall.toName} size="xl" />
              <span className="absolute inset-0 rounded-full border-2 border-[#8EBA94] animate-ping opacity-75" />
            </div>
            <h3 className="text-lg font-bold text-[#F0EFEA]">{outgoingCall.toName}</h3>
            <p className="text-xs font-mono text-[#A9ABA8] mt-0.5">{outgoingCall.toId}</p>
            <p className="text-sm text-[#CBCCC7] mt-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8EBA94] animate-pulse" />
              Calling {outgoingCall.mode === 'video-1to1' ? 'video' : 'voice'}...
            </p>

            <button
              onClick={handleCancelOutgoingCall}
              className="mt-6 w-full py-3 px-4 rounded-2xl bg-[#8E4B4B] hover:bg-[#783D3D] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Cancel Call</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
