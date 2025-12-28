import time
from typing import Dict, Tuple, Optional

class AttentionAnalyzer:
    def __init__(self):
        # Current attention state for each student
        self.student_states: Dict[str, dict] = {}
        
    def reset_student_tracking(self, student_id: str):
        """Reset tracking when student disconnects"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"🧹 Reset tracking for {student_id}")
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        """
        Analyze student attention based on detection data
        
        Returns:
            - status: 'attentive', 'looking_away', 'drowsy', 'no_face'
            - confidence: 0.0 to 1.0
            - analysis: detailed data
        """
        
        # Initialize state if new student
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'last_status': 'attentive',
                'alert_active': False,
                'last_alert_time': 0
            }
        
        state = self.student_states[student_id]
        
        # Get detection results from frontend
        status = landmark_data.get('status', 'attentive')
        ear = landmark_data.get('ear', 1.0)
        nose_x = landmark_data.get('nose_x', 0.5)
        nose_y = landmark_data.get('nose_y', 0.5)
        
        # Update current status
        state['current_status'] = status
        
        print(f"👤 {student_id}: status={status}, EAR={ear:.3f}, nose=({nose_x:.2f}, {nose_y:.2f})")
        
        return status, 1.0, {
            'ear': ear,
            'nose_x': nose_x,
            'nose_y': nose_y,
            'status': status
        }
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        """
        Generate alert ONLY when status changes from attentive to non-attentive
        Alert persists until student becomes attentive again
        
        Returns:
            Alert dict or None
        """
        
        if student_id not in self.student_states:
            return None
        
        state = self.student_states[student_id]
        last_status = state['last_status']
        
        # Case 1: Student becomes attentive - CLEAR ALERT
        if status == 'attentive':
            if state['alert_active']:
                print(f"✅ {student_name} became attentive - CLEARING ALERT")
                state['alert_active'] = False
                state['last_status'] = 'attentive'
                # Return special message to remove alert
                return {
                    'alert_type': 'resolved',
                    'message': f"{student_name} is now attentive",
                    'severity': 'low'
                }
            state['last_status'] = 'attentive'
            return None
        
        # Case 2: Student becomes non-attentive - CREATE ALERT (only if not already active)
        if last_status == 'attentive' and status != 'attentive':
            if not state['alert_active']:
                print(f"🚨 {student_name} became {status} - CREATING ALERT")
                state['alert_active'] = True
                state['last_status'] = status
                state['last_alert_time'] = time.time()
                
                # Generate appropriate message
                if status == 'looking_away':
                    message = f"⚠️ {student_name} is looking away from screen"
                    severity = 'medium'
                elif status == 'drowsy':
                    message = f"😴 {student_name} appears drowsy (eyes closed)"
                    severity = 'high'
                elif status == 'no_face':
                    message = f"❌ {student_name} - No face detected"
                    severity = 'medium'
                else:
                    message = f"⚠️ {student_name} - Attention needed"
                    severity = 'medium'
                
                return {
                    'alert_type': status,
                    'message': message,
                    'severity': severity
                }
        
        # Case 3: Student still non-attentive - NO NEW ALERT (already active)
        if status != 'attentive':
            state['last_status'] = status
            # Don't send new alert, existing one persists
            return None
        
        return None

# Global analyzer instance
analyzer = AttentionAnalyzer()