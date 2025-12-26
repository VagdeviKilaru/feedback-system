import { useState, useEffect, useRef, useCallback } from 'react';
import VideoCapture from './VideoCapture';
import { WebSocketManager } from '../utils/websocket';
import { initializeMediaPipe, extractAttentionFeatures } from '../utils/mediapipe';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function StudentView() {
    const [studentId] = useState(() => `student_${Math.random().toString(36).substr(2, 9)}`);
    const [studentName, setStudentName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [currentStatus, setCurrentStatus] = useState('attentive');
    const [cameraActive, setCameraActive] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Tabs
    const [activeTab, setActiveTab] = useState('camera');
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');

    const wsRef = useRef(null);
    const videoRef = useRef(null);
    const mediaPipeRef = useRef(null);
    const updateIntervalRef = useRef(null);
    const latestFeaturesRef = useRef(null);
    const chatEndRef = useRef(null);

    const getStatusColor = (status) => {
        const colors = {
            attentive: '#22c55e',
            looking_away: '#f59e0b',
            drowsy: '#ef4444',
            distracted: '#f97316',
        };
        return colors[status] || '#6b7280';
    };

    const getStatusLabel = (status) => {
        const labels = {
            attentive: 'ATTENTIVE',
            looking_away: 'LOOKING AWAY',
            drowsy: 'DROWSY',
            distracted: 'DISTRACTED',
        };
        return labels[status] || 'UNKNOWN';
    };

    const analyzeAttention = (features) => {
        if (!features) return 'attentive';

        const ear = features.eye_aspect_ratio || 1.0;
        const pitch = Math.abs(features.head_pose?.pitch || 0);
        const yaw = Math.abs(features.head_pose?.yaw || 0);

        // RULE 1: Head turned = Looking Away
        if (pitch > 25 || yaw > 25) {
            console.log('👀 HEAD TURNED - LOOKING AWAY:', { pitch, yaw });
            return 'looking_away';
        }

        // RULE 2: Eyes closed = Drowsy
        if (ear < 0.20) {
            console.log('😴 EYES CLOSED - DROWSY:', ear);
            return 'drowsy';
        }

        // RULE 3: Normal = Attentive
        return 'attentive';
    };

    const handleMediaPipeResults = useCallback((results) => {
        const extractedFeatures = extractAttentionFeatures(results);
        if (extractedFeatures) {
            latestFeaturesRef.current = extractedFeatures;

            const status = analyzeAttention(extractedFeatures);
            setCurrentStatus(status);

            if (!cameraActive) {
                setCameraActive(true);
            }
        }
    }, [cameraActive]);

    const handleVideoReady = useCallback(async (video) => {
        if (!video || !isJoined) return;

        videoRef.current = video;

        try {
            let retries = 3;
            let lastError;

            while (retries > 0) {
                try {
                    const { faceMesh, camera } = await initializeMediaPipe(video, handleMediaPipeResults);
                    mediaPipeRef.current = { faceMesh, camera };
                    return;
                } catch (err) {
                    lastError = err;
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            throw lastError;

        } catch (err) {
            console.error('MediaPipe init failed:', err);
            setCameraActive(false);
        }
    }, [isJoined, handleMediaPipeResults]);

    // WebSocket
    useEffect(() => {
        if (!isJoined || !roomId) return;

        const wsUrl = `${WS_URL}/ws/student/${roomId}/${studentId}?name=${encodeURIComponent(studentName)}`;

        wsRef.current = new WebSocketManager(wsUrl, (message) => {
            if (message.type === 'error') {
                console.error('WS Error:', message.message);
            } else if (message.type === 'participant_list') {
                setParticipants(message.data.participants);
            } else if (message.type === 'student_join') {
                setParticipants(prev => {
                    const exists = prev.some(p => p.id === message.data.student_id);
                    if (exists) return prev;
                    return [...prev, {
                        id: message.data.student_id,
                        name: message.data.student_name,
                        type: 'student'
                    }];
                });
            } else if (message.type === 'student_leave') {
                setParticipants(prev => prev.filter(p => p.id !== message.data.student_id));
            } else if (message.type === 'chat_message') {
                setMessages(prev => [...prev, message.data]);
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        });

        wsRef.current.connect()
            .then(() => {
                setIsConnected(true);
            })
            .catch(() => {
                setIsConnected(false);
            });

        return () => {
            if (wsRef.current) {
                wsRef.current.disconnect();
            }
        };
    }, [isJoined, roomId, studentId, studentName]);

    // Send updates every 300ms
    useEffect(() => {
        if (!isJoined || !isConnected || !cameraActive) return;

        updateIntervalRef.current = setInterval(() => {
            if (latestFeaturesRef.current && wsRef.current?.isConnected()) {
                wsRef.current.send({
                    type: 'attention_update',
                    data: latestFeaturesRef.current,
                });
            }
        }, 300);

        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
        };
    }, [isJoined, isConnected, cameraActive]);

    const handleJoinClass = () => {
        if (studentName.trim() && roomId.trim() && roomId.length === 6) {
            setIsJoined(true);
        }
    };

    const handleLeaveClass = () => {
        setIsJoined(false);
        if (wsRef.current) {
            wsRef.current.disconnect();
        }
        if (mediaPipeRef.current?.camera) {
            mediaPipeRef.current.camera.stop();
        }
        setCameraActive(false);
    };

    const sendMessage = () => {
        if (messageInput.trim() && wsRef.current?.isConnected()) {
            wsRef.current.send({
                type: 'chat_message',
                message: messageInput.trim()
            });
            setMessageInput('');
        }
    };

    if (!isJoined) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px',
            }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    maxWidth: '450px',
                    width: '100%',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎓</div>
                        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
                            Join Online Class
                        </h1>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                            Your Name
                        </label>
                        <input
                            type="text"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            placeholder="Enter your name"
                            style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none' }}
                        />
                    </div>

                    <div style={{ marginBottom: '28px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                            Room Code
                        </label>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinClass()}
                            placeholder="ENTER CODE"
                            maxLength={6}
                            style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '24px', outline: 'none', textTransform: 'uppercase', letterSpacing: '8px', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center' }}
                        />
                    </div>

                    <button
                        onClick={handleJoinClass}
                        disabled={!studentName.trim() || roomId.length !== 6}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: (studentName.trim() && roomId.length === 6) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '18px',
                            fontWeight: '700',
                            cursor: (studentName.trim() && roomId.length === 6) ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Join Class
                    </button>
                </div>
            </div>
        );
    }

    // Mobile view - check screen width
    const isMobile = window.innerWidth < 768;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: isMobile ? '10px' : '20px' }}>
            {/* Header */}
            <div style={{ backgroundColor: 'white', padding: '12px 16px', marginBottom: '12px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <h2 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>{studentName}</h2>
                        <p style={{ margin: '2px 0 0 0', color: '#6b7280', fontSize: isMobile ? '11px' : '13px' }}>
                            Room: <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#667eea' }}>{roomId}</span>
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '6px 12px', backgroundColor: isConnected ? '#dcfce7' : '#fee2e2', borderRadius: '16px', fontSize: '11px', fontWeight: '600' }}>
                            {isConnected ? '● Connected' : '● Offline'}
                        </div>

                        {isMobile && (
                            <button
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                style={{ padding: '6px 12px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                            >
                                ☰
                            </button>
                        )}

                        <button
                            onClick={handleLeaveClass}
                            style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                            Leave
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobile && showMobileMenu && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <button onClick={() => { setActiveTab('camera'); setShowMobileMenu(false); }} style={{ width: '100%', padding: '10px', marginBottom: '8px', background: activeTab === 'camera' ? '#667eea' : 'white', color: activeTab === 'camera' ? 'white' : '#111827', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                            📹 Camera
                        </button>
                        <button onClick={() => { setActiveTab('participants'); setShowMobileMenu(false); }} style={{ width: '100%', padding: '10px', marginBottom: '8px', background: activeTab === 'participants' ? '#667eea' : 'white', color: activeTab === 'participants' ? 'white' : '#111827', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                            👥 Participants ({participants.length})
                        </button>
                        <button onClick={() => { setActiveTab('chat'); setShowMobileMenu(false); }} style={{ width: '100%', padding: '10px', background: activeTab === 'chat' ? '#667eea' : 'white', color: activeTab === 'chat' ? 'white' : '#111827', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                            💬 Chat
                        </button>
                    </div>
                )}
            </div>

            {/* Desktop Tab Navigation */}
            {!isMobile && (
                <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '12px', marginBottom: '12px', display: 'flex', gap: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                    <button onClick={() => setActiveTab('camera')} style={{ flex: 1, padding: '12px', background: activeTab === 'camera' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'camera' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                        📹 Camera
                    </button>
                    <button onClick={() => setActiveTab('participants')} style={{ flex: 1, padding: '12px', background: activeTab === 'participants' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'participants' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                        👥 Participants ({participants.length})
                    </button>
                    <button onClick={() => setActiveTab('chat')} style={{ flex: 1, padding: '12px', background: activeTab === 'chat' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'chat' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                        💬 Chat
                    </button>
                </div>
            )}

            {/* Content */}
            <div style={{ backgroundColor: 'white', padding: isMobile ? '12px' : '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', minHeight: isMobile ? '400px' : '500px' }}>
                {activeTab === 'camera' && (
                    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                        <VideoCapture
                            ref={videoRef}
                            onVideoReady={handleVideoReady}
                            isActive={isJoined}
                            showMirror={true}
                        />

                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                            <div style={{
                                display: 'inline-block',
                                padding: '12px 28px',
                                borderRadius: '24px',
                                backgroundColor: getStatusColor(currentStatus),
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: isMobile ? '16px' : '18px',
                                boxShadow: `0 4px 12px ${getStatusColor(currentStatus)}66`,
                            }}>
                                {getStatusLabel(currentStatus)}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'participants' && (
                    <div>
                        <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
                            Participants ({participants.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {participants.map(p => (
                                <div key={p.id} style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                            {p.name}
                                            {p.id === studentId && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#667eea', fontWeight: '700' }}>(You)</span>}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {p.type === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? '400px' : '500px' }}>
                        <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>Chat</h3>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px', marginBottom: '12px' }}>
                            {messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: '30px', fontSize: '13px' }}>No messages yet</div>
                            ) : (
                                messages.map((msg, index) => (
                                    <div key={index} style={{ marginBottom: '10px', padding: '10px', backgroundColor: msg.user_type === 'teacher' ? '#eff6ff' : 'white', borderRadius: '8px', border: `2px solid ${msg.user_type === 'teacher' ? '#3b82f6' : '#e5e7eb'}` }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                                            {msg.user_name}{msg.user_type === 'teacher' && ' 👨‍🏫'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#374151' }}>{msg.message}</div>
                                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                                            {new Date(msg.timestamp).toLocaleTimeString('en-US', { timeZone: 'GMT' })}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Type..."
                                style={{ flex: 1, padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!messageInput.trim()}
                                style={{ padding: '10px 20px', background: messageInput.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d1d5db', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: messageInput.trim() ? 'pointer' : 'not-allowed' }}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}