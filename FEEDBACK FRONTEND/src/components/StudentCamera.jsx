import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function StudentCamera({ onStatusChange, onFrameCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('attentive');

  const eyesClosedStartRef = useRef(null);
  const lastStatusRef = useRef('attentive');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let frameInterval = null;
    let faceMesh = null;
    let camera = null;

    async function startCamera() {
      try {
        console.log('🎥 Requesting camera access...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        if (!mountedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        console.log('✅ Camera active');

        // Canvas setup
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;

        // Frame capture every 1 second
        frameInterval = setInterval(() => {
          if (!mountedRef.current || !video || video.paused) return;

          try {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 640, 480);
            const frame = canvas.toDataURL('image/jpeg', 0.7);
            if (onFrameCapture) onFrameCapture(frame);
          } catch (e) {
            // Silent fail
          }
        }, 1000);

        // MediaPipe FaceMesh
        console.log('🤖 Initializing FaceMesh...');

        faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onResults);

        console.log('✅ FaceMesh ready');

        // Start processing
        camera = new Camera(video, {
          onFrame: async () => {
            if (faceMesh && mountedRef.current) {
              await faceMesh.send({ image: video });
            }
          },
          width: 640,
          height: 480,
        });

        camera.start();
        console.log('✅ Detection running');

      } catch (err) {
        console.error('❌ Camera error:', err);
      }
    }

    function onResults(results) {
      if (!mountedRef.current) return;

      // If no face - just keep last status, don't send "no_face"
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        // Don't update status to no_face - just ignore
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

      const nose = landmarks[1];

      // Calculate EAR
      const leftH = Math.abs(leftEyeTop.y - leftEyeBottom.y);
      const leftW = Math.abs(leftEyeLeft.x - leftEyeRight.x);
      const leftEAR = leftH / (leftW || 0.001);

      const rightH = Math.abs(rightEyeTop.y - rightEyeBottom.y);
      const rightW = Math.abs(rightEyeLeft.x - rightEyeRight.x);
      const rightEAR = rightH / (rightW || 0.001);

      const ear = (leftEAR + rightEAR) / 2;
      const noseX = nose.x;
      const noseY = nose.y;

      let newStatus = 'attentive';

      // Check looking away
      if (noseX < 0.35 || noseX > 0.65 || noseY < 0.35 || noseY > 0.65) {
        newStatus = 'looking_away';
        eyesClosedStartRef.current = null;
      }
      // Check drowsy
      else if (ear < 0.20) {
        const now = Date.now();
        if (!eyesClosedStartRef.current) {
          eyesClosedStartRef.current = now;
        }
        const duration = (now - eyesClosedStartRef.current) / 1000;

        if (duration >= 2.5) {
          newStatus = 'drowsy';
        }
      }
      else {
        eyesClosedStartRef.current = null;
      }

      updateStatus(newStatus, ear, noseX, noseY);
    }

    function updateStatus(newStatus, ear, noseX, noseY) {
      setStatus(newStatus);

      // Send only when changed
      if (newStatus !== lastStatusRef.current) {
        lastStatusRef.current = newStatus;

        console.log(`📤 ${newStatus} | EAR: ${ear.toFixed(3)} | Nose: (${noseX.toFixed(2)}, ${noseY.toFixed(2)})`);

        if (onStatusChange) {
          onStatusChange({
            status: newStatus,
            ear: ear,
            nose_x: noseX,
            nose_y: noseY,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    startCamera();

    return () => {
      console.log('🛑 Cleanup camera');
      mountedRef.current = false;

      if (frameInterval) clearInterval(frameInterval);
      if (camera) camera.stop();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [onStatusChange, onFrameCapture]);

  const colors = {
    attentive: '#22c55e',
    looking_away: '#f59e0b',
    drowsy: '#ef4444'
  };

  const labels = {
    attentive: '✓ ATTENTIVE',
    looking_away: '⚠️ LOOKING AWAY',
    drowsy: '😴 DROWSY'
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '12px',
          transform: 'scaleX(-1)',
          background: '#000'
        }}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        backgroundColor: colors[status],
        color: 'white',
        borderRadius: '24px',
        fontWeight: 'bold',
        fontSize: '16px',
        boxShadow: `0 4px 12px ${colors[status]}66`,
        whiteSpace: 'nowrap'
      }}>
        {labels[status]}
      </div>
    </div>
  );
}