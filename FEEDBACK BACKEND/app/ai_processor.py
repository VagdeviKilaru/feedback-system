import time
from typing import Dict, Tuple, Optional

class AttentionAnalyzer:
    def __init__(self):
        # Track current state for each student
        self.student_states: Dict[str, dict] = {}
        
    def reset_student_tracking(self, student_id: str):
        """Reset when student disconnects"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"🧹 Reset: {student_id}")
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        """Analyze attention from detection data"""
        
        # Initialize state
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'last_status': 'attentive',
                'alert_sent': False,
                'last_change_time': time.time()
            }
        
        state = self.student_states[student_id]
        
        # Get status from frontend detection
        status = landmark_data.get('status', 'attentive')
        ear = landmark_data.get('ear', 1.0)
        nose_x = landmark_data.get('nose_x', 0.5)
        nose_y = landmark_data.get('nose_y', 0.5)
        
        # Update current status
        old_status = state['current_status']
        state['current_status'] = status
        
        if status != old_status:
            state['last_change_time'] = time.time()
            print(f"📊 {student_id}: {old_status} → {status}")
        
        return status, 1.0, {
            'ear': ear,
            'nose_x': nose_x,
            'nose_y': nose_y
        }
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        """
        Generate alert when status changes from attentive to non-attentive
        Alert stays active until student becomes attentive
        """
        
        if student_id not in self.student_states:
            return None
        
        state = self.student_states[student_id]
        last_status = state['last_status']
        
        # CASE 1: Student becomes attentive → CLEAR ALERT
        if status == 'attentive':
            if state['alert_sent']:
                print(f"✅ CLEAR ALERT: {student_name} is attentive")
                state['alert_sent'] = False
                state['last_status'] = 'attentive'
                return {
                    'alert_type': 'clear_alert',
                    'student_id': student_id,
                    'message': f"{student_name} is now attentive"
                }
            state['last_status'] = 'attentive'
            return None
        
        # CASE 2: Status changed from attentive to non-attentive → SEND ALERT
        if last_status == 'attentive' and status != 'attentive' and not state['alert_sent']:
            print(f"🚨 NEW ALERT: {student_name} - {status}")
            state['alert_sent'] = True
            state['last_status'] = status
            
            # Generate message
            if status == 'looking_away':
                message = f"{student_name} is looking away from screen"
                severity = 'medium'
            elif status == 'drowsy':
                message = f"{student_name} appears drowsy (eyes closed)"
                severity = 'high'
            elif status == 'no_face':
                message = f"{student_name} - Camera not detecting face"
                severity = 'medium'
            else:
                message = f"{student_name} needs attention"
                severity = 'medium'
            
            return {
                'alert_type': status,
                'student_id': student_id,
                'message': message,
                'severity': severity,
                'timestamp': time.time()
            }
        
        # CASE 3: Still non-attentive → Keep existing alert (don't send new one)
        state['last_status'] = status
        return None

# Global instance
analyzer = AttentionAnalyzer()