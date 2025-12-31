import time
from typing import Dict, Tuple, Optional

class AttentionAnalyzer:
    def __init__(self):
        # Detection thresholds
        self.DROWSY_EYE_THRESHOLD = 0.20
        self.DROWSY_TIME_THRESHOLD = 2.0
        
        # Track state for each student
        self.student_states: Dict[str, dict] = {}
        
        print("=" * 60)
        print("✅ AttentionAnalyzer initialized")
        print("📋 THREE RULES:")
        print("   1. Looking straight → ATTENTIVE")
        print("   2. Head turned → LOOKING AWAY")
        print("   3. Eyes closed > 2s → DROWSY")
        print("   4. No face detected → NO FACE")
        print("=" * 60)
        
    def reset_student_tracking(self, student_id: str):
        """Reset tracking when student disconnects"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"🧹 Reset tracking for {student_id[:8]}...")
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        """
        Analyze student attention based on THREE RULES
        """
        
        # Initialize state if new student
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'no_face',
                'last_status': 'no_face',
                'alert_sent': False,
                'last_update': time.time()
            }
            print(f"✨ Started tracking: {student_id[:8]}...")
        
        state = self.student_states[student_id]
        
        # Get detection results from frontend
        status = landmark_data.get('status', 'no_face')
        ear = landmark_data.get('ear', 1.0)
        nose_x = landmark_data.get('nose_x', 0.5)
        nose_y = landmark_data.get('nose_y', 0.5)
        
        # Update state
        state['current_status'] = status
        state['last_update'] = time.time()
        
        print(f"📊 {student_id[:8]}... → {status.upper()} (EAR: {ear:.3f})")
        
        return status, 1.0, {
            'ear': ear,
            'nose_x': nose_x,
            'nose_y': nose_y,
            'status': status
        }
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        """
        Generate alert based on THREE RULES
        Alert when: attentive → non-attentive
        Clear when: non-attentive → attentive
        """
        
        if student_id not in self.student_states:
            return None
        
        state = self.student_states[student_id]
        last_status = state['last_status']
        alert_sent = state['alert_sent']
        
        print(f"🔍 ALERT CHECK: {student_name}")
        print(f"   Current: {status}")
        print(f"   Last: {last_status}")
        print(f"   Alert Active: {alert_sent}")
        
        # CASE 1: Student becomes attentive or no_face → CLEAR ALERT
        if status in ['attentive', 'no_face']:
            if alert_sent and last_status not in ['attentive', 'no_face']:
                print(f"✅ CLEARING ALERT: {student_name}")
                state['alert_sent'] = False
                state['last_status'] = status
                return {
                    'alert_type': 'clear_alert',
                    'student_id': student_id
                }
            state['last_status'] = status
            return None
        
        # CASE 2: Student becomes non-attentive → SEND ALERT
        if last_status in ['attentive', 'no_face'] and status not in ['attentive', 'no_face'] and not alert_sent:
            print(f"🚨 NEW ALERT: {student_name} - {status}")
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
            
            return {
                'alert_type': status,
                'student_id': student_id,
                'message': message,
                'severity': severity,
                'timestamp': time.time()
            }
        
        # CASE 3: Status still non-attentive → NO NEW ALERT
        state['last_status'] = status
        return None

# Global instance
analyzer = AttentionAnalyzer()