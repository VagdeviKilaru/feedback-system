import React, { useEffect, useRef, useState } from "react";

// ✅ NAMED IMPORTS (MATCH utils)
import { WebSocketManager } from "../utils/websocket";
import { initializeMediaPipe, extractAttentionFeatures } from "../utils/mediapipe";

const StudentView = ({ studentId = "student-1", sessionId = "session-1" }) => {
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
        attentionScore: data.data.attention_score,
      }));
    }
  };

  // ===============================
  // Initialize everything
  // ===============================
  useEffect(() => {
    let mounted = true;

    const startSystem = async () => {
      try {
        /* ---------- WebSocket ---------- */
        const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
        const ws = new WebSocketManager(
          `${WS_URL}/ws/student/${studentId}/${sessionId}`,
          handleWebSocketMessage
        );

        await ws.connect();
        wsRef.current = ws;

        if (mounted) {
          setStatus((prev) => ({ ...prev, connected: true }));
        }

        /* ---------- MediaPipe ---------- */
        const { camera } = await initializeMediaPipe(
          videoRef.current,
          (results) => {
            const features = extractAttentionFeatures(results);

            if (features && ws.isConnected()) {
              ws.send({
                type: "features",
                data: features,
              });
            }
          }
        );

        cameraRef.current = camera;

        if (mounted) {
          setStatus((prev) => ({ ...prev, cameraActive: true }));
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to start camera or connect to server");
      }
    };

    startSystem();

    return () => {
      mounted = false;

      if (wsRef.current) {
        wsRef.current.disconnect();
      }

      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [studentId, sessionId]);

  // ===============================
  // UI helpers
  // ===============================
  const getStatusColor = () => {
    switch (status.currentStatus) {
      case "attentive":
        return "#22c55e";
      case "distracted":
        return "#f59e0b";
      case "drowsy":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = () => {
    switch (status.currentStatus) {
      case "attentive":
        return "Attentive ✓";
      case "distracted":
        return "Distracted ⚠";
      case "drowsy":
        return "Drowsy 😴";
      default:
        return "Initializing...";
    }
  };

  // ===============================
  // UI
  // ===============================
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#020617,#1e3a8a)",
        padding: "24px",
        color: "white",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
          Student Monitoring View
        </h1>

        <p style={{ color: "#cbd5f5", marginBottom: "24px" }}>
          Student: <b>{studentId}</b> | Session: <b>{sessionId}</b>
        </p>

        {/* STATUS BAR */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "#020617",
            borderRadius: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div>
              WebSocket:{" "}
              <span style={{ color: status.connected ? "#22c55e" : "#ef4444" }}>
                {status.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div>
              Camera:{" "}
              <span
                style={{ color: status.cameraActive ? "#22c55e" : "#ef4444" }}
              >
                {status.cameraActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "8px 16px",
              backgroundColor: getStatusColor(),
              borderRadius: "999px",
              fontWeight: "600",
            }}
          >
            {getStatusText()} — {Math.round(status.attentionScore * 100)}%
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              backgroundColor: "#7f1d1d",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* VIDEO */}
        <div
          style={{
            backgroundColor: "#020617",
            borderRadius: "16px",
            padding: "12px",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", borderRadius: "12px" }}
          />
        </div>
      </div>
    </div>
  );
};

export default StudentView;
