/**
 * Lunaris WebRTC Peer-to-Peer Calling Engine
 * Direct device-to-device audio & video streaming with DTLS-SRTP hardware encryption.
 * Zero server media inspection: video and audio frames flow directly between devices.
 */

export const getIceConfiguration = (): RTCConfiguration => {
  const customTurnUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL;
  const customTurnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const customTurnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  const iceServers: RTCIceServer[] = [
    // Google Public STUN Servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  if (customTurnUrl) {
    iceServers.push({
      urls: customTurnUrl,
      username: customTurnUsername,
      credential: customTurnCredential,
    });
  } else {
    // OpenRelay Public TURN Relay by Metered (High-performance global TURN for symmetric NAT & mobile cellular traversal)
    iceServers.push(
      {
        urls: 'stun:openrelay.metered.ca:80',
      },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelay',
        credential: 'openrelay',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelay',
        credential: 'openrelay',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelay',
        credential: 'openrelay',
      }
    );
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
  };
};

export const GOOGLE_STUN_SERVERS: RTCConfiguration = getIceConfiguration();

export interface WebRTCCallbackHandlers {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onSendSignal?: (signalPayload: any) => void;
  onError?: (err: Error) => void;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private handlers: WebRTCCallbackHandlers = {};
  private isCaller: boolean = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(handlers: WebRTCCallbackHandlers) {
    this.handlers = handlers;
  }

  /**
   * Acquire local camera & microphone hardware
   */
  public async startLocalMedia(options: { video: boolean; audio: boolean }): Promise<MediaStream> {
    try {
      // Release any previously held tracks
      this.stopLocalMedia();

      const constraints: MediaStreamConstraints = {
        video: options.video
          ? {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      if (this.handlers.onLocalStream) {
        this.handlers.onLocalStream(stream);
      }
      return stream;
    } catch (err: any) {
      console.error('Failed to get local media devices:', err);
      if (this.handlers.onError) {
        this.handlers.onError(new Error(err.message || 'Camera or microphone access denied.'));
      }
      throw err;
    }
  }

  /**
   * Explicitly set or update the local media stream and bind to peer connection
   */
  public setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          this.peerConnection!.addTrack(track, stream);
        }
      });
    }
    if (this.handlers.onLocalStream) {
      this.handlers.onLocalStream(stream);
    }
  }

  /**
   * Initialize RTCPeerConnection and bind event listeners
   */
  private initPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    const config = getIceConfiguration();
    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();
    if (this.handlers.onRemoteStream) {
      this.handlers.onRemoteStream(new MediaStream());
    }

    // Attach local stream tracks to WebRTC peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Listen for incoming remote tracks from peer
    pc.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream!.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream!.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      // Re-emit on track mute/unmute so UI stays in lockstep
      if (event.track) {
        event.track.onmute = () => {
          if (this.handlers.onRemoteStream && this.remoteStream) {
            this.handlers.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
          }
        };
        event.track.onunmute = () => {
          if (this.handlers.onRemoteStream && this.remoteStream) {
            this.handlers.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
          }
        };
      }

      // CRITICAL: Always construct a fresh MediaStream instance wrapper
      // so React state triggers an immediate re-render and video/audio mount
      const freshStream = new MediaStream(this.remoteStream.getTracks());
      if (this.handlers.onRemoteStream) {
        this.handlers.onRemoteStream(freshStream);
      }
    };

    // ICE Candidate generation -> send to peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && this.handlers.onSendSignal) {
        this.handlers.onSendSignal({
          callAction: 'ice_candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed:', pc.connectionState);
      if (this.handlers.onConnectionState) {
        this.handlers.onConnectionState(pc.connectionState);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC] ICE failed, attempting ICE restart...');
        pc.restartIce();
      }
    };

    return pc;
  }

  /**
   * Caller initiates call: creates and sends WebRTC SDP Offer
   */
  public async createCallOffer(): Promise<RTCSessionDescriptionInit> {
    this.isCaller = true;
    const pc = this.initPeerConnection();

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    return offer;
  }

  /**
   * Callee accepts call: sets remote offer, creates and returns SDP Answer
   */
  public async handleCallOffer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.isCaller = false;
    const pc = this.initPeerConnection();

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

    // Flush any ICE candidates that arrived before the offer was set
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate && candidate.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding buffered ICE candidate:', e);
        }
      }
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return answer;
  }

  /**
   * Caller receives SDP Answer from Callee
   */
  public async handleCallAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));

    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate && candidate.candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding buffered ICE candidate:', e);
        }
      }
    }
  }

  /**
   * Handle incoming ICE Candidate from peer
   */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate || !candidate.candidate) return;
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate:', e);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  /**
   * Audio Mute Toggle
   */
  public toggleMute(muted?: boolean): boolean {
    if (!this.localStream) return true;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = muted !== undefined ? !muted : !audioTrack.enabled;
      return !audioTrack.enabled; // returns isMuted
    }
    return true;
  }

  /**
   * Video Camera Toggle
   */
  public toggleVideo(videoOff?: boolean): boolean {
    if (!this.localStream) return true;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = videoOff !== undefined ? !videoOff : !videoTrack.enabled;
      return !videoTrack.enabled; // returns isVideoOff
    }
    return true;
  }

  /**
   * Screen Share Toggle
   */
  public async toggleScreenShare(isCurrentlySharing: boolean): Promise<boolean> {
    if (!this.peerConnection) return false;

    if (isCurrentlySharing) {
      // Revert to webcam track
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;
      }
      if (this.localStream) {
        const webcamTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && webcamTrack) {
          await sender.replaceTrack(webcamTrack);
        }
        if (this.handlers.onLocalStream) {
          this.handlers.onLocalStream(this.localStream);
        }
      }
      return false;
    } else {
      // Start screen capture
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        this.screenStream = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          this.toggleScreenShare(true);
        };

        if (this.handlers.onLocalStream) {
          this.handlers.onLocalStream(screenStream);
        }
        return true;
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
        return false;
      }
    }
  }

  /**
   * Release all media and close WebRTC peer connection
   */
  public endCall(): void {
    this.stopLocalMedia();

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.pendingCandidates = [];
  }

  public stopLocalMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}
