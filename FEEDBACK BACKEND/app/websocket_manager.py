from fastapi import WebSocket
from typing import Dict, List
import asyncio
from datetime import datetime
import secrets
import string

class ConnectionManager:
    def __init__(self):
        self.rooms_students: Dict[str, Dict[str, WebSocket]] = {}
        self.rooms_teachers: Dict[str, List[WebSocket]] = {}
        self.rooms_students_info: Dict[str, Dict[str, dict]] = {}
        self.teacher_rooms: Dict[WebSocket, str] = {}
        self.teacher_names: Dict[WebSocket, str] = {}
        self.lock = asyncio.Lock()

    def generate_room_id(self) -> str:
        """Generate a unique 6-character room code"""
        characters = string.ascii_uppercase + string.digits
        room_id = ''.join(secrets.choice(characters) for _ in range(6))
        while room_id in self.rooms_teachers:
            room_id = ''.join(secrets.choice(characters) for _ in range(6))
        return room_id

    async def create_room(self, websocket: WebSocket, room_id: str = None):
        """Create a new room or join existing room"""
        if room_id is None:
            room_id = self.generate_room_id()
        
        async with self.lock:
            if room_id not in self.rooms_teachers:
                self.rooms_teachers[room_id] = []
                self.rooms_students[room_id] = {}
                self.rooms_students_info[room_id] = {}
                print(f"✅ Created new room: {room_id}")
            
            self.rooms_teachers[room_id].append(websocket)
            self.teacher_rooms[websocket] = room_id
        
        return room_id
    async def remove_alert(self, room_id: str, student_id: str):
        """Remove alert for a specific student"""
        await self.broadcast_to_room_teachers(room_id, {
            "type": "alert_resolved",
            "data": {
                "student_id": student_id,
                "timestamp": datetime.now().isoformat()
            }
        })
    async def connect_student(self, websocket: WebSocket, room_id: str, student_id: str, student_name: str):
        """Connect a student to a room"""
        await websocket.accept()
        
        async with self.lock:
            if room_id not in self.rooms_students:
                print(f"❌ Room {room_id} does not exist")
                return False
            
            self.rooms_students[room_id][student_id] = websocket
            self.rooms_students_info[room_id][student_id] = {
                "id": student_id,
                "name": student_name,
                "status": "attentive",
                "last_update": datetime.now().isoformat(),
                "alerts_count": 0
            }
        
        print(f"✅ Student {student_name} ({student_id}) connected to room {room_id}")
        
        # Notify ALL students in room about the new join
        await self.broadcast_to_room_students(room_id, {
            "type": "student_join",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        # Notify teachers
        await self.broadcast_to_room_teachers(room_id, {
            "type": "student_join",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        return True

    async def connect_teacher(self, websocket: WebSocket, room_id: str = None, name: str = "Teacher"):
        """Connect a teacher and create/join room"""
        await websocket.accept()
        self.teacher_names[websocket] = name
        room_id = await self.create_room(websocket, room_id)
        
        students_list = []
        async with self.lock:
            if room_id in self.rooms_students_info:
                students_list = list(self.rooms_students_info[room_id].values())
        
        await websocket.send_json({
            "type": "room_created",
            "data": {
                "room_id": room_id,
                "students": students_list
            }
        })
        
        print(f"✅ Teacher {name} created/joined room {room_id}")
        
        return room_id

    async def disconnect_student(self, room_id: str, student_id: str):
        """Disconnect a student from a room"""
        async with self.lock:
            if room_id in self.rooms_students and student_id in self.rooms_students[room_id]:
                del self.rooms_students[room_id][student_id]
            
            student_name = "Unknown"
            if room_id in self.rooms_students_info and student_id in self.rooms_students_info[room_id]:
                student_name = self.rooms_students_info[room_id][student_id]["name"]
                del self.rooms_students_info[room_id][student_id]
        
        print(f"❌ Student {student_name} ({student_id}) disconnected from room {room_id}")
        
        # Notify ALL students
        await self.broadcast_to_room_students(room_id, {
            "type": "student_leave",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        # Notify teachers
        await self.broadcast_to_room_teachers(room_id, {
            "type": "student_leave",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })

    async def disconnect_teacher(self, websocket: WebSocket):
        """Disconnect a teacher and handle room cleanup"""
        async with self.lock:
            room_id = self.teacher_rooms.get(websocket)
            
            if room_id and room_id in self.rooms_teachers:
                if websocket in self.rooms_teachers[room_id]:
                    self.rooms_teachers[room_id].remove(websocket)
                
                # Only close room if NO teachers left
                if len(self.rooms_teachers[room_id]) == 0:
                    print(f"🚪 Last teacher left - closing room {room_id}")
                    
                    # Notify all students that room is closing
                    for student_ws in list(self.rooms_students[room_id].values()):
                        try:
                            await student_ws.send_json({
                                "type": "room_closed",
                                "message": "Teacher has ended the class"
                            })
                            await student_ws.close(code=4003, reason="Teacher left")
                        except:
                            pass
                    
                    # Clean up room data
                    del self.rooms_teachers[room_id]
                    del self.rooms_students[room_id]
                    del self.rooms_students_info[room_id]
                else:
                    print(f"👨‍🏫 Teacher left but {len(self.rooms_teachers[room_id])} teacher(s) still in room {room_id}")
            
            if websocket in self.teacher_rooms:
                del self.teacher_rooms[websocket]
            
            if websocket in self.teacher_names:
                del self.teacher_names[websocket]

    async def broadcast_to_room_teachers(self, room_id: str, message: dict):
        """Broadcast message to all teachers in a room"""
        if room_id not in self.rooms_teachers:
            return
        
        disconnected_teachers = []
        
        for teacher_ws in self.rooms_teachers[room_id]:
            try:
                await teacher_ws.send_json(message)
            except Exception as e:
                print(f"❌ Error sending to teacher: {e}")
                disconnected_teachers.append(teacher_ws)
        
        for teacher_ws in disconnected_teachers:
            await self.disconnect_teacher(teacher_ws)

    async def broadcast_to_room_students(self, room_id: str, message: dict, exclude_id: str = None):
        """Broadcast message to all students in a room"""
        if room_id not in self.rooms_students:
            return
        
        disconnected_students = []
        
        for student_id, student_ws in self.rooms_students[room_id].items():
            if exclude_id and student_id == exclude_id:
                continue
            try:
                await student_ws.send_json(message)
            except Exception as e:
                print(f"❌ Error sending to student {student_id}: {e}")
                disconnected_students.append(student_id)
        
        for student_id in disconnected_students:
            await self.disconnect_student(room_id, student_id)

    async def update_student_attention(self, room_id: str, student_id: str, attention_data: dict):
        """Update student attention status"""
        async with self.lock:
            if room_id in self.rooms_students_info and student_id in self.rooms_students_info[room_id]:
                student_info = self.rooms_students_info[room_id][student_id]
                student_info["status"] = attention_data.get("status", "attentive")
                student_info["last_update"] = datetime.now().isoformat()
        
        await self.broadcast_to_room_teachers(room_id, {
            "type": "attention_update",
            "data": {
                "student_id": student_id,
                "student_name": self.rooms_students_info[room_id][student_id]["name"],
                "status": attention_data.get("status"),
                "confidence": attention_data.get("confidence", 0.0),
                "timestamp": datetime.now().isoformat()
            }
        })

    async def send_alert(self, room_id: str, student_id: str, alert_data: dict):
        """Send alert to teachers"""
        if room_id not in self.rooms_students_info or student_id not in self.rooms_students_info[room_id]:
            return
        
        await self.broadcast_to_room_teachers(room_id, {
            "type": "alert",
            "data": {
                "student_id": student_id,
                "student_name": self.rooms_students_info[room_id][student_id]["name"],
                "alert_type": alert_data.get("alert_type"),
                "message": alert_data.get("message"),
                "severity": alert_data.get("severity", "medium"),
                "timestamp": datetime.now().isoformat()
            }
        })
    async def disconnect_teacher(self, websocket: WebSocket):
        """Disconnect teacher - ONLY close room when LAST teacher leaves"""
        async with self.lock:
            room_id = self.teacher_rooms.get(websocket)
            
            if room_id and room_id in self.rooms_teachers:
                if websocket in self.rooms_teachers[room_id]:
                    self.rooms_teachers[room_id].remove(websocket)
                    print(f"👨‍🏫 Teacher left room {room_id}")
                
                # ONLY close room if NO teachers left
                if len(self.rooms_teachers[room_id]) == 0:
                    print(f"🚪 CLOSING ROOM {room_id} - Last teacher left")
                    
                    # Notify all students
                    for student_ws in list(self.rooms_students.get(room_id, {}).values()):
                        try:
                            await student_ws.send_json({
                                "type": "room_closed",
                                "message": "Teacher ended the class"
                            })
                            await student_ws.close(code=4003, reason="Room closed")
                        except:
                            pass
                    
                    # Clean up
                    if room_id in self.rooms_teachers:
                        del self.rooms_teachers[room_id]
                    if room_id in self.rooms_students:
                        del self.rooms_students[room_id]
                    if room_id in self.rooms_students_info:
                        del self.rooms_students_info[room_id]
                else:
                    print(f"👨‍🏫 Room {room_id} still has {len(self.rooms_teachers[room_id])} teacher(s)")
            
            if websocket in self.teacher_rooms:
                del self.teacher_rooms[websocket]
            if websocket in self.teacher_names:
                del self.teacher_names[websocket]
    async def broadcast_camera_frame(self, room_id: str, student_id: str, frame_data: str):
        """Broadcast camera frame from student to teachers"""
        if room_id not in self.rooms_teachers:
            return
        
        message = {
            "type": "camera_frame",
            "data": {
                "student_id": student_id,
                "frame": frame_data,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        await self.broadcast_to_room_teachers(room_id, message)

    def room_exists(self, room_id: str) -> bool:
        """Check if a room exists"""
        return room_id in self.rooms_teachers and len(self.rooms_teachers[room_id]) > 0

# Global manager instance
manager = ConnectionManager()