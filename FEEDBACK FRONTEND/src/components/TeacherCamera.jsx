import { useEffect, useRef, useState } from 'react';

export default function TeacherCamera({ onClose, wsManager }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const streamRef = useRef(null);
    const frameIntervalRef = useRef(null);

    useEffect(() => {
        async function startCamera() {
            try {
                console.log('🎥 Starting teacher camera...');

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: false
                });

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setIsActive(true);
                    console.log('✅ Teacher camera active');

                    // Setup canvas
                    const canvas = canvasRef.current;
                    canvas.width = 640;
                    canvas.height = 480;

                    // Send frames to students every 1 second
                    frameIntervalRef.current = setInterval(() => {
                        if (!videoRef.current || videoRef.current.paused) return;

                        try {
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(videoRef.current, 0, 0, 640, 480);
                            const frameData = canvas.toDataURL('image/jpeg', 0.7);

                            // Send to students via WebSocket
                            if (wsManager && wsManager.isConnected()) {
                                wsManager.send({
                                    type: 'teacher_camera_frame',
                                    frame: frameData
                                });
                                console.log('📤 Teacher frame sent to students');
                            }
                        } catch (err) {
                            console.error('Frame capture error:', err);
                        }
                    }, 1000);
                }
            } catch (err) {
                console.error('❌ Teacher camera error:', err);
                alert('Could not access camera. Please allow camera permission.');
            }
        }

        startCamera();

        return () => {
            console.log('🛑 Stopping teacher camera');
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [wsManager]);

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 1999,
                    backdropFilter: 'blur(4px)'
                }}
                onClick={onClose}
            />

            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2000,
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
                maxWidth: '90vw',
                maxHeight: '90vh'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                    <div>
                        <h3 style={{
                            margin: 0,
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#111827'
                        }}>
                            📹 My Camera (Broadcasting to Students)
                        </h3>
                        <p style={{
                            margin: '4px 0 0 0',
                            fontSize: '13px',
                            color: '#6b7280'
                        }}>
                            Students can see you in their main view
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '15px',
                            fontWeight: '600',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                    >
                        ✕ Close
                    </button>
                </div>

                <div style={{ position: 'relative' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '640px',
                            maxWidth: '100%',
                            height: 'auto',
                            borderRadius: '16px',
                            transform: 'scaleX(-1)',
                            background: '#000',
                            border: '3px solid #8b5cf6'
                        }}
                    />

                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {isActive && (
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            left: '16px',
                            padding: '8px 16px',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                animation: 'pulse 2s ease-in-out infinite'
                            }} />
                            LIVE - Broadcasting
                        </div>
                    )}

                    {!isActive && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '600',
                            textAlign: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            padding: '20px 40px',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📹</div>
                            Starting camera...
                        </div>
                    )}
                </div>

                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#dcfce7',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#166534',
                    textAlign: 'center',
                    fontWeight: '600',
                }}>
                    ✓ Students can see your camera in their main view
                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </>
    );
}