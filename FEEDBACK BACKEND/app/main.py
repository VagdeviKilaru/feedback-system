from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import pytz
import asyncio
import json

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
    description="Real-Time Student Attention Monitoring with Audio",
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
    """Root endpoint"""
    return {
        "message": "Live Feedback System API",
        "version": "2.0.0",
        "status": "running",
        "active_rooms": len(manager.rooms_teachers),
        "features": ["video", "audio", "detection", "alerts"]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "rooms": len(manager.rooms_teachers),
        "total_students": sum(len(students) for students in manager.rooms_students.values()),
        "timestamp": get_ist_timestamp()
    }

@app.get("/room/{room_id}/exists")
async def check_room(room_id: str):
    """Check if room exists"""
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
    """WebSocket endpoint for students"""
    
    # Check if room exists
    if not manager.room_exists(room_id):
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": f"Room {room_id} does not exist. Please check the room code."
        })
        await websocket.close(code=4004, reason="Room not found")
        print(f"❌ Student {name} tried to join non-existent room: {room_id}")
        return
    
    # Connect student
    success = await manager.connect_student(websocket, room_id, student_id, name)
    if not success:
        return
    
    print(f"✅ Student '{name}' ({student_id[:8]}...) joined room {room_id}")
    
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
                
                status = detection_data.get('status', 'no_face')
                ear = detection_data.get('ear', 1.0)
                
                print(f"📥 {name}: {status.upper()} (EAR: {ear:.3f})")
                
                # Analyze attention
                analyzed_status, confidence, analysis = analyzer.analyze_attention(student_id, detection_data)
                
                # Update student status
                await manager.update_student_attention(room_id, student_id, {
                    "status": analyzed_status,
                    "confidence": confidence
                })
                
                # Generate alert (or clear alert)
                alert = analyzer.generate_alert(student_id, name, analyzed_status, analysis)
                if alert:
                    if alert['alert_type'] == 'clear_alert':
                        print(f"✅ CLEAR ALERT: {name}")
                        await manager.broadcast_to_room_teachers(room_id, {
                            "type": "clear_alert",
                            "data": {"student_id": student_id}
                        })
                    else:
                        print(f"🚨 ALERT: {alert['message']}")
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
                        print(f"✅ Alert sent to teacher")
            
            elif msg_type == "camera_frame":
                frame_data = data.get("frame")
                if frame_data:
                    await manager.broadcast_camera_frame(room_id, student_id, frame_data)
            
            elif msg_type == "webrtc_offer":
                # Forward WebRTC offer to teacher
                print(f"📞 WebRTC offer from {name}")
                await manager.broadcast_to_room_teachers(room_id, {
                    "type": "webrtc_offer",
                    "data": {
                        "student_id": student_id,
                        "student_name": name,
                        "offer": data.get("offer")
                    }
                })
            
            elif msg_type == "webrtc_answer":
                # Forward WebRTC answer to specific student
                target_id = data.get("target_id")
                print(f"📞 WebRTC answer for {target_id[:8]}...")
                await manager.send_to_student(room_id, target_id, {
                    "type": "webrtc_answer",
                    "data": {
                        "answer": data.get("answer")
                    }
                })
            
            elif msg_type == "webrtc_ice_candidate":
                # Forward ICE candidate
                target_id = data.get("target_id")
                if target_id:
                    await manager.send_to_student(room_id, target_id, {
                        "type": "webrtc_ice_candidate",
                        "data": {
                            "candidate": data.get("candidate"),
                            "from_id": student_id
                        }
                    })
                else:
                    await manager.broadcast_to_room_teachers(room_id, {
                        "type": "webrtc_ice_candidate",
                        "data": {
                            "student_id": student_id,
                            "candidate": data.get("candidate")
                        }
                    })
            
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
    """WebSocket endpoint for teachers - creates or joins room"""
    
    # Accept connection FIRST
    await websocket.accept()
    print(f"✅ Teacher WebSocket accepted")
    
    # Create or join room
    created_room_id = None
    async with manager.lock:
        if room_id and room_id in manager.rooms_teachers:
            # Join existing room
            created_room_id = room_id
            manager.rooms_teachers[room_id].append(websocket)
            print(f"👨‍🏫 Teacher joined existing room: {created_room_id}")
        else:
            # Create NEW room
            created_room_id = manager.generate_room_id()
            manager.rooms_teachers[created_room_id] = [websocket]
            manager.rooms_students[created_room_id] = {}
            manager.rooms_students_info[created_room_id] = {}
            # CRITICAL: Store room_id IMMEDIATELY
            manager.room_ids[created_room_id] = created_room_id
            print(f"✅ Created NEW room: {created_room_id}")
            print(f"🔒 Room {created_room_id} stored permanently")
        
        manager.teacher_rooms[websocket] = created_room_id
        manager.teacher_names[websocket] = name
    
    # Get current students list
    students_list = []
    if created_room_id in manager.rooms_students_info:
        students_list = list(manager.rooms_students_info[created_room_id].values())
    
    # Send room_created message IMMEDIATELY
    try:
        await websocket.send_json({
            "type": "room_created",
            "data": {
                "room_id": created_room_id,
                "students": students_list,
                "timestamp": get_ist_timestamp()
            }
        })
        print(f"📤 Sent room_created with code: {created_room_id}")
    except Exception as e:
        print(f"❌ Error sending room_created: {e}")
        await manager.disconnect_teacher(websocket)
        return
    
    # Heartbeat
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
            
            elif msg_type == "teacher_camera_frame":
                # Teacher sends their camera frame
                frame_data = data.get("frame")
                if frame_data:
                    await manager.broadcast_to_room_students(created_room_id, {
                        "type": "teacher_frame",
                        "data": {
                            "frame": frame_data,
                            "timestamp": get_ist_timestamp()
                        }
                    })
            
            elif msg_type == "webrtc_offer":
                # Teacher sends WebRTC offer to all students
                print(f"📞 Teacher WebRTC offer")
                await manager.broadcast_to_room_students(created_room_id, {
                    "type": "webrtc_offer",
                    "data": {
                        "offer": data.get("offer"),
                        "from": "teacher"
                    }
                })
            
            elif msg_type == "webrtc_answer":
                # Forward answer to specific student
                target_id = data.get("target_id")
                print(f"📞 Teacher WebRTC answer for {target_id[:8]}...")
                await manager.send_to_student(created_room_id, target_id, {
                    "type": "webrtc_answer",
                    "data": {
                        "answer": data.get("answer")
                    }
                })
            
            elif msg_type == "webrtc_ice_candidate":
                # Forward ICE candidate
                target_id = data.get("target_id")
                if target_id:
                    await manager.send_to_student(created_room_id, target_id, {
                        "type": "webrtc_ice_candidate",
                        "data": {
                            "candidate": data.get("candidate"),
                            "from": "teacher"
                        }
                    })
                else:
                    await manager.broadcast_to_room_students(created_room_id, {
                        "type": "webrtc_ice_candidate",
                        "data": {
                            "candidate": data.get("candidate"),
                            "from": "teacher"
                        }
                    })
            
            elif msg_type == "request_update":
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


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Starting Live Feedback System Backend")
    print("=" * 60)
    print("📡 WebSocket Endpoints:")
    print("   - Student: ws://localhost:8000/ws/student/{room_id}/{student_id}?name={name}")
    print("   - Teacher: ws://localhost:8000/ws/teacher?name={name}")
    print("🌐 API: http://localhost:8000")
    print("📖 Docs: http://localhost:8000/docs")
    print("🎤 Audio: WebRTC with STUN servers")
    print("👁️  Detection: 3-rule system (attentive, looking_away, drowsy, no_face)")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )