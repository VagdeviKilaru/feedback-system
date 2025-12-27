//
// detection.js — stable attention detection
//

// Frame-based smoothing (prevents flicker)
let drowsyFrames = 0;
let lookAwayFrames = 0;

const DROWSY_LIMIT = 10;       // ~ 0.3–0.4s eyes closed
const LOOK_AWAY_LIMIT = 8;     // head turned for short time

// Adaptive baseline storage
let earBaseline = null;
let baselineSamples = [];

// -----------------------------------------------
export function classifyAttention(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return { status: "no_face", confidence: 0 };
    }

    function dist(a, b) {
        if (!a || !b) return 0;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Eye coordinates
    const leftEAR =
        dist(landmarks[159], landmarks[145]) /
        (dist(landmarks[33], landmarks[133]) || 1);

    const rightEAR =
        dist(landmarks[386], landmarks[374]) /
        (dist(landmarks[362], landmarks[263]) || 1);

    const ear = (leftEAR + rightEAR) / 2;

    // Build EAR baseline first ~25 frames
    if (!earBaseline) {
        baselineSamples.push(ear);

        if (baselineSamples.length >= 25) {
            earBaseline =
                baselineSamples.reduce((a, b) => a + b, 0) /
                baselineSamples.length;
        }
    }

    const EYE_CLOSED_THRESHOLD =
        earBaseline ? earBaseline * 0.55 : 0.18;

    // -------- HEAD TURN (looking away) --------
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    const faceWidth = dist(leftEye, rightEye);
    const centerX = (leftEye.x + rightEye.x) / 2;

    const normalizedNose =
        (nose.x - centerX) / (faceWidth || 1);

    const isLookingAway =
        normalizedNose > 0.25 || normalizedNose < -0.25;

    if (isLookingAway) lookAwayFrames++;
    else lookAwayFrames = Math.max(0, lookAwayFrames - 1);

    if (lookAwayFrames >= LOOK_AWAY_LIMIT) {
        return { status: "looking_away", confidence: 0.9 };
    }

    // -------- DROWSINESS (eyes closed) --------
    const eyesClosed = ear < EYE_CLOSED_THRESHOLD;

    if (eyesClosed) drowsyFrames++;
    else drowsyFrames = Math.max(0, drowsyFrames - 1);

    if (drowsyFrames >= DROWSY_LIMIT) {
        return { status: "drowsy", confidence: 0.95 };
    }

    // -------- NORMAL --------
    return { status: "attentive", confidence: 1.0 };
}

// ---------------------------------------------------------
export function getStatusColor(status) {
    const colors = {
        attentive: "#22c55e",
        looking_away: "#f59e0b",
        drowsy: "#ef4444",
        no_face: "#6b7280",
    };
    return colors[status] || "#6b7280";
}

export function getStatusLabel(status) {
    const labels = {
        attentive: "ATTENTIVE",
        looking_away: "LOOKING AWAY",
        drowsy: "DROWSY",
        no_face: "NO FACE",
    };
    return labels[status] || "UNKNOWN";
}

// ---------------------------------------------------------
export function formatTimeIST(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function formatTimeAgoIST(timestamp) {
    const now = new Date();
    const diff = Math.floor((now - new Date(timestamp)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
}
