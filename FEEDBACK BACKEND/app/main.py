from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from app.websocket_manager import manager
from app.ai_processor import analyzer

# Initialize FastAPI app
app = FastAPI(
    title="Real-Time Attention Monitoring System",
    description="AI-powered student attention monitoring for online classes",
    version="1.0.0"
)

# Configure CORS (allow frontend access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production you can restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Root endpoint
# -----------------------------
@app.get("/")
async def root():
    return {
        "message": "Real-Time Attention Monitoring System API",
        "version": "1.0.0",
        "endpoints": {
            "student_websocket": "/ws/student/{student_id}?name=StudentName",
            "teacher_websocket": "/ws/teacher",
            "health": "/health",
            "stats": "/stats"
        }
    }

# -----------------------------
# Health check endpoint
# -----------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_students": manager.get_active_students_count(),
        "active_teachers": manager.get_active_teachers_count()
    }

# -----------------------------
# Stats endpoint
# -----------------------------
@app.get("/stats")
async def get_stats():
    return {
        "total_students": manager.get_active_students_count(),
        "total_teachers": manager.get_active_teachers_count(),
        "students_info": list(manager.students_info.values())
    }

# -----------------------------
# Student WebSocket endpoint
# -----------------------------
@app.websocket("/ws/student/{student_id}")
async def student_websocket(
    websocket: WebSocket,
    student_id: str,
    name: str = Query(..., description="Student name")
):
    await manager.connect_student(websocket, student_id, name)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "attention_update":
                landmark_data = data.get("data", {})

                # Analyze attention
                status, confidence, analysis = analyzer.analyze_attention(
                    student_id,
                    landmark_data
                )

                # Update student attention
                await manager.update_student_attention(
                    student_id,
                    {
                        "status": status,
                        "confidence": confidence,
                        "gaze_direction": analysis.get("gaze_direction"),
                        "head_pose": analysis.get("head_pose")
                    }
                )

                # Send alert if needed
                if status != "attentive":
                    alert = analyzer.generate_alert(
                        student_id, name, status, analysis
                    )
                    if alert:
                        await manager.send_alert(student_id, alert)

            elif message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})

    except WebSocketDisconnect:
        await manager.disconnect_student(student_id)
        analyzer.reset_student_tracking(student_id)

    except Exception as e:
        print(f"Student WebSocket error: {e}")
        await manager.disconnect_student(student_id)
        analyzer.reset_student_tracking(student_id)

# -----------------------------
# Teacher WebSocket endpoint
# -----------------------------
@app.websocket("/ws/teacher")
async def teacher_websocket(websocket: WebSocket):
    await manager.connect_teacher(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})

            elif message_type == "request_update":
                students_list = list(manager.students_info.values())
                await websocket.send_json({
                    "type": "state_update",
                    "data": {"students": students_list}
                })

    except WebSocketDisconnect:
        await manager.disconnect_teacher(websocket)

    except Exception as e:
        print(f"Teacher WebSocket error: {e}")
        await manager.disconnect_teacher(websocket)

# -----------------------------
# Railway entry point
# -----------------------------
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
