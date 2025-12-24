import React, { useEffect, useRef, useState } from 'react';
import WebSocketClient from '../utils/websocket';
import MediaPipeHandler from '../utils/mediapipe';

const StudentView = ({ studentId, sessionId }) => {
    const videoRef = useRef(null);
    const [wsClient, setWsClient] = useState(null);
    const [mediaPipe, setMediaPipe] = useState(null);
    const [status, setStatus] = useState({
        connected: false,
        cameraActive: false,
        currentStatus: 'initializing',
        attentionScore: 0
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        const initializeSystem = async () => {
            try {
                // Initialize WebSocket
                const ws = new WebSocketClient(
                    `/ws/student/${studentId}/${sessionId}`,
                    handleWebSocketMessage,
                    handleWebSocketError,
                    handleWebSocketClose
                );
                ws.connect();

                if (mounted) {
                    setWsClient(ws);
                    setStatus(prev => ({ ...prev, connected: true }));
                }

                // Initialize MediaPipe
                const mp = new MediaPipeHandler(
                    videoRef.current,
                    handleLandmarksDetected
                );

                const initialized = await mp.initialize();
                if (!initialized) {
                    throw new Error('Failed to initialize MediaPipe');
                }

                const cameraStarted = await mp.startCamera();
                if (!cameraStarted) {
                    throw new Error('Failed to start camera');
                }

                if (mounted) {
                    setMediaPipe(mp);
                    setStatus(prev => ({ ...prev, cameraActive: true }));
                }

            } catch (err) {
                console.error('Initialization error:', err);
                if (mounted) {
                    setError(err.message);
                }
            }
        };

        initializeSystem();

        return () => {
            mounted = false;
            if (wsClient) {
                wsClient.close();
            }
            if (mediaPipe) {
                mediaPipe.stop();
            }
        };
    }, [studentId, sessionId]);

    const handleLandmarksDetected = (landmarks) => {
        if (wsClient && wsClient.isConnected()) {
            wsClient.send({
                type: 'landmarks',
                landmarks: landmarks,
                timestamp: new Date().toISOString()
            });
        }
    };

    const handleWebSocketMessage = (data) => {
        if (data.type === 'analysis_result') {
            setStatus(prev => ({
                ...prev,
                currentStatus: data.data.status,
                attentionScore: data.data.attention_score
            }));
        }
    };

    const handleWebSocketError = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Attempting to reconnect...');
    };

    const handleWebSocketClose = () => {
        setStatus(prev => ({ ...prev, connected: false }));
    };

    const getStatusColor = () => {
        switch (status.currentStatus) {
            case 'attentive':
                return 'bg-green-500';
            case 'distracted':
                return 'bg-yellow-500';
            case 'drowsy':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusText = () => {
        switch (status.currentStatus) {
            case 'attentive':
                return 'Attentive ✓';
            case 'distracted':
                return 'Distracted ⚠';
            case 'drowsy':
                return 'Drowsy 😴';
            default:
                return 'Initializing...';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Student Monitoring View
                    </h1>
                    <p className="text-gray-400">
                        Student ID: <span className="text-blue-400">{studentId}</span> |
                        Session: <span className="text-blue-400">{sessionId}</span>
                    </p>
                </div>

                {/* Status Bar */}
                <div className="card mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-2 ${status.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                                <span className="text-sm text-gray-300">
                                    {status.connected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-2 ${status.cameraActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-sm text-gray-300">
                                    {status.cameraActive ? 'Camera Active' : 'Camera Inactive'}
                                </span>
                            </div>
                        </div>
                        <div className={`status-badge status-${status.currentStatus}`}>
                            {getStatusText()}
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Video Display */}
                <div className="card mb-6">
                    <div className="video-container">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="rounded-lg"
                        />

                        {/* Overlay Status */}
                        <div className="absolute top-4 right-4">
                            <div className={`px-4 py-2 rounded-full ${getStatusColor()} bg-opacity-90`}>
                                <span className="text-white font-semibold">
                                    Attention: {Math.round(status.attentionScore * 100)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="card">
                    <h3 className="text-xl font-semibold text-white mb-3">
                        📋 Instructions
                    </h3>
                    <ul className="space-y-2 text-gray-300">
                        <li className="flex items-start">
                            <span className="text-blue-400 mr-2">•</span>
                            Keep your face visible and centered in the camera frame
                        </li>
                        <li className="flex items-start">
                            <span className="text-blue-400 mr-2">•</span>
                            Look at the screen to maintain attention score
                        </li>
                        <li className="flex items-start">
                            <span className="text-blue-400 mr-2">•</span>
                            Your teacher receives real-time updates about your engagement
                        </li>
                        <li className="flex items-start">
                            <span className="text-blue-400 mr-2">•</span>
                            Good lighting helps improve detection accuracy
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default StudentView;