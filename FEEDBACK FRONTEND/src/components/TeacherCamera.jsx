import { useEffect, useRef, useState } from 'react';

export default function TeacherCamera({ onClose }) {
    const videoRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const streamRef = useRef(null);

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
                }
            } catch (err) {
                console.error('❌ Teacher camera error:', err);
                alert('Could not access camera. Please allow camera permission.');
            }
        }

        startCamera();

        return () => {
            console.log('🛑 Stopping teacher camera');
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <>
            {/* Background overlay */}
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

            {/* Camera modal */}
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
                {/* Header */}
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
                            📹 My Camera Preview
                        </h3>
                        <p style={{
                            margin: '4px 0 0 0',
                            fontSize: '13px',
                            color: '#6b7280'
                        }}>
                            This is how you appear to students
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
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* Video */}
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
                            LIVE
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

                {/* Info */}
                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#6b7280',
                    textAlign: 'center'
                }}>
                    💡 Tip: Make sure you have good lighting and are centered in the frame
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