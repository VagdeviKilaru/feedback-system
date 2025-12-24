import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export function calculateEyeAspectRatio(eyeLandmarks) {
    if (!eyeLandmarks || eyeLandmarks.length < 6) return 1.0;

    const v1 = distance(eyeLandmarks[1], eyeLandmarks[5]);
    const v2 = distance(eyeLandmarks[2], eyeLandmarks[4]);
    const h = distance(eyeLandmarks[0], eyeLandmarks[3]);

    return (v1 + v2) / (2.0 * h);
}

export function estimateGazeDirection(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 478) {
        return { x: 0, y: 0 };
    }

    const leftIris = [468, 469, 470, 471, 472].map(i => faceLandmarks[i]);
    const rightIris = [473, 474, 475, 476, 477].map(i => faceLandmarks[i]);

    const leftIrisCenter = getCenter(leftIris);
    const rightIrisCenter = getCenter(rightIris);

    const leftEyeCorner = faceLandmarks[33];
    const rightEyeCorner = faceLandmarks[263];

    const leftGazeX = (leftIrisCenter.x - leftEyeCorner.x) * 2 - 1;
    const rightGazeX = (rightIrisCenter.x - rightEyeCorner.x) * 2 - 1;

    const leftGazeY = (leftIrisCenter.y - leftEyeCorner.y) * 2 - 1;
    const rightGazeY = (rightIrisCenter.y - rightEyeCorner.y) * 2 - 1;

    return {
        x: (leftGazeX + rightGazeX) / 2,
        y: (leftGazeY + rightGazeY) / 2,
    };
}

export function estimateHeadPose(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 478) {
        return { pitch: 0, yaw: 0, roll: 0 };
    }

    const noseTip = faceLandmarks[1];
    const chin = faceLandmarks[152];
    const leftEye = faceLandmarks[33];
    const rightEye = faceLandmarks[263];

    const faceWidth = Math.abs(rightEye.x - leftEye.x);
    const noseOffset = noseTip.x - (leftEye.x + rightEye.x) / 2;
    const yaw = (noseOffset / faceWidth) * 60;

    const faceHeight = Math.abs(chin.y - ((leftEye.y + rightEye.y) / 2));
    const noseVerticalPos = (noseTip.y - ((leftEye.y + rightEye.y) / 2)) / faceHeight;
    const pitch = (noseVerticalPos - 0.5) * 60;

    const eyeSlope = (rightEye.y - leftEye.y) / (rightEye.x - leftEye.x);
    const roll = Math.atan(eyeSlope) * (180 / Math.PI);

    return {
        pitch: Math.round(pitch),
        yaw: Math.round(yaw),
        roll: Math.round(roll),
    };
}

export function extractAttentionFeatures(results) {
    if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        return null;
    }

    const faceLandmarks = results.multiFaceLandmarks[0];

    const leftEyeLandmarks = [33, 160, 158, 133, 153, 144].map(i => faceLandmarks[i]);
    const rightEyeLandmarks = [362, 385, 387, 263, 373, 380].map(i => faceLandmarks[i]);

    const leftEAR = calculateEyeAspectRatio(leftEyeLandmarks);
    const rightEAR = calculateEyeAspectRatio(rightEyeLandmarks);
    const eyeAspectRatio = (leftEAR + rightEAR) / 2;

    const gazeDirection = estimateGazeDirection(faceLandmarks);
    const headPose = estimateHeadPose(faceLandmarks);

    return {
        eye_aspect_ratio: eyeAspectRatio,
        gaze_direction: gazeDirection,
        head_pose: headPose,
        timestamp: Date.now(),
    };
}

export async function initializeMediaPipe(videoElement, onResults) {
    const faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 1280,
        height: 720,
    });

    await camera.start();

    return { faceMesh, camera };
}

function distance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getCenter(points) {
    const sum = points.reduce(
        (acc, point) => ({
            x: acc.x + point.x,
            y: acc.y + point.y,
            z: acc.z + (point.z || 0),
        }),
        { x: 0, y: 0, z: 0 }
    );

    return {
        x: sum.x / points.length,
        y: sum.y / points.length,
        z: sum.z / points.length,
    };
}