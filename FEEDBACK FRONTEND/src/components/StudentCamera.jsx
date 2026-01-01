import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function StudentCamera({ onStatusChange, onFrameCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('no_face');
  const [isActive, setIsActive] = useState(false);

  const statusRef = useRef('no_face');
  const eyesClosedStartRef = useRef(null);
  const lastFrameCaptureRef = useRef(0);
  const lastStatusSendRef = useRef(0);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);

  // EAR calculation (Eye Aspect Ratio)
  const calculateEAR = (eye) => {
    const A = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const B = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const C = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (A + B) / (2.0 * C);
  };

  useEffect(() => {
    let mounted = true;

    const initializeCamera = async () => {
      try {
        console.log('🎥 Initializing student camera...');

        // Check camera permissions first
        try {
          const permissions = await navigator.permissions.query({ name: 'camera' });
          console.log('📹 Camera permission:', permissions.state);

          if (permissions.state === 'denied') {
            console.error('❌ Camera access denied');
            alert('Camera access denied. Please enable camera in browser settings.');
            return;
          }
        } catch (permError) {
          console.log('⚠️ Permission API not supported, continuing anyway');
        }

        // Initialize FaceMesh
        faceMeshRef.current = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMeshRef.current.onResults((results) => {
          if (!mounted) return;

          const now = Date.now();
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');

          // Draw video frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

          let currentStatus = 'no_face';
          let ear = 1.0;
          let noseX = 0.5;
          let noseY = 0.5;

          // THREE RULES OF DETECTION
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Get nose position (landmark 1)
            const nose = landmarks[1];
            noseX = nose.x;
            noseY = nose.y;

            // Get eye landmarks
            const leftEye = [
              landmarks[33], landmarks[160], landmarks[158],
              landmarks[133], landmarks[153], landmarks[144]
            ];
            const rightEye = [
              landmarks[362], landmarks[385], landmarks[387],
              landmarks[263], landmarks[373], landmarks[380]
            ];

            // Calculate EAR
            const leftEAR = calculateEAR(leftEye);
            const rightEAR = calculateEAR(rightEye);
            ear = (leftEAR + rightEAR) / 2.0;

            // RULE 1: Check if looking straight (ATTENTIVE)
            const isLookingStraight = (
              noseX >= 0.35 && noseX <= 0.65 &&
              noseY >= 0.35 && noseY <= 0.65
            );

            // RULE 2: Check if eyes closed (DROWSY)
            const eyesClosed = ear < 0.20;

            // RULE 3: Check if looking away (HEAD TURNED)
            const lookingAway = !isLookingStraight;

            // Determine status based on THREE RULES
            if (eyesClosed) {
              // Eyes closed - check duration
              if (!eyesClosedStartRef.current) {
                eyesClosedStartRef.current = now;
              }
              const eyesClosedDuration = (now - eyesClosedStartRef.current) / 1000;

              if (eyesClosedDuration > 2.0) {
                currentStatus = 'drowsy'; // DROWSY: Eyes closed > 2 seconds
              } else {
                currentStatus = 'attentive'; // Still attentive if < 2 seconds
              }
            } else {
              // Eyes open
              eyesClosedStartRef.current = null;

              if (lookingAway) {
                currentStatus = 'looking_away'; // LOOKING AWAY: Head turned
              } else {
                currentStatus = 'attentive'; // ATTENTIVE: Looking straight
              }
            }
          } else {
            // NO FACE DETECTED
            currentStatus = 'no_face';
            eyesClosedStartRef.current = null;
          }

          // Update status if changed
          if (currentStatus !== statusRef.current) {
            console.log(`📊 Status changed: ${statusRef.current} → ${currentStatus}`);
            statusRef.current = currentStatus;
            setStatus(currentStatus);
          }

          // Send status update every 1 second
          if (now - lastStatusSendRef.current > 1000) {
            const detectionData = {
              status: currentStatus,
              ear: ear,
              nose_x: noseX,
              nose_y: noseY,
              timestamp: now
            };

            if (onStatusChange) {
              onStatusChange(detectionData);
            }

            lastStatusSendRef.current = now;
          }

          // Capture frame every 2 seconds
          if (now - lastFrameCaptureRef.current > 2000) {
            const frameData = canvas.toDataURL('image/jpeg', 0.7);
            if (onFrameCapture) {
              onFrameCapture(frameData);
            }
            lastFrameCaptureRef.current = now;
          }
        });

        // Initialize camera
        if (videoRef.current) {
          cameraRef.current = new Camera(videoRef.current, {
            onFrame: async () => {
              if (faceMeshRef.current && mounted) {
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480
          });

          await cameraRef.current.start();
          setIsActive(true);
          console.log('✅ Student camera active');
        }

      } catch (error) {
        console.error('❌ Camera initialization error:', error);
        alert(`Camera error: ${error.message}. Please check camera permissions.`);
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
      console.log('🛑 Stopping student camera');
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [onStatusChange, onFrameCapture]);

  const getStatusColor = () => {
    switch (status) {
      case 'attentive': return '#22c55e';
      case 'looking_away': return '#f59e0b';
      case 'drowsy': return '#ef4444';
      case 'no_face': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'attentive': return '✓ ATTENTIVE';
      case 'looking_away': return '👀 LOOKING AWAY';
      case 'drowsy': return '😴 DROWSY';
      case 'no_face': return '❌ NO FACE';
      default: return 'DETECTING...';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
        autoPlay
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />

      {/* Status Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '8px',
        backgroundColor: getStatusColor(),
        color: 'white',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: '600',
      }}>
        {getStatusText()}
      </div>

      {!isActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontSize: '14px',
        }}>
          Starting camera...
        </div>
      )}
    </div>
  );
}