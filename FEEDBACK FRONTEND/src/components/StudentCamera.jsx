import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

function calculateEAR(eye) {
  const vertical = Math.abs(eye.upper.y - eye.lower.y);
  const horizontal = Math.abs(eye.left.x - eye.right.x);
  return vertical / (horizontal || 1);
}

export default function StudentCamera({ onStatusChange, onFrameCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('attentive');
  const [cameraActive, setCameraActive] = useState(false);
  const faceMeshRef = useRef(null);
  const cameraInstanceRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Get camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        // Setup canvas
        canvasRef.current.width = 640;
        canvasRef.current.height = 480;

        // Frame capture interval
        setInterval(() => {
          if (canvasRef.current && videoRef.current && mounted) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, 640, 480);
            const frame = canvasRef.current.toDataURL('image/jpeg', 0.6);
            if (onFrameCapture) onFrameCapture(frame);
          }
        }, 1000);

        // Initialize FaceMesh
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          if (!mounted) return;

          if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            setStatus('no_face');
            if (onStatusChange) onStatusChange({ status: 'no_face' });
            return;
          }

          const landmarks = results.multiFaceLandmarks[0];
          
          // Simple detection
          const leftEye = {
            upper: landmarks[159],
            lower: landmarks[145],
            left: landmarks[33],
            right: landmarks[133]
          };
          
          const rightEye = {
            upper: landmarks[386],
            lower: landmarks[374],
            left: landmarks[362],
            right: landmarks[263]
          };

          const nose = landmarks[1];
          
          const leftEAR = calculateEAR(leftEye);
          const rightEAR = calculateEAR(rightEye);
          const avgEAR = (leftEAR + rightEAR) / 2;

          let newStatus = 'attentive';

          // Check head turn (nose position)
          if (nose.x < 0.3 || nose.x > 0.7 || nose.y < 0.3 || nose.y > 0.7) {
            newStatus = 'looking_away';
          }
          // Check eyes closed
          else if (avgEAR < 0.18) {
            newStatus = 'drowsy';
          }

          setStatus(newStatus);
          if (onStatusChange) {
            onStatusChange({
              status: newStatus,
              ear: avgEAR,
              nose_x: nose.x,
              nose_y: nose.y
            });
          }
        });

        faceMeshRef.current = faceMesh;

        // Start camera
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && mounted) {
              await faceMeshRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        
        cameraInstanceRef.current = camera;
        camera.start();

      } catch (err) {
        console.error('Camera error:', err);
        setCameraActive(false);
      }
    }

    init();

    return () => {
      mounted = false;
      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [onStatusChange, onFrameCapture]);

  const getColor = () => {
    if (status === 'attentive') return '#22c55e';
    if (status === 'looking_away') return '#f59e0b';
    if (status === 'drowsy') return '#ef4444';
    return '#6b7280';
  };

  const getLabel = () => {
    if (status === 'attentive') return 'ATTENTIVE';
    if (status === 'looking_away') return 'LOOKING AWAY';
    if (status === 'drowsy') return 'DROWSY';
    return 'NO FACE';
  };

  return (
    <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto' }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          borderRadius: '12px',
          transform: 'scaleX(-1)',
          background: '#000'
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
          backgroundColor: getColor(),
          color: 'white',
          borderRadius: '24px',
          fontWeight: 'bold',
          fontSize: '16px',
        }}>
          {getLabel()}
        </div>
      )}

      {!cameraActive && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          background: 'rgba(0,0,0,0.7)',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📹</div>
          <div>Starting camera...</div>
        </div>
      )}
    </div>
  );
}