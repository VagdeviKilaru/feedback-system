import time
from typing import Dict, Tuple, Optional

class AttentionAnalyzer:
    def __init__(self):
        self.DROWSY_EYE_THRESHOLD = 0.18
        self.DROWSY_TIME_THRESHOLD = 2.0
        
        # Track state
        self.student_states: Dict[str, dict] = {}
        
    def reset_student_tracking(self, student_id: str):
        if student_id in self.student_states:
            del self.student_states[student_id]
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        current_time = time.time()
        
        # Initialize state
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'eyes_closed_start': None,
                'last_status': 'attentive',
                'alert_sent': False
            }
        
        state = self.student_states[student_id]
        
        # Get data
        status = landmark_data.get('status', 'attentive')
        ear = landmark_data.get('ear', 1.0)
        nose_x = landmark_data.get('nose_x', 0.5)
        nose_y = landmark_data.get('nose_y', 0.5)
        
        print(f"👤 {student_id}: status={status}, EAR={ear:.3f}, nose=({nose_x:.2f}, {nose_y:.2f})")
        
        # Determine final status
        final_status = 'attentive'
        
        if status == 'no_face':
            final_status = 'no_face'
            state['eyes_closed_start'] = None
        
        elif status == 'looking_away':
            final_status = 'looking_away'
            state['eyes_closed_start'] = None
        
        elif status == 'drowsy':
            if state['eyes_closed_start'] is None:
                state['eyes_closed_start'] = current_time
            
            duration = current_time - state['eyes_closed_start']
            if duration >= self.DROWSY_TIME_THRESHOLD:
                final_status = 'drowsy'
            else:
                final_status = 'attentive'
        
        else:
            state['eyes_closed_start'] = None
            final_status = 'attentive'
        
        # Update state
        state['last_status'] = final_status
        
        return final_status, 1.0, {'ear': ear, 'nose_x': nose_x, 'nose_y': nose_y}
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        if student_id not in self.student_states:
            return None
        
        state = self.student_states[student_id]
        
        # ONLY send alert when status CHANGES from attentive to something else
        if status == 'attentive':
            state['alert_sent'] = False
            return None
        
        # Don't send if already sent for this status
        if state['alert_sent']:
            return None
        
        # Send alert
        state['alert_sent'] = True
        
        message = ''
        if status == 'looking_away':
            message = f"{student_name} is looking away from screen"
        elif status == 'drowsy':
            message = f"{student_name} appears drowsy (eyes closed)"
        elif status == 'no_face':
            message = f"{student_name} - No face detected"
        
        print(f"🚨 ALERT: {message}")
        
        return {
            'alert_type': status,
            'message': message,
            'severity': 'high' if status == 'drowsy' else 'medium'
        }

analyzer = AttentionAnalyzer()