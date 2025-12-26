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
        characters = string.ascii_uppercase + string.digits
        room_id = ''.join(secrets.choice(characters) for _ in range(6))
        while room_id in self.rooms_teachers:
            room_id = ''.join(secrets.choice(characters) for _ in range(6))
        return room_id

    async def create_room(self, websocket: WebSocket, room_id: str = None):
        if room_id is None:
            room_id = self.generate_room_id()
        
        async with self.lock:
            if room_id not in self.rooms_teachers:
                self.rooms_teachers[room_id] = []
                self.rooms_students[room_id] = {}
                self.rooms_students_info[room_id] = {}
            
            self.rooms_teachers[room_id].append(websocket)
            self.teacher_rooms[websocket] = room_id
        
        return room_id

    async def connect_student(self, websocket: WebSocket, room_id: str, student_id: str, student_name: str):
        await websocket.accept()
        
        async with self.lock:
            if room_id not in self.rooms_students:
                return False
            
            self.rooms_students[room_id][student_id] = websocket
            self.rooms_students_info[room_id][student_id] = {
                "id": student_id,
                "name": student_name,
                "status": "attentive",
                "last_update": datetime.now().isoformat(),
                "alerts_count": 0
            }
        
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
        
        return room_id

    async def disconnect_student(self, room_id: str, student_id: str):
        async with self.lock:
            if room_id in self.rooms_students and student_id in self.rooms_students[room_id]:
                del self.rooms_students[room_id][student_id]
            
            student_name = "Unknown"
            if room_id in self.rooms_students_info and student_id in self.rooms_students_info[room_id]:
                student_name = self.rooms_students_info[room_id][student_id]["name"]
                del self.rooms_students_info[room_id][student_id]
        
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
        async with self.lock:
            room_id = self.teacher_rooms.get(websocket)
            
            if room_id and room_id in self.rooms_teachers:
                if websocket in self.rooms_teachers[room_id]:
                    self.rooms_teachers[room_id].remove(websocket)
                
                if len(self.rooms_teachers[room_id]) == 0:
                    for student_ws in list(self.rooms_students[room_id].values()):
                        try:
                            await student_ws.close(code=4003, reason="Teacher left")
                        except:
                            pass
                    
                    del self.rooms_teachers[room_id]
                    del self.rooms_students[room_id]
                    del self.rooms_students_info[room_id]
            
            if websocket in self.teacher_rooms:
                del self.teacher_rooms[websocket]
            
            if websocket in self.teacher_names:
                del self.teacher_names[websocket]

    async def broadcast_to_room_teachers(self, room_id: str, message: dict):
        if room_id not in self.rooms_teachers:
            return
        
        disconnected_teachers = []
        
        for teacher_ws in self.rooms_teachers[room_id]:
            try:
                await teacher_ws.send_json(message)
            except Exception as e:
                disconnected_teachers.append(teacher_ws)
        
        for teacher_ws in disconnected_teachers:
            await self.disconnect_teacher(teacher_ws)

    async def broadcast_to_room_students(self, room_id: str, message: dict, exclude_id: str = None):
        if room_id not in self.rooms_students:
            return
        
        disconnected_students = []
        
        for student_id, student_ws in self.rooms_students[room_id].items():
            if exclude_id and student_id == exclude_id:
                continue
            try:
                await student_ws.send_json(message)
            except Exception as e:
                disconnected_students.append(student_id)
        
        for student_id in disconnected_students:
            await self.disconnect_student(room_id, student_id)

    async def update_student_attention(self, room_id: str, student_id: str, attention_data: dict):
        async with self.lock:
            if room_id in self.rooms_students_info and student_id in self.rooms_students_info[room_id]:
                student_info = self.rooms_students_info[room_id][student_id]
                student_info["status"] = attention_data.get("status", "attentive")
                student_info["last_update"] = datetime.now().isoformat()
                
                if student_info["status"] != "attentive":
                    student_info["alerts_count"] += 1
        
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

    def room_exists(self, room_id: str) -> bool:
        return room_id in self.rooms_teachers

manager = ConnectionManager()