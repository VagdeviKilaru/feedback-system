from fastapi import WebSocket
from typing import Dict, List
import asyncio
from datetime import datetime
import secrets
import string

class ConnectionManager:
    def __init__(self):
        # Structure: {room_id: {student_id: WebSocket}}
        self.rooms_students: Dict[str, Dict[str, WebSocket]] = {}
        
        # Structure: {room_id: [teacher_websockets]}
        self.rooms_teachers: Dict[str, List[WebSocket]] = {}
        
        # Structure: {room_id: {student_id: student_info}}
        self.rooms_students_info: Dict[str, Dict[str, dict]] = {}
        
        # Track which room each teacher is in: {websocket: room_id}
        self.teacher_rooms: Dict[WebSocket, str] = {}
        
        # Store teacher names
        self.teacher_names: Dict[WebSocket, str] = {}
        
        self.lock = asyncio.Lock()

    def generate_room_id(self) -> str:
        """Generate a unique 6-character alphanumeric room ID"""
        characters = string.ascii_uppercase + string.digits
        room_id = ''.join(secrets.choice(characters) for _ in range(6))
        
        while room_id in self.rooms_teachers:
            room_id = ''.join(secrets.choice(characters) for _ in range(6))
        
        print(f"🔑 Generated new room ID: {room_id}")
        return room_id

    async def create_room(self, websocket: WebSocket, room_id: str = None):
        """Teacher creates a new room"""
        if room_id is None:
            room_id = self.generate_room_id()
        
        async with self.lock:
            if room_id not in self.rooms_teachers:
                self.rooms_teachers[room_id] = []
                self.rooms_students[room_id] = {}
                self.rooms_students_info[room_id] = {}
            
            self.rooms_teachers[room_id].append(websocket)
            self.teacher_rooms[websocket] = room_id
        
        print(f"✅ Room created/joined: {room_id} | Total rooms: {len(self.rooms_teachers)}")
        return room_id

    async def connect_student(self, websocket: WebSocket, room_id: str, student_id: str, student_name: str):
        """Connect a student to a specific room"""
        await websocket.accept()
        
        async with self.lock:
            if room_id not in self.rooms_students:
                print(f"❌ Student tried to join non-existent room: {room_id}")
                return False
            
            self.rooms_students[room_id][student_id] = websocket
            self.rooms_students_info[room_id][student_id] = {
                "id": student_id,
                "name": student_name,
                "status": "attentive",
                "last_update": datetime.now().isoformat(),
                "alerts_count": 0
            }
        
        # Notify teachers in this room
        await self.broadcast_to_room_teachers(room_id, {
            "type": "student_join",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        # Notify other students
        await self.broadcast_to_room_students(room_id, {
            "type": "student_join",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        }, exclude_id=student_id)
        
        print(f"✅ Student connected: {student_name} → Room: {room_id} | Students in room: {len(self.rooms_students[room_id])}")
        return True

    async def connect_teacher(self, websocket: WebSocket, room_id: str = None, name: str = "Teacher"):
        """Connect a teacher and create/join room"""
        await websocket.accept()
        
        # Store teacher name
        self.teacher_names[websocket] = name
        
        # Create or join room
        room_id = await self.create_room(websocket, room_id)
        
        # Send room ID and current students list
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
        
        print(f"✅ Teacher '{name}' connected to room: {room_id} | Teachers in room: {len(self.rooms_teachers[room_id])}")
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
        
        await self.broadcast_to_room_teachers(room_id, {
            "type": "student_leave",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        # Notify other students
        await self.broadcast_to_room_students(room_id, {
            "type": "student_leave",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        print(f"❌ Student disconnected: {student_name} from room: {room_id}")

    async def disconnect_teacher(self, websocket: WebSocket):
        """Disconnect a teacher from a room"""
        async with self.lock:
            room_id = self.teacher_rooms.get(websocket)
            
            if room_id and room_id in self.rooms_teachers:
                if websocket in self.rooms_teachers[room_id]:
                    self.rooms_teachers[room_id].remove(websocket)
                
                # If no teachers left in room, clean up the room
                if len(self.rooms_teachers[room_id]) == 0:
                    # Notify all students in this room
                    for student_ws in list(self.rooms_students[room_id].values()):
                        try:
                            await student_ws.close(code=4003, reason="Teacher left")
                        except:
                            pass
                    
                    # Clean up room data
                    del self.rooms_teachers[room_id]
                    del self.rooms_students[room_id]
                    del self.rooms_students_info[room_id]
                    print(f"🗑️ Room deleted: {room_id} | Remaining rooms: {len(self.rooms_teachers)}")
            
            if websocket in self.teacher_rooms:
                del self.teacher_rooms[websocket]
            
            if websocket in self.teacher_names:
                del self.teacher_names[websocket]
        
        print(f"❌ Teacher disconnected from room: {room_id}")

    async def broadcast_to_room_teachers(self, room_id: str, message: dict):
        """Send message to all teachers in a specific room"""
        if room_id not in self.rooms_teachers:
            return
        
        disconnected_teachers = []
        
        for teacher_ws in self.rooms_teachers[room_id]:
            try:
                await teacher_ws.send_json(message)
            except Exception as e:
                print(f"Error sending to teacher: {e}")
                disconnected_teachers.append(teacher_ws)
        
        # Clean up disconnected teachers
        for teacher_ws in disconnected_teachers:
            await self.disconnect_teacher(teacher_ws)

    async def broadcast_to_room_students(self, room_id: str, message: dict, exclude_id: str = None):
        """Send message to all students in a specific room"""
        if room_id not in self.rooms_students:
            return
        
        disconnected_students = []
        
        for student_id, student_ws in self.rooms_students[room_id].items():
            if exclude_id and student_id == exclude_id:
                continue
            try:
                await student_ws.send_json(message)
            except Exception as e:
                print(f"Error sending to student: {e}")
                disconnected_students.append(student_id)
        
        # Clean up disconnected students
        for student_id in disconnected_students:
            await self.disconnect_student(room_id, student_id)

    async def update_student_attention(self, room_id: str, student_id: str, attention_data: dict):
        """Update student attention status in a specific room"""
        async with self.lock:
            if room_id in self.rooms_students_info and student_id in self.rooms_students_info[room_id]:
                student_info = self.rooms_students_info[room_id][student_id]
                student_info["status"] = attention_data.get("status", "attentive")
                student_info["last_update"] = datetime.now().isoformat()
                
                if student_info["status"] != "attentive":
                    student_info["alerts_count"] += 1
        
        # Broadcast update to teachers in this room
        await self.broadcast_to_room_teachers(room_id, {
            "type": "attention_update",
            "data": {
                "student_id": student_id,
                "student_name": self.rooms_students_info[room_id][student_id]["name"],
                "status": attention_data.get("status"),
                "confidence": attention_data.get("confidence", 0.0),
                "gaze_direction": attention_data.get("gaze_direction"),
                "head_pose": attention_data.get("head_pose"),
                "timestamp": datetime.now().isoformat()
            }
        })

    async def send_alert(self, room_id: str, student_id: str, alert_data: dict):
        """Send alert to teachers in a specific room"""
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

    def get_room_students_count(self, room_id: str) -> int:
        """Get number of students in a room"""
        return len(self.rooms_students.get(room_id, {}))

    def get_room_teachers_count(self, room_id: str) -> int:
        """Get number of teachers in a room"""
        return len(self.rooms_teachers.get(room_id, []))

    def room_exists(self, room_id: str) -> bool:
        """Check if a room exists"""
        exists = room_id in self.rooms_teachers
        print(f"🔍 Room check: {room_id} exists={exists}")
        return exists

# Global instance
manager = ConnectionManager()