// ---------- ATTENTION CLASSIFIER ----------

export function classifyAttention(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return { status: 'no_face', confidence: 0 };
    }

    // Eye landmarks
    const leftUpper = landmarks[159];
    const leftLower = landmarks[145];
    const leftLeft = landmarks[33];
    const leftRight = landmarks[133];

    const rightUpper = landmarks[386];
    const rightLower = landmarks[374];
    const rightLeft = landmarks[362];
    const rightRight = landmarks[263];

    // Nose for gaze/head direction
    const nose = landmarks[1];

    function dist(a, b) {
        if (!a || !b) return 0;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Eye aspect ratio
    const leftEAR = dist(leftUpper, leftLower) / (dist(leftLeft, leftRight) || 1);
    const rightEAR = dist(rightUpper, rightLower) / (dist(rightLeft, rightRight) || 1);
    const ear = (leftEAR + rightEAR) / 2;

    // Tuned thresholds (WORK WELL ON MOST FACES)
    const EYE_CLOSED_THRESHOLD = 0.18;
    const CENTER_LEFT = 0.38;
    const CENTER_RIGHT = 0.62;

    // ----- PRIORITY -----

    // 1️⃣ Looking away first
    if (nose && (nose.x < CENTER_LEFT || nose.x > CENTER_RIGHT)) {
        return { status: 'looking_away', confidence: 0.9 };
    }

    // 2️⃣ Eyes closed = drowsy
    if (ear < EYE_CLOSED_THRESHOLD) {
        return { status: 'drowsy', confidence: 0.95 };
    }

    // 3️⃣ Otherwise attentive
    return { status: 'attentive', confidence: 1.0 };
}

// ---------- UI HELPERS ----------

export function getStatusColor(status) {
    const colors = {
        attentive: '#22c55e',
        looking_away: '#f59e0b',
        drowsy: '#ef4444',
        no_face: '#6b7280'
    };
    return colors[status] || '#6b7280';
}

export function getStatusLabel(status) {
    const labels = {
        attentive: 'ATTENTIVE',
        looking_away: 'LOOKING AWAY',
        drowsy: 'DROWSY',
        no_face: 'NO FACE'
    };
    return labels[status] || 'UNKNOWN';
}

export function formatTimeIST(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
