'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Trash2,
  Edit2,
  CornerUpLeft,
  Check,
  CheckCheck,
  Clock,
  Image as ImageIcon,
  FileText,
  Mic,
  X,
  Lock,
  Search,
  ChevronLeft,
  Timer,
  Play,
  Pause,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { PeerContact, UserProfile } from '@/types';
import { StoredLocalMessage } from '@/lib/crypto/types';
import { ClearChatModal, SafetyNumberModal } from '../ui/Modals';

interface ChatViewProps {
  currentUser: UserProfile;
  activePeer: PeerContact | null;
  connections: { connectionId: string; peer: PeerContact }[];
  messages: StoredLocalMessage[];
  onSelectPeer: (peer: PeerContact) => void;
  onSendMessage: (text: string, replyToId?: string) => Promise<void>;
  onSendEncryptedFile: (file: File) => Promise<void>;
  onSendVoiceNote: (audioBlob: Blob) => Promise<void>;
  onEditMessage: (messageId: string, newText: string) => Promise<void>;
  onDeleteMessageForSelf: (messageId: string) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onClearChat: (peerId: string) => void;
  onStartCall: (peer: PeerContact, mode: 'voice-1to1' | 'video-1to1') => void;
  onViewSafetyNumber: (peer: PeerContact) => void;
  safetyNumber: string;
  isSafetyVerified: boolean;
  onToggleSafetyVerified: (verified: boolean) => void;
  optInReadReceipts: boolean;
  disappearingTimer: number;
  onSetDisappearingTimer: (seconds: number) => void;
  onUpdateNickname?: (peerId: string, nickname: string | null) => void;
}

const EMOJI_LIST = ['🔒', '👍', '❤️', '👏', '😂', '🔥', '🙏', '🛡️'];

const TIMER_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '5 minutes', seconds: 300 },
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
];

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  activePeer,
  connections,
  messages,
  onSelectPeer,
  onSendMessage,
  onSendEncryptedFile,
  onSendVoiceNote,
  onEditMessage,
  onDeleteMessageForSelf,
  onReactMessage,
  onClearChat,
  onStartCall,
  onViewSafetyNumber,
  safetyNumber,
  isSafetyVerified,
  onToggleSafetyVerified,
  optInReadReceipts,
  disappearingTimer,
  onSetDisappearingTimer,
  onUpdateNickname,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<StoredLocalMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<StoredLocalMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId or 'input'
  const [showClearModal, setShowClearModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice recording timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecordingVoice) {
      timer = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activePeer) return;

    if (editingMessage) {
      await onEditMessage(editingMessage.id, inputText.trim());
      setEditingMessage(null);
    } else {
      await onSendMessage(inputText.trim(), replyingTo?.id);
      setReplyingTo(null);
    }
    setInputText('');
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await onSendVoiceNote(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch {
      alert('Microphone access denied or unavailable.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecordingVoice(false);
      audioChunksRef.current = [];
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onSendEncryptedFile(file);
      e.target.value = '';
    }
  };

  const filteredConnections = connections.filter(
    (c) =>
      c.peer.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.peer.personalId.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] max-w-7xl mx-auto flex overflow-hidden border-x border-[#CBCCC7] bg-[#E0E0D5]">
      {/* LEFT PANEL: Conversation list (WhatsApp style) */}
      <aside
        className={`w-full md:w-80 lg:w-96 border-r border-[#CBCCC7] bg-[#E0E0D5] flex flex-col shrink-0 transition-all ${
          activePeer ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-3.5 border-b border-[#CBCCC7]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6E746A]" />
            <input
              type="text"
              placeholder="Search chats or enter ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs text-[#1C1E1B] placeholder:text-[#6E746A] outline-hidden focus:border-[#525C51]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#CBCCC7]/40">
          {filteredConnections.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6E746A]">
              <Lock className="w-8 h-8 mx-auto mb-2 text-[#B8AB90]" />
              <p className="font-semibold text-[#1C1E1B]">No Active Conversations</p>
              <p className="mt-1">Connect with verified peers to start private messaging.</p>
            </div>
          ) : (
            filteredConnections.map(({ connectionId, peer }) => {
              const isSelected = activePeer?.personalId === peer.personalId;
              const displayName = peer.nickname || peer.displayName;
              return (
                <button
                  key={connectionId}
                  onClick={() => onSelectPeer(peer)}
                  className={`w-full p-3.5 flex items-start gap-3 text-left transition-colors ${
                    isSelected ? 'bg-[#D0CABA]' : 'hover:bg-[#CBCCC7]/50'
                  }`}
                >
                  <Avatar name={displayName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-semibold text-xs text-[#1C1E1B] truncate">{displayName}</p>
                        {peer.nickname && (
                          <span className="text-[10px] text-[#6E746A] truncate">({peer.displayName})</span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[#6E746A] shrink-0 ml-1">{peer.personalId}</span>
                    </div>
                    <p className="text-[11px] text-[#4A4E47] truncate mt-0.5">
                      {isSelected ? 'Active zero-knowledge session' : peer.bio || 'Encrypted chat available'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT PANEL: Active Direct Message Conversation */}
      {activePeer ? (
        <main className="flex-1 flex flex-col bg-[#F2F2EB] min-w-0 relative">
          {/* Chat Header */}
          <div className="h-16 px-4 border-b border-[#CBCCC7] bg-[#E0E0D5] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => onSelectPeer(null as any)}
                className="md:hidden p-1.5 rounded-lg text-[#4A4E47] hover:bg-[#CBCCC7]"
                aria-label="Back to conversations"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <Avatar name={activePeer.nickname || activePeer.displayName} size="sm" />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-xs sm:text-sm text-[#1C1E1B] truncate">
                    {activePeer.nickname || activePeer.displayName}
                  </h3>
                  {activePeer.nickname && (
                    <span className="text-[10px] text-[#6E746A] hidden sm:inline truncate">
                      ({activePeer.displayName})
                    </span>
                  )}
                  {onUpdateNickname && (
                    <button
                      onClick={() => {
                        const current = activePeer.nickname || '';
                        const newNick = window.prompt(
                          `Give a custom nickname to ${activePeer.displayName} (leave blank to remove):`,
                          current
                        );
                        if (newNick !== null) {
                          onUpdateNickname(activePeer.personalId, newNick.trim() || null);
                        }
                      }}
                      className="p-1 rounded-md text-[#6E746A] hover:text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                      title={activePeer.nickname ? `Edit nickname (${activePeer.nickname})` : 'Give a nickname'}
                    >
                      <Edit2 className="w-3 h-3 text-[#525C51]" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowSafetyModal(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#D0CABA] text-[#1C1E1B] border border-[#B8AB90] hover:bg-[#CBCCC7]"
                    title="Inspect Safety Number"
                  >
                    <ShieldCheck className={`w-3 h-3 ${isSafetyVerified ? 'text-[#476B4D]' : 'text-[#525C51]'}`} />
                    <span className="hidden sm:inline">{isSafetyVerified ? 'Verified' : 'Verify'}</span>
                  </button>
                </div>
                <p className="text-[11px] font-mono text-[#6E746A] truncate">
                  {activePeer.personalId}
                  {activePeer.nickname && <span className="sm:hidden text-[10px] ml-1.5 font-sans">({activePeer.displayName})</span>}
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Disappearing Messages Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                  className={`p-2 rounded-xl text-xs flex items-center gap-1 transition-colors ${
                    disappearingTimer > 0
                      ? 'bg-[#D0CABA] text-[#1C1E1B] border border-[#B8AB90]'
                      : 'text-[#4A4E47] hover:bg-[#CBCCC7]'
                  }`}
                  title="Disappearing messages timer"
                >
                  <Timer className="w-4 h-4 text-[#525C51]" />
                  {disappearingTimer > 0 && (
                    <span className="text-[10px] font-mono font-bold">
                      {disappearingTimer >= 86400
                        ? `${disappearingTimer / 86400}d`
                        : disappearingTimer >= 3600
                        ? `${disappearingTimer / 3600}h`
                        : `${disappearingTimer}s`}
                    </span>
                  )}
                </button>

                {showTimerMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#E0E0D5] border border-[#B8AB90] rounded-2xl p-1.5 shadow-xl z-50 animate-in fade-in">
                    <div className="px-3 py-1.5 border-b border-[#CBCCC7] mb-1">
                      <p className="text-[11px] font-semibold text-[#1C1E1B]">Disappearing Messages</p>
                      <p className="text-[10px] text-[#4A4E47]">Auto-deleted from all devices</p>
                    </div>
                    {TIMER_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        onClick={() => {
                          onSetDisappearingTimer(opt.seconds);
                          setShowTimerMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-xl flex items-center justify-between ${
                          disappearingTimer === opt.seconds
                            ? 'bg-[#525C51] text-[#F8F8F4] font-medium'
                            : 'hover:bg-[#CBCCC7] text-[#1C1E1B]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {disappearingTimer === opt.seconds && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Call Buttons */}
              <button
                onClick={() => onStartCall(activePeer, 'voice-1to1')}
                className="p-2 rounded-xl text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                title="Start Encrypted Voice Call"
                aria-label="Start voice call"
              >
                <Phone className="w-4 h-4 text-[#525C51]" />
              </button>

              <button
                onClick={() => onStartCall(activePeer, 'video-1to1')}
                className="p-2 rounded-xl text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                title="Start Encrypted Video Call"
                aria-label="Start video call"
              >
                <Video className="w-4 h-4 text-[#525C51]" />
              </button>

              {/* Chat Options Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="p-2 rounded-xl text-[#4A4E47] hover:bg-[#CBCCC7] transition-colors"
                  aria-label="Chat options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showOptionsMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#E0E0D5] border border-[#B8AB90] rounded-2xl p-1.5 shadow-xl z-50">
                    {onUpdateNickname && (
                      <button
                        onClick={() => {
                          setShowOptionsMenu(false);
                          const current = activePeer.nickname || '';
                          const newNick = window.prompt(
                            `Give a custom nickname to ${activePeer.displayName} (leave blank to remove):`,
                            current
                          );
                          if (newNick !== null) {
                            onUpdateNickname(activePeer.personalId, newNick.trim() || null);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#CBCCC7] flex items-center gap-2 text-[#1C1E1B]"
                      >
                        <Edit2 className="w-4 h-4 text-[#525C51]" />
                        <span>{activePeer.nickname ? 'Edit Nickname' : 'Give Nickname'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowSafetyModal(true);
                        setShowOptionsMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#CBCCC7] flex items-center gap-2 text-[#1C1E1B]"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#476B4D]" />
                      <span>Verify Safety Number</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowClearModal(true);
                        setShowOptionsMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#EBDADA] text-[#8E4B4B] flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Permanently Clear Chat</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Message Thread Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* E2EE Security Notice */}
            <div className="max-w-md mx-auto my-3 p-3 rounded-2xl bg-[#E0E0D5] border border-[#B8AB90] text-center shadow-2xs">
              <div className="inline-flex p-1.5 rounded-full bg-[#D0CABA] text-[#476B4D] mb-1.5">
                <Lock className="w-4 h-4" />
              </div>
              <p className="text-[11px] text-[#4A4E47] leading-relaxed">
                Messages and calls are secured with <strong>Signal Protocol-compatible Double Ratchet</strong> encryption. Plaintext never touches Lunaris servers.
              </p>
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#6E746A]">
                <p className="font-semibold text-sm text-[#1C1E1B] mb-1">Encrypted Session Ready</p>
                <p>Send a message below. Each packet is authenticated and ratcheted with forward secrecy.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser.personalId;
                const repliedMessage = msg.replyToId ? messages.find((m) => m.id === msg.replyToId) : null;
                const canEdit = isMe && Date.now() - msg.timestamp < 15 * 60 * 1000; // 15 mins

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Action buttons (Reply, React, Edit, Delete) on hover */}
                    <div
                      className={`absolute -top-7 hidden group-hover:flex items-center gap-1 p-1 rounded-xl bg-[#E0E0D5] border border-[#B8AB90] shadow-md z-10 ${
                        isMe ? 'right-0' : 'left-0'
                      }`}
                    >
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 rounded-lg hover:bg-[#CBCCC7] text-[#4A4E47]"
                        title="Reply"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                        className="p-1 rounded-lg hover:bg-[#CBCCC7] text-[#4A4E47]"
                        title="Add Reaction"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingMessage(msg);
                            setInputText(msg.text || '');
                          }}
                          className="p-1 rounded-lg hover:bg-[#CBCCC7] text-[#4A4E47]"
                          title="Edit (within 15m)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteMessageForSelf(msg.id)}
                        className="p-1 rounded-lg hover:bg-[#EBDADA] text-[#8E4B4B]"
                        title="Delete for self"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Emoji Reaction Popover */}
                    {showEmojiPicker === msg.id && (
                      <div
                        className={`absolute -top-11 z-20 flex gap-1 p-1.5 rounded-2xl bg-[#E0E0D5] border border-[#B8AB90] shadow-lg animate-in fade-in ${
                          isMe ? 'right-0' : 'left-0'
                        }`}
                      >
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              onReactMessage(msg.id, emoji);
                              setShowEmojiPicker(null);
                            }}
                            className="p-1 text-base hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-2xs border ${
                        isMe
                          ? 'bg-[#D0CABA] text-[#1C1E1B] border-[#B8AB90] rounded-br-xs'
                          : 'bg-[#E0E0D5] text-[#1C1E1B] border-[#CBCCC7] rounded-bl-xs'
                      }`}
                    >
                      {/* Quoted replied message */}
                      {repliedMessage && (
                        <div className="mb-2 p-2 rounded-xl bg-black/5 border-l-3 border-[#525C51] text-xs">
                          <p className="font-semibold text-[10px] text-[#525C51]">
                            {repliedMessage.senderId === currentUser.personalId ? 'You' : activePeer.displayName}
                          </p>
                          <p className="truncate text-[#4A4E47]">{repliedMessage.text || 'Encrypted attachment'}</p>
                        </div>
                      )}

                      {/* Attached Media / Document / Audio */}
                      {msg.file && (
                        <div className="mb-2">
                          {msg.file.mimeType.startsWith('image/') ? (
                            <div className="rounded-xl overflow-hidden border border-[#CBCCC7] bg-black/5 max-h-60 flex items-center justify-center">
                              {msg.file.dataUrl ? (
                                <img
                                  src={msg.file.dataUrl}
                                  alt={msg.file.name}
                                  className="object-cover w-full h-full max-h-60"
                                />
                              ) : (
                                <div className="p-8 text-center text-xs text-[#6E746A]">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-1 text-[#525C51]" />
                                  <span>Encrypted Image ({msg.file.name})</span>
                                </div>
                              )}
                            </div>
                          ) : msg.file.mimeType.startsWith('audio/') ? (
                            <div className="p-2.5 rounded-xl bg-[#CBCCC7]/60 flex items-center gap-3">
                              <button
                                onClick={() => {
                                  if (msg.file?.dataUrl) {
                                    const audio = new Audio(msg.file.dataUrl);
                                    audio.play();
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-[#525C51] text-[#F8F8F4] flex items-center justify-center"
                              >
                                <Play className="w-4 h-4 ml-0.5" />
                              </button>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-[#1C1E1B]">Voice Note</p>
                                <div className="h-1.5 w-full bg-[#A9ABA8] rounded-full mt-1" />
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-[#CBCCC7]/60 flex items-center gap-2 text-xs">
                              <FileText className="w-5 h-5 text-[#525C51]" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-[#1C1E1B]">{msg.file.name}</p>
                                <p className="text-[10px] text-[#6E746A]">
                                  {(msg.file.size / 1024).toFixed(0)} KB (Encrypted)
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text content */}
                      {msg.text && (
                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {msg.text}
                        </p>
                      )}

                      {/* Footer: timestamp, edit badge, delivery state */}
                      <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-[#6E746A]">
                        {msg.editedAt && <span className="italic">(edited)</span>}
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                        {isMe && (
                          <span>
                            {msg.status === 'read' && optInReadReceipts ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#476B4D]" />
                            ) : msg.status === 'delivered' || msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#6E746A]" />
                            ) : msg.status === 'sent' ? (
                              <Check className="w-3.5 h-3.5 text-[#6E746A]" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-[#B8AB90]" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Emoji Reaction Badges */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([userId, emoji]) => (
                          <span
                            key={userId}
                            className="px-1.5 py-0.5 rounded-full bg-[#E0E0D5] border border-[#CBCCC7] text-xs shadow-2xs"
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying Banner */}
          {replyingTo && (
            <div className="px-4 py-2 bg-[#D0CABA] border-t border-[#B8AB90] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <CornerUpLeft className="w-4 h-4 text-[#525C51]" />
                <span className="font-semibold text-[#1C1E1B]">
                  Replying to {replyingTo.senderId === currentUser.personalId ? 'yourself' : activePeer.displayName}:
                </span>
                <span className="truncate text-[#4A4E47]">{replyingTo.text || 'Attachment'}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 text-[#4A4E47] hover:text-[#1C1E1B]">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Editing Banner */}
          {editingMessage && (
            <div className="px-4 py-2 bg-[#D0CABA] border-t border-[#B8AB90] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#525C51]" />
                <span className="font-semibold text-[#1C1E1B]">Editing Message</span>
              </div>
              <button
                onClick={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
                className="p-1 text-[#4A4E47] hover:text-[#1C1E1B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <div className="p-3 bg-[#E0E0D5] border-t border-[#CBCCC7] shrink-0">
            {isRecordingVoice ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#F2F2EB] rounded-2xl border border-[#8E4B4B]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#8E4B4B] animate-pulse" />
                  <span className="text-xs font-mono font-semibold text-[#8E4B4B]">
                    Recording Voice Note: {recordingSeconds}s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelRecording}
                    className="p-1.5 text-xs text-[#6E746A] hover:text-[#8E4B4B]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStopRecording}
                    className="px-3 py-1 rounded-xl bg-[#525C51] text-[#F8F8F4] text-xs font-semibold hover:bg-[#434B42]"
                  >
                    Send Encrypted Audio
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,audio/*"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-[#4A4E47] hover:text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                  title="Attach encrypted file (<10MB)"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <div className="relative flex-1">
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={`Encrypted message to ${activePeer.displayName}...`}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#CBCCC7] bg-[#F2F2EB] text-xs sm:text-sm text-[#1C1E1B] placeholder:text-[#6E746A] outline-hidden focus:border-[#525C51] resize-none max-h-24"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="p-2 rounded-xl text-[#4A4E47] hover:text-[#1C1E1B] hover:bg-[#CBCCC7] transition-colors"
                  title="Record voice note"
                  aria-label="Record voice note"
                >
                  <Mic className="w-5 h-5" />
                </button>

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-xl bg-[#525C51] text-[#F8F8F4] hover:bg-[#434B42] disabled:opacity-40 transition-colors shadow-xs"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </main>
      ) : (
        /* Empty State */
        <main className="hidden md:flex flex-1 items-center justify-center bg-[#F2F2EB] p-8 text-center">
          <div className="max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[#E0E0D5] border border-[#B8AB90] text-[#525C51] flex items-center justify-center mx-auto mb-4 shadow-xs">
              <ShieldCheck className="w-8 h-8 text-[#476B4D]" />
            </div>
            <h2 className="text-xl font-serif font-bold text-[#1C1E1B] mb-2">Lunaris Encrypted Messenger</h2>
            <p className="text-xs text-[#4A4E47] leading-relaxed mb-6">
              Select an accepted contact on the left to start a ratcheted zero-knowledge direct message conversation, or initiate a secure 1:1 voice or video call.
            </p>
            <div className="p-3.5 rounded-2xl bg-[#E0E0D5] border border-[#CBCCC7] text-left text-xs space-y-2">
              <div className="flex items-center gap-2 text-[#1C1E1B] font-semibold">
                <Lock className="w-4 h-4 text-[#525C51]" />
                <span>Zero Server Footprint</span>
              </div>
              <p className="text-[11px] text-[#4A4E47]">
                Clear Chat permanently shreds the local database and keys. Relay transit packets expire after 10 minutes.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* Safety Number Modal */}
      {activePeer && (
        <SafetyNumberModal
          isOpen={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          peerId={activePeer.personalId}
          peerName={activePeer.displayName}
          safetyNumber={safetyNumber}
          isVerified={isSafetyVerified}
          onToggleVerify={onToggleSafetyVerified}
        />
      )}

      {/* Clear Chat Confirmation Modal */}
      {activePeer && (
        <ClearChatModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirm={() => onClearChat(activePeer.personalId)}
          peerName={activePeer.displayName}
        />
      )}
    </div>
  );
};
