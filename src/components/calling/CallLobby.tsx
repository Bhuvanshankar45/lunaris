'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  ShieldCheck,
  Volume2,
  Users,
  ArrowRight,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { CallMode, PeerContact } from '@/types';

interface CallLobbyProps {
  mode: CallMode;
  peerContact: PeerContact | null;
  roomCode: string;
  onJoin: (options: { isMuted: boolean; isVideoOff: boolean; stream?: MediaStream }) => void;
  onCancel: () => void;
}

export const CallLobby: React.FC<CallLobbyProps> = ({
  mode,
  peerContact,
  roomCode,
  onJoin,
  onCancel,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(mode === 'voice-1to1');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isJoiningRef = useRef<boolean>(false);

  // Initialize media devices
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: mode !== 'voice-1to1',
          audio: true,
        });

        localStreamRef.current = stream;
        setHasPermission(true);

        if (videoRef.current && mode !== 'voice-1to1') {
          videoRef.current.srcObject = stream;
        }

        // Setup audio level meter
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudioLevel = () => {
          if (analyser) {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          }
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      } catch (err) {
        console.warn('Media access error in lobby:', err);
        setHasPermission(false);
      }
    }

    initMedia();

    return () => {
      if (localStreamRef.current && !isJoiningRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [mode]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-[#EAEAE0]">
      <div className="w-full max-w-4xl bg-[#E0E0D5] border border-[#B8AB90] rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Google Meet-style Camera Preview */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full aspect-video rounded-2xl bg-[#1C1E1B] overflow-hidden relative shadow-inner border border-[#CBCCC7] flex items-center justify-center">
              {mode !== 'voice-1to1' && !isVideoOff && hasPermission ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-[#CBCCC7]">
                  <div className="w-16 h-16 rounded-full bg-[#525C51] text-[#F8F8F4] flex items-center justify-center mb-3">
                    {mode === 'voice-1to1' ? (
                      <Volume2 className="w-8 h-8 text-[#CBCCC7]" />
                    ) : (
                      <VideoOff className="w-8 h-8 text-[#CBCCC7]" />
                    )}
                  </div>
                  <p className="text-sm font-medium">
                    {mode === 'voice-1to1' ? 'Private Voice Call' : 'Camera is Turned Off'}
                  </p>
                  <p className="text-xs text-[#A9ABA8] mt-1">
                    {hasPermission === false
                      ? 'Camera/microphone permissions needed'
                      : 'You can turn video on anytime during the call'}
                  </p>
                </div>
              )}

              {/* Floating Media Toggles inside Preview */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/20">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-3 rounded-xl transition-all ${
                    isMuted ? 'bg-[#8E4B4B] text-[#F8F8F4]' : 'bg-[#525C51] text-[#F8F8F4] hover:bg-[#434B42]'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {mode !== 'voice-1to1' && (
                  <button
                    type="button"
                    onClick={toggleVideo}
                    className={`p-3 rounded-xl transition-all ${
                      isVideoOff
                        ? 'bg-[#8E4B4B] text-[#F8F8F4]'
                        : 'bg-[#525C51] text-[#F8F8F4] hover:bg-[#434B42]'
                    }`}
                    title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                    aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                  >
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Mic Level Visualizer Bar */}
            <div className="w-full mt-3 flex items-center gap-2 px-1">
              <Volume2 className="w-4 h-4 text-[#525C51]" />
              <div className="flex-1 h-2 rounded-full bg-[#CBCCC7] overflow-hidden">
                <div
                  className="h-full bg-[#476B4D] transition-all duration-75"
                  style={{ width: `${isMuted ? 0 : micLevel}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#6E746A]">
                {isMuted ? 'Muted' : `${micLevel}%`}
              </span>
            </div>
          </div>

          {/* Right Column: Join Call Info & Controls */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D0CABA] text-[#525C51] text-xs font-semibold mb-4 border border-[#B8AB90]">
                <ShieldCheck className="w-4 h-4 text-[#476B4D]" />
                <span>WebRTC DTLS-SRTP Encrypted</span>
              </div>

              <h2 className="text-2xl font-serif font-bold text-[#1C1E1B] mb-2">Ready to Connect?</h2>

              {peerContact ? (
                <div className="p-3.5 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7] mb-6">
                  <p className="text-xs text-[#6E746A]">One-to-One Private Call with:</p>
                  <p className="text-sm font-bold text-[#1C1E1B] mt-0.5">{peerContact.displayName}</p>
                  <p className="text-xs font-mono text-[#525C51]">{peerContact.personalId}</p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#F2F2EB] border border-[#CBCCC7] mb-6">
                  <p className="text-xs text-[#6E746A]">Google Meet-Style Group Room:</p>
                  <p className="text-sm font-bold text-[#1C1E1B] mt-0.5">Lunaris Sanctuary Meeting</p>
                  <p className="text-xs font-mono text-[#525C51]">Code: {roomCode}</p>
                </div>
              )}

              {/* Zero Recording Assurance */}
              <div className="space-y-2 text-xs text-[#4A4E47] mb-8 bg-[#D0CABA]/40 p-3 rounded-xl border border-[#B8AB90]">
                <div className="flex items-center gap-1.5 font-semibold text-[#1C1E1B]">
                  <Lock className="w-3.5 h-3.5 text-[#525C51]" />
                  <span>Zero Server Recording Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Call audio and video streams flow directly peer-to-peer. No recordings or transcripts are ever stored.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  isJoiningRef.current = true;
                  onJoin({
                    isMuted,
                    isVideoOff,
                    stream: localStreamRef.current || undefined,
                  });
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#525C51] text-[#F8F8F4] text-sm font-semibold hover:bg-[#434B42] transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Join Call Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2.5 px-6 rounded-2xl border border-[#B8AB90] text-xs font-medium text-[#4A4E47] hover:bg-[#CBCCC7] transition-colors"
              >
                Cancel and Return
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
