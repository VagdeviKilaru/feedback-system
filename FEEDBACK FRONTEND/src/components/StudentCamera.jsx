import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { classifyAttention, getStatusColor, getStatusLabel } from '../utils/detection';

export default function StudentCamera({ studentId, studentName, onStatusChange, onFrameCapture }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [currentStatus, setCurrentStatus] = useState('processing');
    const [cameraActive, setCameraActive] = useState(false);
    const [error, setError] = useState(null);
    const lastSentTimeRef = useRef(0);
    const frameIntervalRef = useRef(null);
    const cameraRef = useRef(null);
    const faceMeshRef = useRef(null);

    useEffect(() => {
        let mounted = true;

        async function setupCamera() {
            if (!videoRef.current || !mounted) return;

            try {
                // Request camera access
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    },
                    audio: false,
                });

                if (!mounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraActive(true);
                setError(null);

                // Setup canvas for frame capture
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = 640;
                    canvas.height = 480;
                }

                // Send frames every 1 second
                frameIntervalRef.current = setInterval(() => {
                    if (videoRef.current && canvasRef.current && onFrameCapture && mounted) {
                        const ctx = canvas.getContext('2d');
                        ctx.save();
                        ctx.scale(-1, 1);  // Mirror
                        ctx.drawImage(videoRef.current, -640, 0, 640, 480);
                        ctx.restore();

                        const frameData = canvas.toDataURL('image/jpeg', 0.7);
                        onFrameCapture(frameData);
                    }
                }, 1000);

                // Initialize FaceMesh
                faceMeshRef.current = new FaceMesh({
                    locateFile: (file) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                });

                faceMeshRef.current.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                faceMeshRef.current.onResults((results) => {
                    if (!mounted) return;

                    const now = Date.now();

                    let detection = classifyAttention(results.multiFaceLandmarks?.[0]);

                    // Only send if processing status (has data) and enough time passed
                    if (detection.status === 'processing' && detection.data) {
                        if (now - lastSentTimeRef.current > 500) {
                            lastSentTimeRef.current = now;
                            if (onStatusChange) {
                                onStatusChange(detection.data);
                            }
                        }
                        // Show as attentive while processing
                        setCurrentStatus('attentive');
                    } else if (detection.status === 'no_face') {
                        setCurrentStatus('no_face');
                    }
                });

                // Start camera
                cameraRef.current = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (faceMeshRef.current && mounted) {
                            await faceMeshRef.current.send({ image: videoRef.current });
                        }
                    },
                    width: 640,
                    height: 480,
                });

                cameraRef.current.start();

            } catch (err) {
                console.error('Camera setup error:', err);
                setError(err.message);
                setCameraActive(false);
            }
        }

        setupCamera();

        return () => {
            mounted = false;
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
            }
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [onStatusChange, onFrameCapture]);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '640px',
            margin: '0 auto',
        }}>
            <video
                ref={videoRef}
                style={{
                    width: '100%',
                    borderRadius: '12px',
                    background: '#000',
                    transform: 'scaleX(-1)',
                }}
                playsInline
                muted
            />

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {cameraActive && (
                <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '12px 24px',
                    backgroundColor: getStatusColor(currentStatus),
                    color: 'white',
                    borderRadius: '24px',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    boxShadow: `0 4px 12px ${getStatusColor(currentStatus)}66`,
                }}>
                    {getStatusLabel(currentStatus)}
                </div>
            )}

            {!cameraActive && !error && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: '14px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '20px',
                    borderRadius: '12px',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📹</div>
                    <div>Starting camera...</div>
                </div>
            )}

            {error && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#ef4444',
                    fontSize: '14px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    padding: '20px',
                    borderRadius: '12px',
                    maxWidth: '80%',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
                    <div>Camera Error:</div>
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>{error}</div>
                </div>
            )}
        </div>
    );
}