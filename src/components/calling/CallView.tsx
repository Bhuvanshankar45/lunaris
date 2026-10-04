'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Share2,
  ShieldCheck,
  MessageSquare,
  Users,
  Pin,
  PinOff,
  Volume2,
  Lock,
  X,
  Send,
  Sparkles,
} from 'lucide-react';
import { ActiveCallState, CallParticipant } from '@/types';
import { Avatar } from '../ui/Avatar';
import { SafetyNumberModal } from '../ui/Modals';

interface CallViewProps {
  callState: ActiveCallState;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onPinParticipant: (participantId: string | null) => void;
  onSendInCallMessage: (text: string) => void;
  inCallMessages: { id: string; senderName: string; text: string; time: string }[];
  safetyNumber: string;
  isSafetyVerified: boolean;
  onToggleSafetyVerified: (v: boolean) => void;
}

export const CallView: React.FC<CallViewProps> = ({
  callState,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onPinParticipant,
  onSendInCallMessage,
  inCallMessages,
  safetyNumber,
  isSafetyVerified,
  onToggleSafetyVerified,
}) => {
  const [callDuration, setCallDuration] = useState('00:00');
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Call duration counter
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callState.startTime) / 1000);
      const mins = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setCallDuration(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState.startTime]);

  // Simulate subtle active speaker changes for realistic Meet feel
  useEffect(() => {
    const speakerInterval = setInterval(() => {
      setActiveSpeakerIndex((prev) => (prev + 1) % Math.max(1, callState.participants.length));
    }, 4500);
    return () => clearInterval(speakerInterval);
  }, [callState.participants.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [inCallMessages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendInCallMessage(chatInput.trim());
    setChatInput('');
  };

  const pinnedParticipant = callState.participants.find(
    (p) => p.id === callState.pinnedParticipantId
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#151614] text-[#F0EFEA] overflow-hidden relative select-none">
      {/* Top Overlay Bar: Room Title, E2EE Shield, Timer */}
      <header className="h-14 px-4 sm:px-6 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-tight text-[#CBCCC7]">
            {callState.roomTitle}
          </span>
          <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-white/30" />
          <button
            onClick={() => setShowSafetyModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#525C51]/80 hover:bg-[#525C51] text-xs font-medium text-[#CBCCC7] border border-[#B8AB90]/30 transition-colors"
            title="Inspect Call Safety Number"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#8EBA94]" />
            <span className="hidden md:inline">DTLS-SRTP Encrypted</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-[#CBCCC7] bg-white/10 px-2.5 py-1 rounded-lg">
            {callDuration}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#A9ABA8]">
            <Lock className="w-3.5 h-3.5 text-[#B8AB90]" />
            <span className="hidden sm:inline">Zero Recording</span>
          </div>
        </div>
      </header>

      {/* Main Video Grid Body (Google Meet Style) */}
      <div className="flex-1 relative flex overflow-hidden p-3 sm:p-4">
        {/* Main Grid or Pinned Mode */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {pinnedParticipant ? (
            /* PINNED / SPOTLIGHT MODE */
            <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
              {/* Large Spotlight Participant */}
              <div className="flex-1 rounded-3xl bg-[#1E201D] border-2 border-[#B8AB90] overflow-hidden relative shadow-2xl flex items-center justify-center">
                {pinnedParticipant.isVideoOff ? (
                  <div className="flex flex-col items-center">
                    <Avatar name={pinnedParticipant.displayName} size="xl" />
                    <p className="mt-3 font-semibold text-base text-[#F0EFEA]">
                      {pinnedParticipant.displayName}
                    </p>
                    <span className="text-xs text-[#A9ABA8] font-mono">
                      {pinnedParticipant.personalId}
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#282B26] flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-radial from-transparent to-black/30" />
                    <div className="flex flex-col items-center">
                      <Avatar name={pinnedParticipant.displayName} size="lg" />
                      <p className="mt-2 font-medium text-sm text-[#CBCCC7]">
                        {pinnedParticipant.displayName} (Video Stream)
                      </p>
                    </div>
                  </div>
                )}

                {/* Unpin button */}
                <button
                  onClick={() => onPinParticipant(null)}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs border border-white/20 transition-all"
                  title="Unpin participant"
                >
                  <PinOff className="w-4 h-4" />
                </button>

                {/* Bottom Tile Info */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs">
                  <span className="font-medium text-[#F0EFEA]">{pinnedParticipant.displayName}</span>
                  {pinnedParticipant.isMuted && <MicOff className="w-3.5 h-3.5 text-[#E28888]" />}
                </div>
              </div>

              {/* Side Filmstrip of other participants */}
              <div className="lg:w-64 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto shrink-0">
                {callState.participants
                  .filter((p) => p.id !== pinnedParticipant.id)
                  .map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onPinParticipant(p.id)}
                      className="w-44 lg:w-full h-28 lg:h-36 rounded-2xl bg-[#1E201D] border border-white/10 relative overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#B8AB90] transition-colors shrink-0"
                    >
                      <Avatar name={p.displayName} size="md" />
                      <span className="absolute bottom-2 left-2 text-[11px] font-medium text-white px-2 py-0.5 rounded-md bg-black/60 truncate max-w-[80%]">
                        {p.displayName}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* RESPONSIVE GRID MODE (Google Meet Layout) */
            <div
              className={`flex-1 grid gap-3 min-h-0 ${
                callState.participants.length === 1
                  ? 'grid-cols-1'
                  : callState.participants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : callState.participants.length <= 4
                  ? 'grid-cols-2'
                  : 'grid-cols-2 md:grid-cols-3'
              }`}
            >
              {callState.participants.map((participant, index) => {
                const isSpeaking = index === activeSpeakerIndex;
                return (
                  <div
                    key={participant.id}
                    className={`rounded-3xl bg-[#1E201D] relative overflow-hidden flex items-center justify-center transition-all shadow-lg ${
                      isSpeaking
                        ? 'border-2 border-[#A9ABA8] ring-4 ring-[#A9ABA8]/20'
                        : 'border border-white/10'
                    }`}
                  >
                    {participant.isVideoOff ? (
                      <div className="flex flex-col items-center p-4">
                        <Avatar name={participant.displayName} size="lg" />
                        <p className="mt-2.5 font-semibold text-sm text-[#F0EFEA]">
                          {participant.displayName}
                        </p>
                        <span className="text-[11px] font-mono text-[#A9ABA8]">
                          {participant.personalId}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-[#282B26] flex items-center justify-center relative">
                        <div className="flex flex-col items-center">
                          <Avatar name={participant.displayName} size="md" />
                          <p className="mt-2 text-xs font-medium text-[#CBCCC7]">
                            {participant.displayName}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pin button on hover */}
                    <button
                      onClick={() => onPinParticipant(participant.id)}
                      className="absolute top-3 right-3 p-2 rounded-xl bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs opacity-0 hover:opacity-100 transition-opacity"
                      title="Pin to main spotlight"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {/* Tile Bottom Info Badge */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs">
                      <span className="font-medium text-[#F0EFEA] truncate max-w-[120px]">
                        {participant.displayName}
                      </span>
                      {participant.isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-[#E28888]" />
                      ) : isSpeaking ? (
                        <span className="w-2 h-2 rounded-full bg-[#8EBA94] animate-pulse" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* IN-CALL ENCRYPTED CHAT DRAWER */}
        {showChatDrawer && (
          <aside className="w-80 lg:w-96 bg-[#1E201D] border-l border-white/10 rounded-2xl ml-3 flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#A9ABA8]" />
                <h3 className="font-semibold text-xs text-[#F0EFEA]">In-Call Encrypted Messages</h3>
              </div>
              <button
                onClick={() => setShowChatDrawer(false)}
                className="p-1 rounded-lg text-[#A9ABA8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-black/20 border-b border-white/5 text-[11px] text-[#A9ABA8] flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#B8AB90]" />
              <span>In-call chat automatically disappears when call ends.</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {inCallMessages.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#A9ABA8]">
                  <p>No messages sent yet during this call.</p>
                </div>
              ) : (
                inCallMessages.map((msg) => (
                  <div key={msg.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-[#CBCCC7]">{msg.senderName}</span>
                      <span className="text-[10px] text-[#A9ABA8]">{msg.time}</span>
                    </div>
                    <p className="text-xs text-[#F0EFEA]">{msg.text}</p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="p-3 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send encrypted note to call..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-xs text-white placeholder:text-[#A9ABA8] outline-hidden focus:border-[#A9ABA8]"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-[#525C51] text-white hover:bg-[#434B42] disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}

        {/* PARTICIPANTS DRAWER */}
        {showParticipantsDrawer && (
          <aside className="w-72 bg-[#1E201D] border-l border-white/10 rounded-2xl ml-3 flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#A9ABA8]" />
                <h3 className="font-semibold text-xs text-[#F0EFEA]">
                  Participants ({callState.participants.length})
                </h3>
              </div>
              <button
                onClick={() => setShowParticipantsDrawer(false)}
                className="p-1 rounded-lg text-[#A9ABA8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {callState.participants.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.displayName} size="sm" />
                    <div>
                      <p className="font-medium text-xs text-[#F0EFEA]">{p.displayName}</p>
                      <p className="text-[10px] font-mono text-[#A9ABA8]">{p.personalId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-[#E28888]" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-[#8EBA94]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Bottom Control Bar (Google Meet Pill) */}
      <footer className="h-20 bg-black/60 backdrop-blur-lg border-t border-white/10 flex items-center justify-center px-4 gap-2 sm:gap-3 shrink-0 z-20">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMute}
          className={`p-3.5 rounded-2xl transition-all ${
            callState.isMuted
              ? 'bg-[#8E4B4B] text-white hover:bg-[#783D3D]'
              : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title={callState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={callState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-3.5 rounded-2xl transition-all ${
            callState.isVideoOff
              ? 'bg-[#8E4B4B] text-white hover:bg-[#783D3D]'
              : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title={callState.isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          aria-label={callState.isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {callState.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3.5 rounded-2xl transition-all hidden sm:block ${
            callState.isScreenSharing
              ? 'bg-[#8EBA94] text-[#1C1E1B]'
              : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title="Share your screen"
          aria-label="Share screen"
        >
          <Share2 className="w-5 h-5" />
        </button>

        {/* Safety Number Inspection */}
        <button
          onClick={() => setShowSafetyModal(true)}
          className="p-3.5 rounded-2xl bg-white/15 text-white hover:bg-white/25 transition-all"
          title="Inspect Call Safety Number"
          aria-label="Inspect call safety number"
        >
          <ShieldCheck className={`w-5 h-5 ${isSafetyVerified ? 'text-[#8EBA94]' : 'text-[#CBCCC7]'}`} />
        </button>

        {/* In-Call Chat Drawer Toggle */}
        <button
          onClick={() => {
            setShowChatDrawer(!showChatDrawer);
            setShowParticipantsDrawer(false);
          }}
          className={`p-3.5 rounded-2xl transition-all relative ${
            showChatDrawer ? 'bg-[#525C51] text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title="In-call chat"
          aria-label="Toggle in-call chat"
        >
          <MessageSquare className="w-5 h-5" />
          {inCallMessages.length > 0 && !showChatDrawer && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#8E4B4B]" />
          )}
        </button>

        {/* Participants Drawer Toggle */}
        <button
          onClick={() => {
            setShowParticipantsDrawer(!showParticipantsDrawer);
            setShowChatDrawer(false);
          }}
          className={`p-3.5 rounded-2xl transition-all ${
            showParticipantsDrawer ? 'bg-[#525C51] text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title="Participants list"
          aria-label="Toggle participants list"
        >
          <Users className="w-5 h-5" />
        </button>

        {/* RED LEAVE / END CALL BUTTON */}
        <button
          onClick={onEndCall}
          className="ml-2 sm:ml-4 px-6 py-3.5 rounded-2xl bg-[#8E4B4B] hover:bg-[#783D3D] text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md hover:scale-105"
          title="End call permanently"
          aria-label="End call"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </footer>

      {/* Safety Number Modal */}
      <SafetyNumberModal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        peerId={callState.initiatorId}
        peerName="Active Call Peer"
        safetyNumber={safetyNumber}
        isVerified={isSafetyVerified}
        onToggleVerify={onToggleSafetyVerified}
      />
    </div>
  );
};
