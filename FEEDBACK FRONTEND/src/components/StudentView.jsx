import React, { useEffect, useRef, useState } from "react";
import { WebSocketManager } from "../utils/websocket";
import {
  initializeMediaPipe,
  extractAttentionFeatures,
} from "../utils/mediapipe";

const StudentView = ({
  studentId = "student-1",
  studentName = "Student",
}) => {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const cameraRef = useRef(null);

  const [status, setStatus] = useState({
    connected: false,
    cameraActive: false,
    currentStatus: "initializing",
    attentionScore: 0,
  });

  const [error, setError] = useState(null);

  // ===============================
  // WebSocket message handler
  // ===============================
  const handleWebSocketMessage = (data) => {
    if (data.type === "analysis_result") {
      setStatus((prev) => ({
        ...prev,
        currentStatus: data.data.status,
        attentionScore: data.data.confidence ?? 0,
      }));
    }
  };

  // ===============================
  // Init system
  // ===============================
  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        // ✅ Railway backend URL
        const WS_BASE =
          import.meta.env.VITE_WS_URL || "ws://localhost:8000";

        // ✅ MATCHES FastAPI:
        // /ws/student/{student_id}?name=...
        const ws = new WebSocketManager(
          `${WS_BASE}/ws/student/${studentId}?name=${encodeURIComponent(
            studentName
          )}`,
          handleWebSocketMessage
        );

        await ws.connect();
        wsRef.current = ws;

        if (mounted) {
          setStatus((s) => ({ ...s, connected: true }));
        }

        // MediaPipe
        const { camera } = await initializeMediaPipe(
          videoRef.current,
          (results) => {
            const features = extractAttentionFeatures(results);

            if (features && ws.isConnected()) {
              ws.send({
                type: "attention_update",
                data: features,
              });
            }
          }
        );

        cameraRef.current = camera;

        if (mounted) {
          setStatus((s) => ({ ...s, cameraActive: true }));
        }
      } catch (err) {
        console.error(err);
        setError("Failed to connect camera or server");
      }
    };

    start();

    return () => {
      mounted = false;
      wsRef.current?.disconnect();
      cameraRef.current?.stop();
    };
  }, [studentId, studentName]);

  // ===============================
  // UI
  // ===============================
  return (
    <div style={{ padding: 24 }}>
      <h2>Student View</h2>

      <p>
        WebSocket:{" "}
        <b style={{ color: status.connected ? "green" : "red" }}>
          {status.connected ? "Connected" : "Disconnected"}
        </b>
      </p>

      <p>
        Camera:{" "}
        <b style={{ color: status.cameraActive ? "green" : "red" }}>
          {status.cameraActive ? "Active" : "Inactive"}
        </b>
      </p>

      <p>Status: {status.currentStatus}</p>
      <p>Attention: {Math.round(status.attentionScore * 100)}%</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", maxWidth: 600 }}
      />
    </div>
  );
};

export default StudentView;
