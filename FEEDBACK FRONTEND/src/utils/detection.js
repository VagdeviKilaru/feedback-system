// Perfect detection logic based on reference code
export function classifyAttention(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return { status: 'no_face', confidence: 0 };
    }

    // Eye landmarks (MediaPipe FaceMesh indices)
    const leftUpper = landmarks[159];
    const leftLower = landmarks[145];
    const leftLeft = landmarks[33];
    const leftRight = landmarks[133];

    const rightUpper = landmarks[386];
    const rightLower = landmarks[374];
    const rightLeft = landmarks[362];
    const rightRight = landmarks[263];

    // Nose for gaze detection
    const nose = landmarks[1];

    // Calculate distances
    function dist(a, b) {
        if (!a || !b) return 0;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Eye Aspect Ratio
    const leftEAR = dist(leftUpper, leftLower) / (dist(leftLeft, leftRight) || 1);
    const rightEAR = dist(rightUpper, rightLower) / (dist(rightLeft, rightRight) || 1);
    const ear = (leftEAR + rightEAR) / 2;

    // Thresholds (calibrated from reference images)
    const EYE_CLOSED_THRESHOLD = 0.15;
    const CENTER_LEFT = 0.35;
    const CENTER_RIGHT = 0.65;

    // Detection priority
    // 1. Head turned / Looking away (nose position)
    if (nose && (nose.x < CENTER_LEFT || nose.x > CENTER_RIGHT)) {
        console.log('👀 LOOKING AWAY - Nose X:', nose.x.toFixed(2));
        return { status: 'looking_away', confidence: 0.9 };
    }

    // 2. Eyes closed / Drowsy
    if (ear < EYE_CLOSED_THRESHOLD) {
        console.log('😴 DROWSY - EAR:', ear.toFixed(3));
        return { status: 'drowsy', confidence: 0.95 };
    }

    // 3. Normal / Attentive
    return { status: 'attentive', confidence: 1.0 };
}

export function getStatusColor(status) {
    const colors = {
        attentive: '#22c55e',
        looking_away: '#f59e0b',
        drowsy: '#ef4444',
        no_face: '#6b7280',
    };
    return colors[status] || '#6b7280';
}

export function getStatusLabel(status) {
    const labels = {
        attentive: 'ATTENTIVE',
        looking_away: 'LOOKING AWAY',
        drowsy: 'DROWSY',
        no_face: 'NO FACE',
    };
    return labels[status] || 'UNKNOWN';
}

// Format time to IST
export function formatTimeIST(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export function formatTimeAgoIST(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
    });
}