from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
import uvicorn
from typing import Optional

from app.websocket_manager import manager
from app.ai_processor import analyzer

# Initialize FastAPI app
app = FastAPI(
    title="Live Feedback System",
    description="Real-Time Student Feedback Generator & Attention Tracker",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
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
        "total_rooms": len(manager.rooms_teachers)
    }

# Stats endpoint
@app.get("/stats")
async def get_stats():
    total_students = sum(len(students) for students in manager.rooms_students.values())
    total_teachers = sum(len(teachers) for teachers in manager.rooms_teachers.values())
    
    return {
        "total_rooms": len(manager.rooms_teachers),
        "total_students": total_students,
        "total_teachers": total_teachers
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
                if status != "attentive":
                    alert = analyzer.generate_alert(student_id, name, status, analysis)
                    if alert:
                        await manager.send_alert(room_id, student_id, alert)
            
            elif message_type == "heartbeat":
                await websocket.send_json({"type": "heartbeat_ack"})
            
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
    room_id: str = Query(None, description="Optional: Join existing room")
):
    """WebSocket endpoint for teachers - creates or joins a room"""
    
    created_room_id = await manager.connect_teacher(websocket, room_id)
    
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
    
    except WebSocketDisconnect:
        await manager.disconnect_teacher(websocket)
    except Exception as e:
        print(f"Error in teacher websocket: {e}")
        await manager.disconnect_teacher(websocket)


# Test page
@app.get("/test", response_class=HTMLResponse)
async def test_page():
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Test - Live Feedback System</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
            h1 { color: #333; }
            button { padding: 10px 20px; margin: 5px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 4px; }
            button:hover { background: #2563eb; }
            input { padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
            #messages { background: #f9f9f9; padding: 15px; border-radius: 4px; height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px; }
            .room-code { font-size: 24px; font-weight: bold; color: #3b82f6; letter-spacing: 2px; padding: 10px; background: #eff6ff; border-radius: 8px; display: inline-block; margin: 10px 0; }
            .section { margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎓 Live Feedback System - WebSocket Test</h1>
            <p>Real-Time Student Feedback Generator & Attention Tracker</p>
            
            <div class="section">
                <h2>👨‍🏫 Teacher Connection</h2>
                <button onclick="connectTeacher()">Connect as Teacher</button>
                <div id="roomCode"></div>
            </div>
            
            <div class="section">
                <h2>🎓 Student Connection</h2>
                <input type="text" id="roomId" placeholder="Room ID (6 digits)">
                <input type="text" id="studentId" placeholder="Student ID" value="student1">
                <input type="text" id="studentName" placeholder="Student Name" value="John Doe">
                <button onclick="connectStudent()">Connect as Student</button>
                <button onclick="sendTestData()">Send Test Data</button>
            </div>
            
            <div class="section">
                <h3>📨 Messages:</h3>
                <pre id="messages"></pre>
            </div>
        </div>

        <script>
            let studentWs = null;
            let teacherWs = null;
            let currentRoomId = null;
            const messages = document.getElementById('messages');

            function log(message) {
                const timestamp = new Date().toLocaleTimeString();
                messages.textContent += `[${timestamp}] ${message}\n`;
                messages.scrollTop = messages.scrollHeight;
            }

            function connectTeacher() {
                const wsUrl = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
                const host = window.location.host;
                const fullUrl = wsUrl + host + '/ws/teacher';
                
                log('Connecting teacher to: ' + fullUrl);
                teacherWs = new WebSocket(fullUrl);
                
                teacherWs.onopen = () => log('✅ Teacher connected');
                teacherWs.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    log('Teacher received: ' + event.data);
                    if (data.type === 'room_created') {
                        currentRoomId = data.data.room_id;
                        document.getElementById('roomCode').innerHTML = 
                            '<div class="room-code">Room Code: ' + currentRoomId + '</div>';
                        document.getElementById('roomId').value = currentRoomId;
                    }
                };
                teacherWs.onerror = (error) => log('❌ Teacher error: ' + error);
                teacherWs.onclose = () => log('🔌 Teacher disconnected');
            }

            function connectStudent() {
                const roomId = document.getElementById('roomId').value || currentRoomId;
                const id = document.getElementById('studentId').value;
                const name = document.getElementById('studentName').value;
                
                if (!roomId) {
                    alert('Please enter Room ID or create a teacher connection first');
                    return;
                }
                
                const wsUrl = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
                const host = window.location.host;
                const fullUrl = `${wsUrl}${host}/ws/student/${roomId}/${id}?name=${encodeURIComponent(name)}`;
                
                log('Connecting student to: ' + fullUrl);
                studentWs = new WebSocket(fullUrl);
                
                studentWs.onopen = () => log('✅ Student connected to room: ' + roomId);
                studentWs.onmessage = (event) => log('Student received: ' + event.data);
                studentWs.onerror = (error) => log('❌ Student error: ' + error);
                studentWs.onclose = () => log('🔌 Student disconnected');
            }

            function sendTestData() {
                if (studentWs && studentWs.readyState === WebSocket.OPEN) {
                    const data = {
                        type: 'attention_update',
                        data: {
                            gaze_direction: { x: 0.1, y: 0.05 },
                            head_pose: { pitch: 5, yaw: -3, roll: 1 },
                            eye_aspect_ratio: 0.25
                        }
                    };
                    studentWs.send(JSON.stringify(data));
                    log('📤 Sent test data');
                } else {
                    log('❌ Student not connected');
                }
            }
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
