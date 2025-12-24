import React, { useEffect, useRef, useState } from "react";
import { WebSocketManager } from "../utils/websocket";

const STATUS_COLORS = {
    attentive: "#22c55e",
    distracted: "#f59e0b",
    drowsy: "#ef4444",
    offline: "#6b7280",
};

const STATUS_LABELS = {
    attentive: "Attentive",
    distracted: "Distracted",
    drowsy: "Drowsy",
    offline: "Offline",
};

export default function TeacherDashboard() {
    const wsRef = useRef(null);

    const [connected, setConnected] = useState(false);
    const [students, setStudents] = useState([]);
    const [alerts, setAlerts] = useState([]);

    // ===============================
    // Handle backend messages
    // ===============================
    const handleMessage = (msg) => {
        switch (msg.type) {
            case "state_update":
                setStudents(msg.data.students || []);
                break;

            case "student_join":
                setStudents((prev) => [
                    ...prev.filter((s) => s.id !== msg.data.student_id),
                    {
                        id: msg.data.student_id,
                        name: msg.data.student_name,
                        status: "attentive",
                        confidence: 1,
                        last_update: msg.data.timestamp,
                    },
                ]);
                break;

            case "student_update":
                setStudents((prev) =>
                    prev.map((s) =>
                        s.id === msg.data.student_id
                            ? {
                                ...s,
                                status: msg.data.status,
                                confidence: msg.data.confidence,
                                last_update: msg.data.timestamp,
                            }
                            : s
                    )
                );
                break;

            case "alert":
                setAlerts((prev) => [
                    {
                        student_id: msg.data.student_id,
                        student_name: msg.data.student_name,
                        message: msg.data.message,
                        severity: msg.data.severity,
                        timestamp: msg.data.timestamp,
                    },
                    ...prev,
                ]);
                break;

            default:
                break;
        }
    };

    // ===============================
    // WebSocket connect
    // ===============================
    useEffect(() => {
        const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

        const ws = new WebSocketManager(
            `${WS_URL}/ws/teacher`,
            handleMessage
        );

        ws.connect()
            .then(() => setConnected(true))
            .catch(() => setConnected(false));

        wsRef.current = ws;

        return () => ws.disconnect();
    }, []);

    // ===============================
    // Helpers
    // ===============================
    const formatTime = (ts) => {
        if (!ts) return "-";
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return new Date(ts).toLocaleTimeString();
    };

    // ===============================
    // UI
    // ===============================
    return (
        <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px" }}>
            {/* HEADER */}
            <div
                style={{
                    background: "white",
                    padding: "20px",
                    borderRadius: "12px",
                    marginBottom: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>
                        Teacher Dashboard
                    </h1>
                    <p style={{ color: "#6b7280" }}>
                        Real-Time Attention Monitoring
                    </p>
                </div>

                <div
                    style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        backgroundColor: connected ? "#dcfce7" : "#fee2e2",
                        color: connected ? "#166534" : "#991b1b",
                        fontWeight: "600",
                    }}
                >
                    {connected ? "Connected" : "Disconnected"}
                </div>
            </div>

            {/* MAIN GRID */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                }}
            >
                {/* STUDENTS LIST */}
                <div
                    style={{
                        background: "white",
                        padding: "20px",
                        borderRadius: "12px",
                        height: "600px",
                        overflowY: "auto",
                    }}
                >
                    <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>
                        Students ({students.length})
                    </h2>

                    {students.length === 0 ? (
                        <p style={{ color: "#9ca3af" }}>No students connected</p>
                    ) : (
                        students.map((s) => (
                            <div
                                key={s.id}
                                style={{
                                    border: `2px solid ${STATUS_COLORS[s.status]}`,
                                    borderRadius: "10px",
                                    padding: "16px",
                                    marginBottom: "12px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "8px",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: "600" }}>{s.name}</div>
                                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                            {s.id}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            background: STATUS_COLORS[s.status],
                                            color: "white",
                                            padding: "6px 12px",
                                            borderRadius: "999px",
                                            fontSize: "14px",
                                            fontWeight: "600",
                                        }}
                                    >
                                        {STATUS_LABELS[s.status]}
                                    </div>
                                </div>

                                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                    Confidence: {Math.round((s.confidence || 0) * 100)}% <br />
                                    Last update: {formatTime(s.last_update)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ALERTS */}
                <div
                    style={{
                        background: "white",
                        padding: "20px",
                        borderRadius: "12px",
                        height: "600px",
                        overflowY: "auto",
                    }}
                >
                    <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>
                        Alerts ({alerts.length})
                    </h2>

                    {alerts.length === 0 ? (
                        <p style={{ color: "#9ca3af" }}>No alerts 🎉</p>
                    ) : (
                        alerts.map((a, i) => (
                            <div
                                key={i}
                                style={{
                                    borderLeft: "6px solid #ef4444",
                                    padding: "12px",
                                    background: "#fef2f2",
                                    borderRadius: "8px",
                                    marginBottom: "12px",
                                }}
                            >
                                <div style={{ fontWeight: "600" }}>
                                    {a.student_name}
                                </div>
                                <div style={{ fontSize: "14px", marginTop: "4px" }}>
                                    {a.message}
                                </div>
                                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                    {formatTime(a.timestamp)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
