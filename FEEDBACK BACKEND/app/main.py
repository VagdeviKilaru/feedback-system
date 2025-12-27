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
    description="Real-Time Student Feedback Generator & Attention Tracker",
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
        "message": "Live Feedback System API",
        "description": "Real-Time Student Feedback Generator & Attention Tracker",
        "version": "1.0.0",
        "endpoints": {
            "student_websocket": "/ws/student/{room_id}/{student_id}",
            "teacher_websocket": "/ws/teacher",
            "check_room": "/room/{room_id}/exists",
            "health": "/health",
            "stats": "/stats"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "total_rooms": len(manager.rooms_teachers),
        "time": get_ist_timestamp()
    }

# Stats endpoint
@app.get("/stats")
async def get_stats():
    total_students = sum(len(students) for students in manager.rooms_students.values())
    total_teachers = sum(len(teachers) for teachers in manager.rooms_teachers.values())
    
    return {
        "total_rooms": len(manager.rooms_teachers),
        "total_students": total_students,
        "total_teachers": total_teachers,
        "time": get_ist_timestamp()
    }

# Check if room exists endpoint
@app.get("/room/{room_id}/exists")
async def check_room_exists(room_id: str):
    """Check if a room exists"""
    return {
        "exists": manager.room_exists(room_id),
        "room_id": room_id
    }

# Student WebSocket endpoint
@app.websocket("/ws/student/{room_id}/{student_id}")
async def student_websocket(
    websocket: WebSocket,
    room_id: str,
    student_id: str,
    name: str = Query(..., description="Student name")
):
    """WebSocket endpoint for students to join a specific room"""
    
    # Check if room exists
    if not manager.room_exists(room_id):
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": f"Room {room_id} not found. Please check the room code."
        })
        await websocket.close(code=4004, reason="Room not found")
        print(f"❌ Student tried to join non-existent room: {room_id}")
        return
    
    success = await manager.connect_student(websocket, room_id, student_id, name)
    
    if not success:
        return
    
    # Send current participant list to the newly joined student
    current_participants = []
    
    # Get all students in room
    if room_id in manager.rooms_students_info:
        for sid, info in manager.rooms_students_info[room_id].items():
            current_participants.append({
                'id': sid,
                'name': info['name'],
                'type': 'student'
            })
    
    # Add teacher if exists
    if room_id in manager.rooms_teachers and len(manager.rooms_teachers[room_id]) > 0:
        current_participants.append({
            'id': 'teacher',
            'name': 'Teacher',
            'type': 'teacher'
        })
    
    # Send participant list to new student
    await websocket.send_json({
        "type": "participant_list",
        "data": {
            "participants": current_participants
        }
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
                
                # Update student attention status
                await manager.update_student_attention(room_id, student_id, {
                    "status": status,
                    "confidence": confidence,
                    "gaze_direction": analysis.get("gaze_direction"),
                    "head_pose": analysis.get("head_pose")
                })
                
                # Generate and send alert if needed
                alert = analyzer.generate_alert(student_id, name, status, analysis)
                if alert:
                    await manager.send_alert(room_id, student_id, alert)
            
            elif message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
            
            elif message_type == "chat_message":
                # Broadcast chat to room (with IST timestamp)
                await manager.broadcast_to_room_teachers(room_id, {
                    "type": "chat_message",
                    "data": {
                        "user_id": student_id,
                        "user_name": name,
                        "user_type": "student",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()  # IST
                    }
                })
                # Also broadcast to other students
                await manager.broadcast_to_room_students(room_id, {
                    "type": "chat_message",
                    "data": {
                        "user_id": student_id,
                        "user_name": name,
                        "user_type": "student",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()  # IST
                    }
                })
    
    except WebSocketDisconnect:
        await manager.disconnect_student(room_id, student_id)
        analyzer.reset_student_tracking(student_id)
    except Exception as e:
        print(f"Error in student websocket: {e}")
        await manager.disconnect_student(room_id, student_id)
        analyzer.reset_student_tracking(student_id)


# Teacher WebSocket endpoint
@app.websocket("/ws/teacher")
async def teacher_websocket(
    websocket: WebSocket,
    room_id: str = Query(None, description="Optional: Join existing room"),
    name: str = Query("Teacher", description="Teacher name")
):
    """WebSocket endpoint for teachers - creates or joins a room"""
    
    created_room_id = await manager.connect_teacher(websocket, room_id, name)
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
            
            elif message_type == "request_update":
                # Teacher requests current state
                students_list = []
                if created_room_id in manager.rooms_students_info:
                    students_list = list(manager.rooms_students_info[created_room_id].values())
                
                await websocket.send_json({
                    "type": "state_update",
                    "data": {"students": students_list}
                })
            
            elif message_type == "chat_message":
                # Broadcast chat to room (with IST timestamp)
                await manager.broadcast_to_room_teachers(created_room_id, {
                    "type": "chat_message",
                    "data": {
                        "user_id": "teacher",
                        "user_name": name,
                        "user_type": "teacher",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()  # IST
                    }
                })
                # Also broadcast to students
                await manager.broadcast_to_room_students(created_room_id, {
                    "type": "chat_message",
                    "data": {
                        "user_id": "teacher",
                        "user_name": name,
                        "user_type": "teacher",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()  # IST
                    }
                })
    
    except WebSocketDisconnect:
        await manager.disconnect_teacher(websocket)
    except Exception as e:
        print(f"Error in teacher websocket: {e}")
        await manager.disconnect_teacher(websocket)


