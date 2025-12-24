from fastapi import WebSocket
from typing import Dict, List
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        self.active_students: Dict[str, WebSocket] = {}
        self.active_teachers: List[WebSocket] = []
        self.students_info: Dict[str, dict] = {}
        self.lock = asyncio.Lock()

    async def connect_student(self, websocket: WebSocket, student_id: str, student_name: str):
        """Connect a student to the system"""
        await websocket.accept()
        
        async with self.lock:
            self.active_students[student_id] = websocket
            self.students_info[student_id] = {
                "id": student_id,
                "name": student_name,
                "status": "attentive",
                "last_update": datetime.now().isoformat(),
                "alerts_count": 0
            }
        
        # Notify teachers about new student
        await self.broadcast_to_teachers({
            "type": "student_join",
            "data": {
                "student_id": student_id,
                "student_name": student_name,
                "timestamp": datetime.now().isoformat()
            }
        })
        
        print(f"✅ Student connected: {student_name} (ID: {student_id})")

    async def connect_teacher(self, websocket: WebSocket):
        """Connect a teacher to the system"""
        await websocket.accept()
        
        async with self.lock:
            self.active_teachers.append(websocket)
        
        # Send current students list to newly connected teacher
        students_list = [info for info in self.students_info.values()]
        
        await websocket.send_json({
            "type": "initial_state",
            "data": {
                "students": students_list
            }
        })
        
        print(f"✅ Teacher connected. Total teachers: {len(self.active_teachers)}")

    async def disconnect_student(self, student_id: str):
        """Disconnect a student from the system"""
        async with self.lock:
            if student_id in self.active_students:
                del self.active_students[student_id]
            
            if student_id in self.students_info:
                student_name = self.students_info[student_id]["name"]
                del self.students_info[student_id]
                
                await self.broadcast_to_teachers({
                    "type": "student_leave",
                    "data": {
                        "student_id": student_id,
                        "student_name": student_name,
                        "timestamp": datetime.now().isoformat()
                    }
                })
                
                print(f"❌ Student disconnected: {student_name} (ID: {student_id})")

    async def disconnect_teacher(self, websocket: WebSocket):
        """Disconnect a teacher from the system"""
        async with self.lock:
            if websocket in self.active_teachers:
                self.active_teachers.remove(websocket)
        
        print(f"❌ Teacher disconnected. Total teachers: {len(self.active_teachers)}")

    async def broadcast_to_teachers(self, message: dict):
        """Send a message to all connected teachers"""
        disconnected_teachers = []
        
        for teacher_ws in self.active_teachers:
            try:
                await teacher_ws.send_json(message)
            except Exception as e:
                print(f"Error sending to teacher: {e}")
                disconnected_teachers.append(teacher_ws)
        
        # Clean up disconnected teachers
        for teacher_ws in disconnected_teachers:
            await self.disconnect_teacher(teacher_ws)

    async def update_student_attention(self, student_id: str, attention_data: dict):
        """Update student attention status and notify teachers"""
        async with self.lock:
            if student_id in self.students_info:
                student_info = self.students_info[student_id]
                student_info["status"] = attention_data.get("status", "attentive")
                student_info["last_update"] = datetime.now().isoformat()
                
                if student_info["status"] != "attentive":
                    student_info["alerts_count"] += 1
        
        # Broadcast update to teachers
        await self.broadcast_to_teachers({
            "type": "attention_update",
            "data": {
                "student_id": student_id,
                "student_name": self.students_info[student_id]["name"],
                "status": attention_data.get("status"),
                "confidence": attention_data.get("confidence", 0.0),
                "gaze_direction": attention_data.get("gaze_direction"),
                "head_pose": attention_data.get("head_pose"),
                "timestamp": datetime.now().isoformat()
            }
        })

    async def send_alert(self, student_id: str, alert_data: dict):
        """Send an alert about a student to all teachers"""
        if student_id not in self.students_info:
            return
        
        await self.broadcast_to_teachers({
            "type": "alert",
            "data": {
                "student_id": student_id,
                "student_name": self.students_info[student_id]["name"],
                "alert_type": alert_data.get("alert_type"),
                "message": alert_data.get("message"),
                "severity": alert_data.get("severity", "medium"),
                "timestamp": datetime.now().isoformat()
            }
        })

    def get_active_students_count(self) -> int:
        return len(self.active_students)

    def get_active_teachers_count(self) -> int:
        return len(self.active_teachers)

# Global instance
manager = ConnectionManager()