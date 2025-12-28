import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function StudentCamera({ onStatusChange, onFrameCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('attentive');
  const [cameraReady, setCameraReady] = useState(false);

  const faceMeshRef = useRef(null);
  const cameraInstanceRef = useRef(null);
  const eyesClosedStartRef = useRef(null);
  const lastStatusRef = useRef('attentive');

  useEffect(() => {
    let mounted = true;
    let frameInterval = null;

    async function init() {
      try {
        console.log('🎥 Initializing camera...');

        // Get camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        console.log('✅ Camera started');

        // Setup canvas for frame capture
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;

        // Send frames every 1 second
        frameInterval = setInterval(() => {
          if (!canvas || !videoRef.current || !mounted) return;

          try {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, 640, 480);
            const frameData = canvas.toDataURL('image/jpeg', 0.7);
            if (onFrameCapture) {
              onFrameCapture(frameData);
            }
          } catch (err) {
            console.error('Frame capture error:', err);
          }
        }, 1000);

        // Initialize MediaPipe FaceMesh
        console.log('🤖 Initializing FaceMesh...');
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          if (!mounted) return;

          // Check if face detected
          if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            setStatus('no_face');
            lastStatusRef.current = 'no_face';
            if (onStatusChange) {
              onStatusChange({ status: 'no_face' });
            }
            return;
          }

          const landmarks = results.multiFaceLandmarks[0];

          // Get key landmarks
          const leftEyeTop = landmarks[159];
          const leftEyeBottom = landmarks[145];
          const leftEyeLeft = landmarks[33];
          const leftEyeRight = landmarks[133];

          const rightEyeTop = landmarks[386];
          const rightEyeBottom = landmarks[374];
          const rightEyeLeft = landmarks[362];
          const rightEyeRight = landmarks[263];

          const noseTip = landmarks[1];

          // Calculate EAR (Eye Aspect Ratio)
          const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
          const leftEyeWidth = Math.abs(leftEyeLeft.x - leftEyeRight.x);
          const leftEAR = leftEyeHeight / (leftEyeWidth || 0.001);

          const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBottom.y);
          const rightEyeWidth = Math.abs(rightEyeLeft.x - rightEyeRight.x);
          const rightEAR = rightEyeHeight / (rightEyeWidth || 0.001);

          const avgEAR = (leftEAR + rightEAR) / 2;

          // Nose position for head pose
          const noseX = noseTip.x;
          const noseY = noseTip.y;

          let newStatus = 'attentive';

          // DETECTION LOGIC (SIMPLE & ACCURATE)

          // 1. Check if looking away (head turned)
          if (noseX < 0.35 || noseX > 0.65 || noseY < 0.35 || noseY > 0.65) {
            newStatus = 'looking_away';
            eyesClosedStartRef.current = null;
          }
          // 2. Check if drowsy (eyes closed)
          else if (avgEAR < 0.20) {
            const now = Date.now();
            if (!eyesClosedStartRef.current) {
              eyesClosedStartRef.current = now;
            }
            const duration = (now - eyesClosedStartRef.current) / 1000;

            if (duration >= 2.5) {
              newStatus = 'drowsy';
            } else {
              newStatus = 'attentive';
            }
          }
          // 3. Eyes open and looking at screen = attentive
          else {
            newStatus = 'attentive';
            eyesClosedStartRef.current = null;
          }

          // Update status
          setStatus(newStatus);

          // Send to backend ONLY if status changed
          if (newStatus !== lastStatusRef.current) {
            lastStatusRef.current = newStatus;
            console.log(`📊 Status changed: ${newStatus} (EAR: ${avgEAR.toFixed(3)}, Nose: ${noseX.toFixed(2)}, ${noseY.toFixed(2)})`);

            if (onStatusChange) {
              onStatusChange({
                status: newStatus,
                ear: avgEAR,
                nose_x: noseX,
                nose_y: noseY
              });
            }
          }
        });

        faceMeshRef.current = faceMesh;
        console.log('✅ FaceMesh initialized');

        // Start camera processing
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && mounted && videoRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        cameraInstanceRef.current = camera;
        camera.start();
        console.log('✅ Camera processing started');

      } catch (err) {
        console.error('❌ Camera initialization error:', err);
        setCameraReady(false);
      }
    }

    init();

    return () => {
      console.log('🛑 Cleaning up camera...');
      mounted = false;

      if (frameInterval) {
        clearInterval(frameInterval);
      }

      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
      }

      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [onStatusChange, onFrameCapture]);

  const getColor = () => {
    switch (status) {
      case 'attentive': return '#22c55e';
      case 'looking_away': return '#f59e0b';
      case 'drowsy': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'attentive': return 'ATTENTIVE ✓';
      case 'looking_away': return 'LOOKING AWAY ⚠️';
      case 'drowsy': return 'DROWSY 😴';
      default: return 'NO FACE ❌';
    }
  };

  return (
    <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          borderRadius: '12px',
          transform: 'scaleX(-1)',
          background: '#000'
        }}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {cameraReady && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          backgroundColor: getColor(),
          color: 'white',
          borderRadius: '24px',
          fontWeight: 'bold',
          fontSize: '16px',
          boxShadow: `0 4px 12px ${getColor()}66`,
        }}>
          {getLabel()}
        </div>
      )}

      {!cameraReady && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          background: 'rgba(0,0,0,0.8)',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📹</div>
          <div style={{ fontSize: '16px' }}>Initializing camera...</div>
        </div>
      )}
    </div>
  );
}