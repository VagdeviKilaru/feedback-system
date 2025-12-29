import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentCamera from '../components/StudentCamera';
import { WebSocketManager } from '../utils/websocket';
import { formatTimeIST } from '../utils/detection';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function StudentPage() {
    const navigate = useNavigate();
    const [studentId] = useState(() => `student_${Math.random().toString(36).substr(2, 9)}`);
    const [studentName, setStudentName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [activeTab, setActiveTab] = useState('camera');
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [connectionError, setConnectionError] = useState(null);

    const wsRef = useRef(null);
    const chatEndRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // WebSocket connection with reconnection logic
    useEffect(() => {
        if (!isJoined || !roomId) return;

        let mounted = true;

        const connectWebSocket = () => {
            if (!mounted) return;

            const wsUrl = `${WS_URL}/ws/student/${roomId}/${studentId}?name=${encodeURIComponent(studentName)}`;

            wsRef.current = new WebSocketManager(wsUrl, (message) => {
                if (!mounted) return;

                if (message.type === 'error') {
                    setConnectionError(message.message);
                    setIsConnected(false);
                } else if (message.type === 'participant_list') {
                    setParticipants(message.data.participants);
                    setConnectionError(null);
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
                    if (mounted) {
                        setIsConnected(true);
                        setConnectionError(null);
                    }
                })
                .catch((err) => {
                    if (mounted) {
                        setIsConnected(false);
                        setConnectionError('Failed to connect');
                        // Try reconnecting after 3 seconds
                        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
                    }
                });
        };

        connectWebSocket();

        return () => {
            mounted = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.disconnect();
            }
        };
    }, [isJoined, roomId, studentId, studentName]);

    const handleStatusChange = (detectionData) => {
        console.log('📊 Detection:', detectionData);
        if (wsRef.current?.isConnected()) {
            wsRef.current.send({
                type: 'attention_update',
                data: detectionData,
            });
            console.log('✅ Sent to server');
        } else {
            console.log('❌ WebSocket not connected');
        }
    };
    const handleFrameCapture = (frameData) => {
        if (wsRef.current?.isConnected()) {
            wsRef.current.send({
                type: 'camera_frame',
                frame: frameData,
            });
        }
    };

    const handleJoinClass = () => {
        if (studentName.trim() && roomId.trim() && roomId.length === 6) {
            setIsJoined(true);
        }
    };

    const handleLeaveClass = () => {
        if (confirm('Leave class?')) {
            if (wsRef.current) wsRef.current.disconnect();
            setIsJoined(false);
            navigate('/');
        }
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
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                            Join Class
                        </h1>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                marginTop: '12px',
                                padding: '8px 16px',
                                backgroundColor: '#f3f4f6',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            ← Back to Home
                        </button>
                    </div>

                    <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Your Name"
                        style={{
                            width: '100%',
                            padding: '14px',
                            marginBottom: '16px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '10px',
                            fontSize: '16px',
                        }}
                    />

                    <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === 'Enter' && handleJoinClass()}
                        placeholder="ROOM CODE"
                        maxLength={6}
                        style={{
                            width: '100%',
                            padding: '14px',
                            marginBottom: '24px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '10px',
                            fontSize: '24px',
                            textAlign: 'center',
                            letterSpacing: '8px',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                        }}
                    />

                    <button
                        onClick={handleJoinClass}
                        disabled={!studentName.trim() || roomId.length !== 6}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: (studentName.trim() && roomId.length === 6)
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            cursor: (studentName.trim() && roomId.length === 6) ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Join Class
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: 'white',
                padding: '16px 24px',
                marginBottom: '20px',
                borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                        {studentName}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
                        Room: <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{roomId}</span>
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                        padding: '8px 16px',
                        backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600',
                    }}>
                        {isConnected ? '● Connected' : '● Reconnecting...'}
                    </div>

                    <button
                        onClick={handleLeaveClass}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                        }}
                    >
                        Leave
                    </button>
                </div>
            </div>

            {connectionError && (
                <div style={{
                    padding: '16px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    textAlign: 'center',
                    fontWeight: '600',
                }}>
                    ⚠️ {connectionError}
                </div>
            )}

            {/* Tabs */}
            <div style={{
                backgroundColor: 'white',
                padding: '8px',
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                gap: '8px',
            }}>
                {['camera', 'participants', 'chat'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === tab ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                            color: activeTab === tab ? 'white' : '#6b7280',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        {tab === 'camera' && '📹 Camera'}
                        {tab === 'participants' && `👥 Participants (${participants.length})`}
                        {tab === 'chat' && '💬 Chat'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                minHeight: '500px',
            }}>
                {activeTab === 'camera' && (
                    <StudentCamera
                        studentId={studentId}
                        studentName={studentName}
                        onStatusChange={handleStatusChange}
                        onFrameCapture={handleFrameCapture}
                    />
                )}

                {activeTab === 'participants' && (
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                            Participants ({participants.length})
                        </h3>
                        {participants.map(p => (
                            <div key={p.id} style={{
                                padding: '12px',
                                marginBottom: '8px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '10px',
                                border: '2px solid #e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                }}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>
                                        {p.name}
                                        {p.id === studentId && <span style={{ marginLeft: '6px', color: '#667eea' }}>(You)</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                        {p.type === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Chat</h3>

                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '12px',
                            marginBottom: '16px',
                        }}>
                            {messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: '40px' }}>
                                    No messages yet
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} style={{
                                        marginBottom: '12px',
                                        padding: '12px',
                                        backgroundColor: msg.user_type === 'teacher' ? '#eff6ff' : 'white',
                                        borderRadius: '8px',
                                        border: `2px solid ${msg.user_type === 'teacher' ? '#3b82f6' : '#e5e7eb'}`,
                                    }}>
                                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                                            {msg.user_name}{msg.user_type === 'teacher' && ' 👨‍🏫'}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#374151' }}>{msg.message}</div>
                                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                            {formatTimeIST(msg.timestamp)}
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
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                }}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!messageInput.trim()}
                                style={{
                                    padding: '12px 24px',
                                    background: messageInput.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d1d5db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: messageInput.trim() ? 'pointer' : 'not-allowed',
                                }}
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