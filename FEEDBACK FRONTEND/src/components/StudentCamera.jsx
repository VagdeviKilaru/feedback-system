import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { classifyAttention, getStatusColor, getStatusLabel } from '../utils/detection';

export default function StudentCamera({ studentId, studentName, onStatusChange, onFrameCapture }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [currentStatus, setCurrentStatus] = useState('no_face');
    const [cameraActive, setCameraActive] = useState(false);
    const lastStatusRef = useRef('no_face');
    const lastSentTimeRef = useRef(0);
    const frameIntervalRef = useRef(null);

    useEffect(() => {
        let camera = null;
        let faceMesh = null;

        async function setupCamera() {
            if (!videoRef.current) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: 640, height: 480 },
                    audio: false,
                });

                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraActive(true);

                // Create canvas for frame capture
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = 640;
                    canvas.height = 480;
                }

                // Send frames every 1 second to teacher
                frameIntervalRef.current = setInterval(() => {
                    if (videoRef.current && canvasRef.current && onFrameCapture) {
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(videoRef.current, 0, 0, 640, 480);

                        // Convert to base64 image (JPEG with 60% quality for smaller size)
                        const frameData = canvas.toDataURL('image/jpeg', 0.6);
                        onFrameCapture(frameData);
                    }
                }, 1000); // Every 1 second

                // Initialize FaceMesh for detection
                faceMesh = new FaceMesh({
                    locateFile: (file) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                });

                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                faceMesh.onResults((results) => {
                    const now = performance.now();

                    let detection;
                    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                        detection = { status: 'no_face', confidence: 0 };
                    } else {
                        detection = classifyAttention(results.multiFaceLandmarks[0]);
                    }

                    setCurrentStatus(detection.status);

                    if (
                        detection.status !== lastStatusRef.current ||
                        now - lastSentTimeRef.current > 500
                    ) {
                        lastStatusRef.current = detection.status;
                        lastSentTimeRef.current = now;

                        if (onStatusChange) {
                            onStatusChange(detection.status, detection.confidence);
                        }
                    }
                });

                camera = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (faceMesh) {
                            await faceMesh.send({ image: videoRef.current });
                        }
                    },
                    width: 640,
                    height: 480,
                });

                camera.start();
            } catch (err) {
                console.error('Camera setup error:', err);
                setCameraActive(false);
            }
        }

        setupCamera();

        return () => {
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
            }
            if (camera) camera.stop();
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

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

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

            {!cameraActive && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: '14px',
                    textAlign: 'center',
                }}>
                    Starting camera...
                </div>
            )}
        </div>
    );
}