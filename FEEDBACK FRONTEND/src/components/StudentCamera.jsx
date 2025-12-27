import { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { classifyAttention, getStatusColor, getStatusLabel } from "../utils/detection";

export default function StudentCamera({ studentId, studentName, onStatusChange, onFrameCapture }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [currentStatus, setCurrentStatus] = useState("no_face");
    const [cameraActive, setCameraActive] = useState(false);

    const lastStatusRef = useRef("no_face");
    const lastSentTimeRef = useRef(0);
    const frameIntervalRef = useRef(null);

    useEffect(() => {
        let camera = null;
        let faceMesh = null;
        let processing = false;

        async function setupCamera() {
            if (!videoRef.current) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user", width: 640, height: 480, frameRate: 15 },
                    audio: false
                });

                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraActive(true);

                const canvas = canvasRef.current;
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;

                // send frames to teacher every second
                frameIntervalRef.current = setInterval(() => {
                    if (!videoRef.current || !canvasRef.current || !onFrameCapture) return;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                    const frameData = canvas.toDataURL("image/jpeg", 0.6);
                    onFrameCapture(frameData);
                }, 1000);

                // FaceMesh
                faceMesh = new FaceMesh({
                    locateFile: (file) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
                });

                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.6,
                    selfieMode: true
                });

                faceMesh.onResults((results) => {
                    const now = performance.now();

                    let detection;
                    if (!results.multiFaceLandmarks?.length) {
                        detection = { status: "no_face", confidence: 0 };
                    } else {
                        detection = classifyAttention(results.multiFaceLandmarks[0]);
                    }

                    setCurrentStatus(detection.status);

                    if (
                        detection.status !== lastStatusRef.current ||
                        now - lastSentTimeRef.current > 600
                    ) {
                        lastStatusRef.current = detection.status;
                        lastSentTimeRef.current = now;

                        onStatusChange?.(detection.status, detection.confidence);
                    }
                });

                camera = new Camera(videoRef.current, {
                    width: 640,
                    height: 480,
                    onFrame: async () => {
                        if (processing) return;
                        processing = true;
                        await faceMesh.send({ image: videoRef.current });
                        processing = false;
                    }
                });

                camera.start();
            } catch (e) {
                console.error("Camera setup error:", e);
                setCameraActive(false);
            }
        }

        setupCamera();

        return () => {
            if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
            if (camera) camera.stop();

            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
            }
        };
    }, [onStatusChange, onFrameCapture]);

    return (
        <div style={{ position: "relative", width: "100%", maxWidth: "640px", margin: "0 auto" }}>
            <video
                ref={videoRef}
                playsInline
                muted
                style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: "12px",
                    background: "#000",
                    transform: "scaleX(-1)",
                    objectFit: "cover"
                }}
            />

            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div
                style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "10px 22px",
                    backgroundColor: getStatusColor(currentStatus),
                    borderRadius: "22px",
                    color: "#fff",
                    fontWeight: "bold"
                }}
            >
                {getStatusLabel(currentStatus)}
            </div>

            {!cameraActive && (
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "#fff"
                    }}
                >
                    Starting camera…
                </div>
            )}
        </div>
    );
}
