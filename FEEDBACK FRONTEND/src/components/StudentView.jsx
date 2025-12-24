import { useState, useEffect, useRef, useCallback } from 'react';
import VideoCapture from './VideoCapture';
import { WebSocketManager } from '../utils/websocket';
import { initializeMediaPipe, extractAttentionFeatures } from '../utils/mediapipe';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function StudentView() {
    const [studentId] = useState(() => `student_${Math.random().toString(36).substr(2, 9)}`);
    const [studentName, setStudentName] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [currentStatus, setCurrentStatus] = useState('attentive');
    const [features, setFeatures] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);

    const wsRef = useRef(null);
    const videoRef = useRef(null);
    const mediaPipeRef = useRef(null);
    const updateIntervalRef = useRef(null);
    const latestFeaturesRef = useRef(null);

    const getStatusColor = (status) => {
        const colors = {
            attentive: '#22c55e',
            looking_away: '#f59e0b',
            drowsy: '#ef4444',
            distracted: '#f97316',
        };
        return colors[status] || '#6b7280';
    };

    const analyzeAttention = (features) => {
        if (!features) return 'attentive';

        const gazeX = Math.abs(features.gaze_direction?.x || 0);
        const gazeY = Math.abs(features.gaze_direction?.y || 0);
        const ear = features.eye_aspect_ratio || 1.0;
        const pitch = Math.abs(features.head_pose?.pitch || 0);
        const yaw = Math.abs(features.head_pose?.yaw || 0);

        if (ear < 0.2) return 'drowsy';
        if (gazeX > 0.3 || gazeY > 0.25) return 'looking_away';
        if (pitch > 30 || yaw > 30) return 'distracted';

        return 'attentive';
    };

    const handleMediaPipeResults = useCallback((results) => {
        const extractedFeatures = extractAttentionFeatures(results);
        if (extractedFeatures) {
            latestFeaturesRef.current = extractedFeatures;
            setFeatures(extractedFeatures);

            const status = analyzeAttention(extractedFeatures);
            setCurrentStatus(status);
        }
    }, []);

    const handleVideoReady = useCallback(async (video) => {
        if (!video || !isJoined) return;

        videoRef.current = video;

        try {
            console.log('Initializing MediaPipe...');
            const { faceMesh, camera } = await initializeMediaPipe(video, handleMediaPipeResults);
            mediaPipeRef.current = { faceMesh, camera };
            setCameraActive(true);
            console.log('✅ MediaPipe initialized successfully');
        } catch (err) {
            console.error('❌ MediaPipe initialization error:', err);
            setCameraActive(false);
        }
    }, [isJoined, handleMediaPipeResults]);

    // WebSocket connection
    useEffect(() => {
        if (!isJoined) return;

        console.log('Connecting to WebSocket:', WS_URL);
        const wsUrl = `${WS_URL}/ws/student/${studentId}?name=${encodeURIComponent(studentName)}`;

        wsRef.current = new WebSocketManager(wsUrl, (message) => {
            console.log('Student received:', message);
        });

        wsRef.current.connect()
            .then(() => {
                console.log('✅ WebSocket connected');
                setIsConnected(true);
            })
            .catch((err) => {
                console.error('❌ WebSocket connection error:', err);
                setIsConnected(false);
            });

        return () => {
            if (wsRef.current) {
                wsRef.current.disconnect();
            }
        };
    }, [isJoined, studentId, studentName]);

    // Send attention updates
    useEffect(() => {
        if (!isJoined || !isConnected) return;

        updateIntervalRef.current = setInterval(() => {
            if (latestFeaturesRef.current && wsRef.current?.isConnected()) {
                wsRef.current.send({
                    type: 'attention_update',
                    data: latestFeaturesRef.current,
                });
                console.log('📤 Sent attention update');
            }
        }, 1000);

        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
        };
    }, [isJoined, isConnected]);

    const handleJoinClass = () => {
        if (studentName.trim()) {
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
    };

    if (!isJoined) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#f9fafb',
                padding: '20px',
            }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    maxWidth: '400px',
                    width: '100%',
                }}>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: '#111827',
                        textAlign: 'center',
                    }}>
                        Join Online Class
                    </h1>
                    <p style={{
                        color: '#6b7280',
                        marginBottom: '24px',
                        textAlign: 'center',
                    }}>
                        Enter your name to join
                    </p>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            color: '#374151',
                        }}>
                            Your Name
                        </label>
                        <input
                            type="text"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinClass()}
                            placeholder="Enter your name"
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                fontSize: '16px',
                                outline: 'none',
                            }}
                        />
                    </div>

                    <button
                        onClick={handleJoinClass}
                        disabled={!studentName.trim()}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: studentName.trim() ? '#3b82f6' : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: studentName.trim() ? 'pointer' : 'not-allowed',
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
            backgroundColor: '#f9fafb',
            padding: '20px',
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: 'white',
                padding: '16px 24px',
                marginBottom: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                        Student View
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                        Welcome, {studentName}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isConnected ? '#22c55e' : '#ef4444',
                        }} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>

                    <div style={{
                        padding: '8px 16px',
                        backgroundColor: cameraActive ? '#dcfce7' : '#fee2e2',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: cameraActive ? '#166534' : '#991b1b',
                    }}>
                        📹 {cameraActive ? 'Camera Active' : 'Camera Inactive'}
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
                            fontWeight: '500',
                        }}
                    >
                        Leave Class
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
                    Your Camera View
                </h3>

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
                            padding: '8px 16px',
                            borderRadius: '20px',
                            backgroundColor: getStatusColor(currentStatus),
                            color: 'white',
                            fontWeight: 'bold',
                        }}>
                            {currentStatus.replace('_', ' ').toUpperCase()}
                        </div>
                    </div>

                    {features && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '8px',
                            fontSize: '12px',
                        }}>
                            <div><strong>Debug Info:</strong></div>
                            <div>Eye Ratio: {features.eye_aspect_ratio?.toFixed(3)}</div>
                            <div>Gaze X: {features.gaze_direction?.x?.toFixed(3)}</div>
                            <div>Gaze Y: {features.gaze_direction?.y?.toFixed(3)}</div>
                            <div>Head Pitch: {features.head_pose?.pitch}°</div>
                            <div>Head Yaw: {features.head_pose?.yaw}°</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}