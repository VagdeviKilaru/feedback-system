from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import pytz
import asyncio

from app.websocket_manager import manager
from app.ai_processor import analyzer

IST = pytz.timezone('Asia/Kolkata')

def get_ist_timestamp():
    return datetime.now(IST).isoformat()

app = FastAPI(
    title="Live Feedback System",
    description="Real-Time Student Attention Monitoring",
    version="2.0.0"
)

# CORS Configuration
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
        "status": "running",
        "version": "2.0.0",
        "active_rooms": len(manager.rooms_teachers)
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "rooms": len(manager.rooms_teachers),
        "total_students": sum(len(students) for students in manager.rooms_students.values()),
        "timestamp": get_ist_timestamp()
    }

@app.get("/room/{room_id}/exists")
async def check_room(room_id: str):
    return {
        "exists": manager.room_exists(room_id),
        "room_id": room_id
    }

@app.websocket("/ws/student/{room_id}/{student_id}")
async def student_websocket(
    websocket: WebSocket,
    room_id: str,
    student_id: str,
    name: str = Query(..., description="Student name")
):
    """WebSocket for students"""
    
    # Check room exists
    if not manager.room_exists(room_id):
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": f"Room {room_id} does not exist. Please check the room code."
        })
        await websocket.close(code=4004, reason="Room not found")
        print(f"❌ Student tried to join non-existent room: {room_id}")
        return
    
    # Connect student
    success = await manager.connect_student(websocket, room_id, student_id, name)
    if not success:
        return
    
    print(f"✅ Student '{name}' ({student_id}) joined room {room_id}")
    
    # Send participant list
    participants = []
    if room_id in manager.rooms_students_info:
        for sid, info in manager.rooms_students_info[room_id].items():
            participants.append({
                'id': sid,
                'name': info['name'],
                'type': 'student'
            })
    
    if room_id in manager.rooms_teachers and len(manager.rooms_teachers[room_id]) > 0:
        participants.append({
            'id': 'teacher',
            'name': 'Teacher',
            'type': 'teacher'
        })
    
    await websocket.send_json({
        "type": "participant_list",
        "data": {"participants": participants}
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "attention_update":
                detection_data = data.get("data", {})
                
                print(f"📥 RECEIVED from {name}: status={detection_data.get('status')}, ear={detection_data.get('ear', 0):.3f}")
                
                # Analyze attention
                status, confidence, analysis = analyzer.analyze_attention(student_id, detection_data)
                
                print(f"📊 ANALYZED: {status}")
                
                # Update student status
                await manager.update_student_attention(room_id, student_id, {
                    "status": status,
                    "confidence": confidence
                })
                
                # Generate alert (or clear alert)
                alert = analyzer.generate_alert(student_id, name, status, analysis)
                if alert:
                    if alert['alert_type'] == 'clear_alert':
                        print(f"✅ CLEAR ALERT for {name}")
                        await manager.broadcast_to_room_teachers(room_id, {
                            "type": "clear_alert",
                            "data": {"student_id": student_id}
                        })
                    else:
                        print(f"🚨 NEW ALERT: {alert['message']}")
                        await manager.broadcast_to_room_teachers(room_id, {
                            "type": "alert",
                            "data": {
                                "student_id": student_id,
                                "student_name": name,
                                "alert_type": alert['alert_type'],
                                "message": alert['message'],
                                "severity": alert['severity'],
                                "timestamp": get_ist_timestamp()
                            }
                        })
                        print(f"✅ ALERT SENT to teacher dashboard")
            
            elif msg_type == "camera_frame":
                frame_data = data.get("frame")
                if frame_data:
                    await manager.broadcast_camera_frame(room_id, student_id, frame_data)
            
            elif msg_type == "chat_message":
                message = data.get("message", "")
                chat_data = {
                    "type": "chat_message",
                    "data": {
                        "user_id": student_id,
                        "user_name": name,
                        "user_type": "student",
                        "message": message,
                        "timestamp": get_ist_timestamp()
                    }
                }
                # Broadcast to teachers and all students
                await manager.broadcast_to_room_teachers(room_id, chat_data)
                await manager.broadcast_to_room_students(room_id, chat_data)
            
            elif msg_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
    
    except WebSocketDisconnect:
        print(f"❌ Student '{name}' disconnected from room {room_id}")
        await manager.disconnect_student(room_id, student_id)
        analyzer.reset_student_tracking(student_id)
    except Exception as e:
        print(f"❌ Error in student websocket: {e}")
        await manager.disconnect_student(room_id, student_id)
        analyzer.reset_student_tracking(student_id)


@app.websocket("/ws/teacher")
async def teacher_websocket(
    websocket: WebSocket,
    room_id: str = Query(None, description="Optional: Join existing room"),
    name: str = Query("Teacher", description="Teacher name")
):
    """WebSocket for teachers - creates or joins room"""
    
    created_room_id = await manager.connect_teacher(websocket, room_id, name)
    
    print(f"✅ Teacher connected - Room: {created_room_id}")
    
    # Heartbeat to keep connection alive
    async def send_heartbeat():
        try:
            while True:
                await asyncio.sleep(30)
                if websocket.client_state.name == "CONNECTED":
                    await websocket.send_json({"type": "heartbeat"})
        except:
            pass
    
    heartbeat_task = asyncio.create_task(send_heartbeat())
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
            
            elif msg_type == "request_update":
                # Teacher requests current state
                students_list = []
                if created_room_id in manager.rooms_students_info:
                    students_list = list(manager.rooms_students_info[created_room_id].values())
                
                await websocket.send_json({
                    "type": "state_update",
                    "data": {"students": students_list}
                })
            
            elif msg_type == "chat_message":
                message = data.get("message", "")
                chat_data = {
                    "type": "chat_message",
                    "data": {
                        "user_id": "teacher",
                        "user_name": name,
                        "user_type": "teacher",
                        "message": message,
                        "timestamp": get_ist_timestamp()
                    }
                }
                # Broadcast to all teachers and students in room
                await manager.broadcast_to_room_teachers(created_room_id, chat_data)
                await manager.broadcast_to_room_students(created_room_id, chat_data)
    
    except WebSocketDisconnect:
        print(f"❌ Teacher disconnected from room {created_room_id}")
        heartbeat_task.cancel()
        await manager.disconnect_teacher(websocket)
    except Exception as e:
        print(f"❌ Error in teacher websocket: {e}")
        heartbeat_task.cancel()
        await manager.disconnect_teacher(websocket)


