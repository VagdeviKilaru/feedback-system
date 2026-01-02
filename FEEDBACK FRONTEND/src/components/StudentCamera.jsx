import { useEffect, useRef, useState } from 'react';

export default function StudentCamera({ onStatusChange, onFrameCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('no_face');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  
  const statusRef = useRef('no_face');
  const faceDetectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastStatusSendRef = useRef(0);
  const lastFrameCaptureRef = useRef(0);
  const eyesClosedStartRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let stream = null;

    const initializeCamera = async () => {
      try {
        console.log('🎥 Starting camera...');
        
        // Get camera stream
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'user'
          } 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('✅ Camera started');
          setIsActive(true);
        }

        // Initialize Face Detection API
        if ('FaceDetector' in window) {
          faceDetectorRef.current = new window.FaceDetector({ 
            maxDetectedFaces: 1,
            fastMode: true 
          });
          console.log('✅ Face detector initialized');
        } else {
          console.warn('⚠️ Face Detection API not available, using basic detection');
        }

        // Start detection loop
        detectFace();

      } catch (error) {
        console.error('❌ Camera error:', error);
        setError(error.message);
        
        if (error.name === 'NotAllowedError') {
          alert('Camera permission denied. Please allow camera access.');
        }
      }
    };

    const detectFace = async () => {
      if (!mounted || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      const now = Date.now();
      let currentStatus = 'attentive'; // Default to attentive if face detected

      try {
        // Use Face Detection API if available
        if (faceDetectorRef.current) {
          const faces = await faceDetectorRef.current.detect(video);
          
          if (faces.length > 0) {
            const face = faces[0];
            const bounds = face.boundingBox;
            
            // Calculate center of face
            const faceCenterX = (bounds.x + bounds.width / 2) / video.videoWidth;
            const faceCenterY = (bounds.y + bounds.height / 2) / video.videoHeight;
            
            // Check if looking straight (center of frame)
            const isLookingStraight = (
              faceCenterX >= 0.30 && faceCenterX <= 0.70 &&
              faceCenterY >= 0.30 && faceCenterY <= 0.70
            );
            
            if (!isLookingStraight) {
              currentStatus = 'looking_away';
            }
          } else {
            currentStatus = 'no_face';
          }
        } else {
          // Fallback: Use simple detection based on video data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;
          
          // Simple brightness detection (face typically has lighter pixels)
          let brightPixels = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const avg = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
            if (avg > 100) brightPixels++;
          }
          
          const brightRatio = brightPixels / (pixels.length / 4);
          if (brightRatio < 0.2) {
            currentStatus = 'no_face';
          }
        }
      } catch (detectError) {
        console.warn('Detection error:', detectError);
        currentStatus = 'attentive'; // Default to attentive on error
      }

      // Update status if changed
      if (currentStatus !== statusRef.current) {
        console.log(`📊 Status: ${statusRef.current} → ${currentStatus}`);
        statusRef.current = currentStatus;
        setStatus(currentStatus);
      }

      // Send status update every 1 second
      if (now - lastStatusSendRef.current > 1000) {
        const detectionData = {
          status: currentStatus,
          ear: 0.25,
          nose_x: 0.5,
          nose_y: 0.5,
          timestamp: now
        };
        
        if (onStatusChange) {
          onStatusChange(detectionData);
          console.log('📤 Sent status:', currentStatus);
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

      animationFrameRef.current = requestAnimationFrame(detectFace);
    };

    initializeCamera();

    return () => {
      mounted = false;
      console.log('🛑 Stopping camera');
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
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

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        padding: '20px',
        textAlign: 'center',
        fontSize: '14px',
        borderRadius: '8px',
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>Camera Error</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
        autoPlay
        muted
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
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

      {!isActive && !error && (
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