import { useEffect, useRef, useState } from 'react';

export default function AudioManager({ wsManager, userId, userType, onStatusChange }) {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const messageHandlerRef = useRef(null);

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
                    target_id: userType === 'student' ? 'teacher' : null
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('🎵 Received remote audio track');
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
                remoteAudioRef.current.play().catch(e => console.error('Audio play error:', e));
                setIsConnected(true);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', pc.connectionState);
            setIsConnected(pc.connectionState === 'connected');

            if (onStatusChange) {
                onStatusChange({
                    enabled: isEnabled,
                    muted: isMuted,
                    connected: pc.connectionState === 'connected'
                });
            }
        };

        return pc;
    };

    const startAudio = async () => {
        try {
            console.log('🎤 Starting audio...');

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

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

            // Teacher creates and sends offer
            if (userType === 'teacher') {
                const offer = await peerConnectionRef.current.createOffer();
                await peerConnectionRef.current.setLocalDescription(offer);

                console.log('📤 Teacher sending WebRTC offer');
                wsManager.send({
                    type: 'webrtc_offer',
                    offer: offer
                });
            }

            if (onStatusChange) {
                onStatusChange({ enabled: true, muted: false, connected: false });
            }

            console.log('✅ Audio started successfully');
        } catch (error) {
            console.error('❌ Audio start error:', error);
            alert('Could not access microphone. Please check browser permissions.');
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

    // Handle WebRTC signaling messages
    useEffect(() => {
        if (!wsManager) return;

        const handleWebRTCMessage = async (message) => {
            if (!peerConnectionRef.current && isEnabled) {
                console.log('⚠️ No peer connection but audio enabled, creating one...');
                peerConnectionRef.current = createPeerConnection();

                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(track => {
                        peerConnectionRef.current.addTrack(track, localStreamRef.current);
                    });
                }
            }

            if (!peerConnectionRef.current) {
                console.log('⚠️ No peer connection to handle message');
                return;
            }

            try {
                if (message.type === 'webrtc_offer' && userType === 'student') {
                    console.log('📥 Student received WebRTC offer');

                    await peerConnectionRef.current.setRemoteDescription(message.data.offer);
                    const answer = await peerConnectionRef.current.createAnswer();
                    await peerConnectionRef.current.setLocalDescription(answer);

                    console.log('📤 Student sending WebRTC answer');
                    wsManager.send({
                        type: 'webrtc_answer',
                        answer: answer,
                        target_id: message.data.student_id
                    });
                }

                if (message.type === 'webrtc_answer' && userType === 'teacher') {
                    console.log('📥 Teacher received WebRTC answer');
                    await peerConnectionRef.current.setRemoteDescription(message.data.answer);
                }

                if (message.type === 'webrtc_ice_candidate') {
                    console.log('📥 Received ICE candidate');
                    if (message.data.candidate) {
                        await peerConnectionRef.current.addIceCandidate(message.data.candidate);
                    }
                }
            } catch (error) {
                console.error('❌ WebRTC signaling error:', error);
            }
        };

        // Store the handler
        messageHandlerRef.current = handleWebRTCMessage;

        console.log('🎧 AudioManager ready for WebRTC messages');

        return () => {
            stopAudio();
        };
    }, [wsManager, userType, isEnabled, isMuted, isConnected]);

    // Expose message handler to wsManager
    useEffect(() => {
        if (wsManager && messageHandlerRef.current) {
            wsManager.audioMessageHandler = messageHandlerRef.current;
        }
    }, [wsManager]);

    return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Hidden audio element for remote stream */}
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
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                )}
            </button>

            {/* Mute/Unmute Button (only visible when audio is enabled) */}
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
                    {isMuted ? '🔇 Muted' : '🔊 Speaking'}
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