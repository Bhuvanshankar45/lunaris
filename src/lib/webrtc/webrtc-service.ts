/**
 * Lunaris WebRTC Peer-to-Peer Calling Engine
 * Direct device-to-device audio & video streaming with DTLS-SRTP hardware encryption.
 * Zero server media inspection: video and audio frames flow directly between devices.
 */

export const GOOGLE_STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

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
   * Initialize RTCPeerConnection and bind event listeners
   */
  private initPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    const pc = new RTCPeerConnection(GOOGLE_STUN_SERVERS);
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();
    if (this.handlers.onRemoteStream) {
      this.handlers.onRemoteStream(this.remoteStream);
    }

    // Attach local stream tracks to WebRTC peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Listen for incoming remote tracks from peer
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.handlers.onRemoteStream) {
          this.handlers.onRemoteStream(event.streams[0]);
        }
      } else if (event.track) {
        this.remoteStream?.addTrack(event.track);
        if (this.handlers.onRemoteStream && this.remoteStream) {
          this.handlers.onRemoteStream(this.remoteStream);
        }
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
      if (this.handlers.onConnectionState) {
        this.handlers.onConnectionState(pc.connectionState);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
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
      if (candidate) {
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
      if (candidate) {
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
