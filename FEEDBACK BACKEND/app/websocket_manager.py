import random
import string
import time
from typing import Dict


def generate_room_code(length: int = 6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


class ConnectionManager:
    def __init__(self):
        self.rooms_teachers: Dict[str, set] = {}
        self.rooms_students: Dict[str, Dict[str, any]] = {}
        self.rooms_students_info: Dict[str, Dict[str, dict]] = {}

    def room_exists(self, room_id: str) -> bool:
        return room_id in self.rooms_teachers

    # =======================
    # TEACHER
    # =======================
    async def connect_teacher(self, websocket, room_id=None):
        await websocket.accept()

        if not room_id:
            room_id = generate_room_code()

        if room_id not in self.rooms_teachers:
            self.rooms_teachers[room_id] = set()
            self.rooms_students[room_id] = {}
            self.rooms_students_info[room_id] = {}

        self.rooms_teachers[room_id].add(websocket)

        await websocket.send_json({
            "type": "room_created",
            "data": {
                "room_id": room_id,
                "students": list(self.rooms_students_info[room_id].values())
            }
        })

        print(f"✅ Teacher connected → Room {room_id}")
        return room_id

    async def disconnect_teacher(self, websocket):
        for room in self.rooms_teachers.values():
            room.discard(websocket)

    # =======================
    # STUDENT
    # =======================
    async def connect_student(self, websocket, room_id, student_id, name):
        await websocket.accept()

        self.rooms_students[room_id][student_id] = websocket
        self.rooms_students_info[room_id][student_id] = {
            "id": student_id,
            "name": name,
            "status": "attentive",
            "confidence": 1.0,
            "last_update": int(time.time() * 1000),
            "alerts_count": 0,
        }

        await self.broadcast(room_id, {
            "type": "student_join",
            "data": {
                "student_id": student_id,
                "student_name": name,
                "timestamp": int(time.time() * 1000)
            }
        })

        print(f"👨‍🎓 Student {name} joined room {room_id}")
        return True

    async def disconnect_student(self, room_id, student_id):
        self.rooms_students[room_id].pop(student_id, None)
        self.rooms_students_info[room_id].pop(student_id, None)

        await self.broadcast(room_id, {
            "type": "student_leave",
            "data": {"student_id": student_id}
        })

    # =======================
    # UPDATES
    # =======================
    async def update_student_attention(self, room_id, student_id, update):
        info = self.rooms_students_info[room_id][student_id]
        info.update(update)
        info["last_update"] = int(time.time() * 1000)

        await self.broadcast(room_id, {
            "type": "attention_update",
            "data": {
                "student_id": student_id,
                **update,
                "timestamp": info["last_update"]
            }
        })

    async def send_alert(self, room_id, student_id, alert):
        self.rooms_students_info[room_id][student_id]["alerts_count"] += 1

        await self.broadcast(room_id, {
            "type": "alert",
            "data": alert
        })

    async def broadcast(self, room_id, message):
        for ws in self.rooms_teachers.get(room_id, []):
            await ws.send_json(message)
