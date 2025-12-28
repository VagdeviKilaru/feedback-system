from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import uvicorn
from typing import Optional
from datetime import datetime
import pytz

from app.websocket_manager import manager
from app.ai_processor import analyzer

# IST Timezone
IST = pytz.timezone('Asia/Kolkata')

def get_ist_timestamp():
    """Get current timestamp in IST"""
    return datetime.now(IST).isoformat()

# Initialize FastAPI app
app = FastAPI(
    title="Live Feedback System",
    description="Real-Time Student Feedback & Attention Tracker",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Live Feedback System API",
        "version": "2.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "total_rooms": len(manager.rooms_teachers),
        "time": get_ist_timestamp()
    }

@app.websocket("/ws/student/{room_id}/{student_id}")
async def student_websocket(
    websocket: WebSocket,
    room_id: str,
    student_id: str,
    name: str = Query(..., description="Student name")
):
    """WebSocket endpoint for students"""
    
    # Check if room exists
    if not manager.room_exists(room_id):
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": f"Room {room_id} not found"
        })
        await websocket.close(code=4004, reason="Room not found")
        return
    
    success = await manager.connect_student(websocket, room_id, student_id, name)
    
    if not success:
        return
    
    print(f"✅ Student {name} ({student_id}) joined room {room_id}")
    
    # Send participant list
    current_participants = []
    if room_id in manager.rooms_students_info:
        for sid, info in manager.rooms_students_info[room_id].items():
            current_participants.append({
                'id': sid,
                'name': info['name'],
                'type': 'student'
            })
    
    if room_id in manager.rooms_teachers and len(manager.rooms_teachers[room_id]) > 0:
        current_participants.append({
            'id': 'teacher',
            'name': 'Teacher',
            'type': 'teacher'
        })
    
    await websocket.send_json({
        "type": "participant_list",
        "data": {"participants": current_participants}
    })
    
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
                
                # Update student status
                await manager.update_student_attention(room_id, student_id, {
                    "status": status,
                    "confidence": confidence
                })
                
                # Generate alert (or clear alert if attentive)
                alert = analyzer.generate_alert(student_id, name, status, analysis)
                if alert:
                    if alert['alert_type'] == 'resolved':
                        # Remove alert from teacher dashboard
                        await manager.remove_alert(room_id, student_id)
                    else:
                        # Send new alert to teacher
                        await manager.send_alert(room_id, student_id, alert)
            
            elif message_type == "camera_frame":
                frame_data = data.get("frame")
                if frame_data:
                    await manager.broadcast_camera_frame(room_id, student_id, frame_data)
            
            elif message_type == "chat_message":
                chat_data = {
                    "type": "chat_message",
                    "data": {
                        "user_id": student_id,
                        "user_name": name,
                        "user_type": "student",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()
                    }
                }
                await manager.broadcast_to_room_teachers(room_id, chat_data)
                await manager.broadcast_to_room_students(room_id, chat_data)
    
    except WebSocketDisconnect:
        print(f"❌ Student {name} disconnected")
        await manager.disconnect_student(room_id, student_id)
        analyzer.reset_student_tracking(student_id)

@app.websocket("/ws/teacher")
async def teacher_websocket(
    websocket: WebSocket,
    room_id: str = Query(None),
    name: str = Query("Teacher")
):
    """WebSocket endpoint for teachers"""
    
    created_room_id = await manager.connect_teacher(websocket, room_id, name)
    print(f"✅ Teacher connected - Room: {created_room_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "chat_message":
                chat_data = {
                    "type": "chat_message",
                    "data": {
                        "user_id": "teacher",
                        "user_name": name,
                        "user_type": "teacher",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()
                    }
                }
                await manager.broadcast_to_room_teachers(created_room_id, chat_data)
                await manager.broadcast_to_room_students(created_room_id, chat_data)
    
    except WebSocketDisconnect:
        print(f"❌ Teacher disconnected")
        await manager.disconnect_teacher(websocket)

