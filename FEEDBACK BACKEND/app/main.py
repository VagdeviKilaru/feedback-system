from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import pytz

from app.websocket_manager import manager
from app.ai_processor import analyzer

IST = pytz.timezone('Asia/Kolkata')

def get_ist_timestamp():
    return datetime.now(IST).isoformat()

app = FastAPI(title="Live Feedback System", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Live Feedback System", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "rooms": len(manager.rooms_teachers)}

@app.websocket("/ws/student/{room_id}/{student_id}")
async def student_websocket(websocket: WebSocket, room_id: str, student_id: str, name: str = Query(...)):
    
    if not manager.room_exists(room_id):
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return
    
    success = await manager.connect_student(websocket, room_id, student_id, name)
    if not success:
        return
    
    print(f"✅ {name} joined {room_id}")
    
    # Send participants
    participants = []
    if room_id in manager.rooms_students_info:
        for sid, info in manager.rooms_students_info[room_id].items():
            participants.append({'id': sid, 'name': info['name'], 'type': 'student'})
    if room_id in manager.rooms_teachers and len(manager.rooms_teachers[room_id]) > 0:
        participants.append({'id': 'teacher', 'name': 'Teacher', 'type': 'teacher'})
    
    await websocket.send_json({"type": "participant_list", "data": {"participants": participants}})
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "attention_update":
                detection_data = data.get("data", {})
                
                print(f"📥 Received from {name}: {detection_data.get('status')}")
                
                # Analyze
                status, confidence, analysis = analyzer.analyze_attention(student_id, detection_data)
                
                # Update student status in manager
                await manager.update_student_attention(room_id, student_id, {
                    "status": status,
                    "confidence": confidence
                })
                
                # Generate alert (or clear alert)
                alert = analyzer.generate_alert(student_id, name, status, analysis)
                if alert:
                    if alert['alert_type'] == 'clear_alert':
                        # Send clear signal to teacher
                        await manager.broadcast_to_room_teachers(room_id, {
                            "type": "clear_alert",
                            "data": {"student_id": student_id}
                        })
                    else:
                        # Send new alert to teacher
                        print(f"📤 Sending alert to teacher: {alert['message']}")
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
            
            elif msg_type == "camera_frame":
                frame = data.get("frame")
                if frame:
                    await manager.broadcast_camera_frame(room_id, student_id, frame)
            
            elif msg_type == "chat_message":
                await manager.broadcast_to_room_teachers(room_id, {
                    "type": "chat_message",
                    "data": {
                        "user_id": student_id,
                        "user_name": name,
                        "user_type": "student",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()
                    }
                })
                await manager.broadcast_to_room_students(room_id, {
                    "type": "chat_message",
                    "data": {
                        "user_id": student_id,
                        "user_name": name,
                        "user_type": "student",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()
                    }
                })
    
    except WebSocketDisconnect:
        print(f"❌ {name} disconnected")
        await manager.disconnect_student(room_id, student_id)
        analyzer.reset_student_tracking(student_id)

@app.websocket("/ws/teacher")
async def teacher_websocket(websocket: WebSocket, room_id: str = Query(None), name: str = Query("Teacher")):
    
    created_room = await manager.connect_teacher(websocket, room_id, name)
    print(f"✅ Teacher connected: {created_room}")
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "chat_message":
                await manager.broadcast_to_room_teachers(created_room, {
                    "type": "chat_message",
                    "data": {
                        "user_id": "teacher",
                        "user_name": name,
                        "user_type": "teacher",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()
                    }
                })
                await manager.broadcast_to_room_students(created_room, {
                    "type": "chat_message",
                    "data": {
                        "user_id": "teacher",
                        "user_name": name,
                        "user_type": "teacher",
                        "message": data.get("message"),
                        "timestamp": get_ist_timestamp()
                    }
                })
    
    except WebSocketDisconnect:
        print("❌ Teacher disconnected")
        await manager.disconnect_teacher(websocket)

