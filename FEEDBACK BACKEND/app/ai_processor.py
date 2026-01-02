import time
from typing import Dict, Tuple, Optional

class AttentionAnalyzer:
    def __init__(self):
        # Track state for each student
        self.student_states: Dict[str, dict] = {}
        
        print("=" * 60)
        print("✅ AttentionAnalyzer initialized")
        print("📋 SIMPLE RULES:")
        print("   - attentive → Send NO alert")
        print("   - looking_away → Send ALERT")
        print("   - drowsy → Send ALERT")
        print("   - no_face → Send ALERT")
        print("=" * 60)
        
    def reset_student_tracking(self, student_id: str):
        """Reset tracking when student disconnects"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"🧹 Reset tracking for {student_id[:8]}...")
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        """Analyze student attention"""
        
        # Initialize state if new student
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'last_status': 'attentive',
                'alert_active': False,
                'last_update': time.time()
            }
            print(f"✨ Started tracking: {student_id[:8]}...")
        
        state = self.student_states[student_id]
        
        # Get detection results from frontend
        status = landmark_data.get('status', 'attentive')
        
        # Update state
        state['current_status'] = status
        state['last_update'] = time.time()
        
        print(f"📊 {student_id[:8]}... → {status.upper()}")
        
        return status, 1.0, {'status': status}
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        """
        SIMPLE ALERT LOGIC:
        - If status is NOT attentive AND no alert active → SEND ALERT
        - If status IS attentive AND alert active → CLEAR ALERT
        """
        
        if student_id not in self.student_states:
            return None
        
        state = self.student_states[student_id]
        alert_active = state['alert_active']
        
        print(f"🔍 ALERT CHECK: {student_name}")
        print(f"   Status: {status}")
        print(f"   Alert Active: {alert_active}")
        
        # CASE 1: Student is NOT attentive and NO alert active → SEND ALERT
        if status != 'attentive' and not alert_active:
            print(f"🚨 SENDING ALERT: {student_name} - {status}")
            state['alert_active'] = True
            
            if status == 'looking_away':
                message = f"⚠️ {student_name} is looking away"
                severity = 'medium'
            elif status == 'drowsy':
                message = f"😴 {student_name} appears drowsy"
                severity = 'high'
            elif status == 'no_face':
                message = f"❌ {student_name} - no face detected"
                severity = 'medium'
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
        
        # CASE 2: Student IS attentive and alert active → CLEAR ALERT
        if status == 'attentive' and alert_active:
            print(f"✅ CLEARING ALERT: {student_name}")
            state['alert_active'] = False
            return {
                'alert_type': 'clear_alert',
                'student_id': student_id
            }
        
        # CASE 3: No change needed
        return None

# Global instance
analyzer = AttentionAnalyzer()