import time


class AttentionAnalyzer:
    def __init__(self):
        self.last_alert_time = {}

    def analyze_attention(self, student_id, features):
        gaze_x = abs(features.get("gaze_direction", {}).get("x", 0))
        gaze_y = abs(features.get("gaze_direction", {}).get("y", 0))
        ear = features.get("eye_aspect_ratio", 1.0)

        # 🟢 DEFAULT
        status = "attentive"
        confidence = 0.95

        # 🔴 DROWSY
        if ear < 0.2:
            status = "drowsy"
            confidence = 0.9

        # 🟡 LOOKING AWAY
        elif gaze_x > 0.35 or gaze_y > 0.3:
            status = "looking_away"
            confidence = 0.85

        return status, confidence, {
            "gaze_direction": features.get("gaze_direction"),
            "eye_aspect_ratio": ear,
        }

    def generate_alert(self, student_id, name, status, analysis):
        # ❌ NO ALERT WHEN ATTENTIVE
        if status == "attentive":
            return None

        now = time.time()
        last = self.last_alert_time.get(student_id, 0)

        # ⏳ ALERT COOLDOWN (10 sec)
        if now - last < 10:
            return None

        self.last_alert_time[student_id] = now

        messages = {
            "looking_away": "Student is frequently looking away from the screen.",
            "drowsy": "Student appears drowsy or sleepy.",
        }

        severity = "medium" if status == "looking_away" else "high"

        return {
            "student_id": student_id,
            "student_name": name,
            "alert_type": status,
            "message": messages.get(status),
            "severity": severity,
            "timestamp": int(now * 1000)
        }

    def reset_student_tracking(self, student_id):
        self.last_alert_time.pop(student_id, None)
