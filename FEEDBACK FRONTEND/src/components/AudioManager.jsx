import { useEffect, useRef, useState } from 'react';

export default function AudioManager({ wsManager, userId, userType, onStatusChange }) {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteAudioRef = useRef(null);

    // STUN servers for NAT traversal
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ]
    };

    const createPeerConnection = () => {
        const pc = new RTCPeerConnection(iceServers);

        pc.onicecandidate = (event) => {
            if (event.candidate && wsManager?.isConnected()) {
                console.log('📡 Sending ICE candidate');
                wsManager.send({
                    type: 'webrtc_ice_candidate',
                    candidate: event.candidate,
                    target_id: userType === 'teacher' ? null : 'teacher'
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('🎵 Received remote audio track');
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
                remoteAudioRef.current.play();
                setIsConnected(true);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', pc.connectionState);
            setIsConnected(pc.connectionState === 'connected');
        };

        return pc;
    };

    const startAudio = async () => {
        try {
            console.log('🎤 Starting audio...');

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            setIsEnabled(true);
            setIsMuted(false);

            // Create peer connection
            peerConnectionRef.current = createPeerConnection();

            // Add audio track
            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
                console.log('🎤 Added audio track to peer connection');
            });

            // Create and send offer
            if (userType === 'teacher') {
                const offer = await peerConnectionRef.current.createOffer();
                await peerConnectionRef.current.setLocalDescription(offer);

                console.log('📤 Sending WebRTC offer');
                wsManager.send({
                    type: 'webrtc_offer',
                    offer: offer
                });
            }

            if (onStatusChange) {
                onStatusChange({ enabled: true, muted: false, connected: false });
            }

            console.log('✅ Audio started');
        } catch (error) {
            console.error('❌ Audio error:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopAudio = () => {
        console.log('🛑 Stopping audio');

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        setIsEnabled(false);
        setIsMuted(true);
        setIsConnected(false);

        if (onStatusChange) {
            onStatusChange({ enabled: false, muted: true, connected: false });
        }
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = isMuted;
            });
            setIsMuted(!isMuted);
            console.log(`🎤 ${isMuted ? 'Unmuted' : 'Muted'}`);

            if (onStatusChange) {
                onStatusChange({ enabled: isEnabled, muted: !isMuted, connected: isConnected });
            }
        }
    };

    // Handle WebRTC messages from WebSocket
    useEffect(() => {
        if (!wsManager) return;

        const handleMessage = async (message) => {
            if (message.type === 'webrtc_offer' && userType === 'student') {
                console.log('📥 Received WebRTC offer');

                if (!peerConnectionRef.current) {
                    peerConnectionRef.current = createPeerConnection();

                    if (localStreamRef.current) {
                        localStreamRef.current.getTracks().forEach(track => {
                            peerConnectionRef.current.addTrack(track, localStreamRef.current);
                        });
                    }
                }

                await peerConnectionRef.current.setRemoteDescription(message.data.offer);
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);

                console.log('📤 Sending WebRTC answer');
                wsManager.send({
                    type: 'webrtc_answer',
                    answer: answer,
                    target_id: message.data.student_id
                });
            }

            if (message.type === 'webrtc_answer' && userType === 'teacher') {
                console.log('📥 Received WebRTC answer');
                await peerConnectionRef.current.setRemoteDescription(message.data.answer);
            }

            if (message.type === 'webrtc_ice_candidate') {
                console.log('📥 Received ICE candidate');
                if (peerConnectionRef.current && message.data.candidate) {
                    await peerConnectionRef.current.addIceCandidate(message.data.candidate);
                }
            }
        };

        // This is a simplified listener - you'll need to integrate with your WebSocket message handler
        console.log('🎧 Audio manager listening for WebRTC messages');

        return () => {
            stopAudio();
        };
    }, [wsManager, userType]);

    return (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Remote audio element (hidden) */}
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

            {/* Audio Enable/Disable Button */}
            <button
                onClick={isEnabled ? stopAudio : startAudio}
                style={{
                    padding: '8px 16px',
                    backgroundColor: isEnabled ? '#22c55e' : '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}
            >
                🎤 {isEnabled ? 'Audio ON' : 'Audio OFF'}
                {isConnected && isEnabled && (
                    <span style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#22c55e',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                )}
            </button>

            {/* Mute/Unmute Button */}
            {isEnabled && (
                <button
                    onClick={toggleMute}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: isMuted ? '#ef4444' : '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                    }}
                >
                    {isMuted ? '🔇 MUTED' : '🔊 SPEAKING'}
                </button>
            )}

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}