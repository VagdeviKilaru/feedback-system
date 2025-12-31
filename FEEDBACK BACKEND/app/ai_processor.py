import time
from typing import Dict, Tuple, Optional

class AttentionAnalyzer:
    def __init__(self):
        # Thresholds for detection
        self.DROWSY_EYE_THRESHOLD = 0.20
        self.DROWSY_TIME_THRESHOLD = 2.5  # seconds
        self.HEAD_TURN_THRESHOLD_X = 0.30  # 30% deviation from center
        self.HEAD_TURN_THRESHOLD_Y = 0.30  # 30% deviation from center
        
        # Track current state for each student
        self.student_states: Dict[str, dict] = {}
        
        print("✅ AttentionAnalyzer initialized")
        
    def reset_student_tracking(self, student_id: str):
        """Reset tracking when student disconnects"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"🧹 Reset tracking for {student_id}")
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        """Analyze student attention based on detection data"""
        
        # Initialize state if new student
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'last_status': 'attentive',
                'alert_sent': False,
                'last_update': time.time()
            }
            print(f"✨ Initialized tracking for student {student_id[:8]}...")
        
        state = self.student_states[student_id]
        current_time = time.time()
        
        # Get detection results from frontend
        status = landmark_data.get('status', 'attentive')
        ear = landmark_data.get('ear', 1.0)
        nose_x = landmark_data.get('nose_x', 0.5)
        nose_y = landmark_data.get('nose_y', 0.5)
        
        # Update current status
        state['current_status'] = status
        state['last_update'] = current_time
        
        print(f"📊 Student {student_id[:8]}... - Status: {status}, EAR: {ear:.3f}")
        
        return status, 1.0, {
            'ear': ear,
            'nose_x': nose_x,
            'nose_y': nose_y,
            'status': status
        }
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        """Generate alert when status changes from attentive to non-attentive"""
        
        if student_id not in self.student_states:
            print(f"⚠️ Student {student_id} not in states")
            return None
        
        state = self.student_states[student_id]
        last_status = state['last_status']
        alert_sent = state['alert_sent']
        
        print(f"🔍 ALERT CHECK: {student_name}")
        print(f"   Current: {status}")
        print(f"   Last: {last_status}")
        print(f"   Alert Sent: {alert_sent}")
        
        # CASE 1: Student becomes attentive → CLEAR ALERT
        if status == 'attentive':
            if alert_sent:
                print(f"✅ CLEARING ALERT for {student_name}")
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
        if last_status == 'attentive' and status != 'attentive' and not alert_sent:
            print(f"🚨 GENERATING NEW ALERT: {student_name} - {status}")
            state['alert_sent'] = True
            state['last_status'] = status
            
            # Generate message
            if status == 'looking_away':
                message = f"⚠️ {student_name} is looking away from screen"
                severity = 'medium'
            elif status == 'drowsy':
                message = f"😴 {student_name} appears drowsy (eyes closed)"
                severity = 'high'
            else:
                message = f"⚠️ {student_name} needs attention"
                severity = 'medium'
            
            alert = {
                'alert_type': status,
                'student_id': student_id,
                'message': message,
                'severity': severity,
                'timestamp': time.time()
            }
            
            print(f"✅ ALERT CREATED: {message}")
            return alert
        
        # CASE 3: Still non-attentive → NO NEW ALERT
        state['last_status'] = status
        return None

# Global analyzer instance
analyzer = AttentionAnalyzer()