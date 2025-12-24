from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn

from app.websocket_manager import manager
from app.ai_processor import analyzer

# Initialize FastAPI app
app = FastAPI(
    title="Real-Time Attention Monitoring System",
    description="AI-powered student attention monitoring for online classes",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Real-Time Attention Monitoring System API",
        "version": "1.0.0",
        "endpoints": {
            "student_websocket": "/ws/student/{student_id}",
            "teacher_websocket": "/ws/teacher",
            "health": "/health",
            "stats": "/stats"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_students": manager.get_active_students_count(),
        "active_teachers": manager.get_active_teachers_count()
    }

# Stats endpoint
@app.get("/stats")
async def get_stats():
    return {
        "total_students": manager.get_active_students_count(),
        "total_teachers": manager.get_active_teachers_count(),
        "students_info": [info for info in manager.students_info.values()]
    }

# Student WebSocket endpoint
@app.websocket("/ws/student/{student_id}")
async def student_websocket(
    websocket: WebSocket,
    student_id: str,
    name: str = Query(..., description="Student name")
):
    """WebSocket endpoint for students"""
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
                
                # Update student attention status
                await manager.update_student_attention(student_id, {
                    "status": status,
                    "confidence": confidence,
                    "gaze_direction": analysis.get("gaze_direction"),
                    "head_pose": analysis.get("head_pose")
                })
                
                # Generate and send alert if needed
                if status != "attentive":
                    alert = analyzer.generate_alert(student_id, name, status, analysis)
                    if alert:
                        await manager.send_alert(student_id, alert)
            
            elif message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
            
    except WebSocketDisconnect:
        await manager.disconnect_student(student_id)
        analyzer.reset_student_tracking(student_id)
    except Exception as e:
        print(f"Error in student websocket: {e}")
        await manager.disconnect_student(student_id)
        analyzer.reset_student_tracking(student_id)

# Teacher WebSocket endpoint
@app.websocket("/ws/teacher")
async def teacher_websocket(websocket: WebSocket):
    """WebSocket endpoint for teachers"""
    await manager.connect_teacher(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
            
            elif message_type == "request_update":
                students_list = [info for info in manager.students_info.values()]
                await websocket.send_json({
                    "type": "state_update",
                    "data": {"students": students_list}
                })
    
    except WebSocketDisconnect:
        await manager.disconnect_teacher(websocket)
    except Exception as e:
        print(f"Error in teacher websocket: {e}")
        await manager.disconnect_teacher(websocket)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )