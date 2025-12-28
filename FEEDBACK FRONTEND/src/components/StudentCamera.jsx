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
  const lastStatusSentRef = useRef('attentive');
  const detectionIntervalRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let frameInterval = null;

    async function init() {
      try {
        console.log('🎥 Starting camera...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log('✅ Camera started');

        // Wait for video to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        setCameraReady(true);

        // Canvas setup
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;

        // Frame capture every 1 second
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
            console.error('Frame error:', err);
          }
        }, 1000);

        // Initialize FaceMesh
        console.log('🤖 Loading FaceMesh...');
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        let frameCount = 0;
        faceMesh.onResults((results) => {
          if (!mounted) return;
          frameCount++;

          // No face detected
          if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            updateStatus('no_face', 0, 0.5, 0.5);
            return;
          }

          const landmarks = results.multiFaceLandmarks[0];
          
          // Eye landmarks
          const leftEyeTop = landmarks[159];
          const leftEyeBottom = landmarks[145];
          const leftEyeLeft = landmarks[33];
          const leftEyeRight = landmarks[133];

          const rightEyeTop = landmarks[386];
          const rightEyeBottom = landmarks[374];
          const rightEyeLeft = landmarks[362];
          const rightEyeRight = landmarks[263];

          const noseTip = landmarks[1];

          // Calculate EAR
          const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
          const leftEyeWidth = Math.abs(leftEyeLeft.x - leftEyeRight.x);
          const leftEAR = leftEyeHeight / (leftEyeWidth || 0.001);

          const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBottom.y);
          const rightEyeWidth = Math.abs(rightEyeLeft.x - rightEyeRight.x);
          const rightEAR = rightEyeHeight / (rightEyeWidth || 0.001);

          const avgEAR = (leftEAR + rightEAR) / 2;
          const noseX = noseTip.x;
          const noseY = noseTip.y;

          // Determine status
          let newStatus = 'attentive';

          // Check head position FIRST
          if (noseX < 0.35 || noseX > 0.65 || noseY < 0.35 || noseY > 0.65) {
            newStatus = 'looking_away';
            eyesClosedStartRef.current = null;
          }
          // Check drowsiness
          else if (avgEAR < 0.20) {
            const now = Date.now();
            if (!eyesClosedStartRef.current) {
              eyesClosedStartRef.current = now;
            }
            const duration = (now - eyesClosedStartRef.current) / 1000;
            
            if (duration >= 2.5) {
              newStatus = 'drowsy';
            }
          }
          // Eyes open = attentive
          else {
            eyesClosedStartRef.current = null;
          }

          // Update status
          updateStatus(newStatus, avgEAR, noseX, noseY);
        });

        faceMeshRef.current = faceMesh;
        console.log('✅ FaceMesh loaded');

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
        console.log('✅ Detection started');

      } catch (err) {
        console.error('❌ Error:', err);
        setCameraReady(false);
      }
    }

    function updateStatus(newStatus, ear, noseX, noseY) {
      setStatus(newStatus);
      
      // Send to backend ONLY when status changes
      if (newStatus !== lastStatusSentRef.current) {
        lastStatusSentRef.current = newStatus;
        console.log(`📤 SENDING: ${newStatus} (EAR=${ear?.toFixed(3)}, nose=${noseX?.toFixed(2)},${noseY?.toFixed(2)})`);
        
        if (onStatusChange) {
          onStatusChange({
            status: newStatus,
            ear: ear || 1.0,
            nose_x: noseX || 0.5,
            nose_y: noseY || 0.5,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    init();

    return () => {
      console.log('🛑 Cleanup');
      mounted = false;
      
      if (frameInterval) clearInterval(frameInterval);
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (cameraInstanceRef.current) cameraInstanceRef.current.stop();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [onStatusChange, onFrameCapture]);

  const getColor = () => {
    switch(status) {
      case 'attentive': return '#22c55e';
      case 'looking_away': return '#f59e0b';
      case 'drowsy': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getLabel = () => {
    switch(status) {
      case 'attentive': return '✓ ATTENTIVE';
      case 'looking_away': return '⚠️ LOOKING AWAY';
      case 'drowsy': return '😴 DROWSY';
      default: return '❌ NO FACE';
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
          background: '#000',
          display: cameraReady ? 'block' : 'none'
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
          zIndex: 10
        }}>
          {getLabel()}
        </div>
      )}

      {!cameraReady && (
        <div style={{
          width: '100%',
          height: '480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📹</div>
            <div style={{ fontSize: '18px', fontWeight: '600' }}>Starting Camera...</div>
            <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>Please allow camera access</div>
          </div>
        </div>
      )}
    </div>
  );
}