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
        
    def reset_student_tracking(self, student_id: str):
        """Reset tracking when student disconnects"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"🧹 Reset tracking for {student_id}")
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        """
        Analyze student attention based on detection data
        
        Args:
            student_id: Unique student identifier
            landmark_data: Dictionary containing status, ear, nose_x, nose_y
            
        Returns:
            Tuple of (status, confidence, analysis_dict)
        """
        
        # Initialize state if new student
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'last_status': 'attentive',
                'alert_sent': False,
                'eyes_closed_start': None,
                'last_update': time.time()
            }
            print(f"✨ Initialized tracking for {student_id}")
        
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
        
        print(f"📊 ANALYZING {student_id}:")
        print(f"   Status: {status}")
        print(f"   EAR: {ear:.3f}")
        print(f"   Nose Position: ({nose_x:.2f}, {nose_y:.2f})")
        
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
        
        Args:
            student_id: Unique student identifier
            student_name: Student's display name
            status: Current attention status
            analysis: Analysis results dictionary
            
        Returns:
            Alert dictionary or None
        """
        
        if student_id not in self.student_states:
            print(f"⚠️ Student {student_id} not in states - cannot generate alert")
            return None
        
        state = self.student_states[student_id]
        last_status = state['last_status']
        
        print(f"🔍 ALERT CHECK for {student_name}:")
        print(f"   Current Status: {status}")
        print(f"   Last Status: {last_status}")
        print(f"   Alert Already Sent: {state['alert_sent']}")
        
        # CASE 1: Student becomes attentive → CLEAR ALERT
        if status == 'attentive':
            if state['alert_sent']:
                print(f"✅ CLEARING ALERT: {student_name} became attentive")
                state['alert_sent'] = False
                state['last_status'] = 'attentive'
                return {
                    'alert_type': 'clear_alert',
                    'student_id': student_id,
                    'message': f"{student_name} is now attentive"
                }
            state['last_status'] = 'attentive'
            print(f"   No alert to clear (wasn't sent)")
            return None
        
        # CASE 2: Status changed from attentive to non-attentive → SEND NEW ALERT
        if last_status == 'attentive' and status != 'attentive' and not state['alert_sent']:
            print(f"🚨 GENERATING NEW ALERT: {student_name} - {status}")
            state['alert_sent'] = True
            state['last_status'] = status
            
            # Generate appropriate message based on status
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
        
        # CASE 3: Student still non-attentive → NO NEW ALERT (existing one persists)
        if status != 'attentive':
            state['last_status'] = status
            print(f"   Alert already active, not sending duplicate")
            return None
        
        print(f"   No action needed")
        return None

# Global analyzer instance
analyzer = AttentionAnalyzer()

print("✅ AttentionAnalyzer initialized with thresholds:")
print(f"   - Drowsy EAR: < {analyzer.DROWSY_EYE_THRESHOLD}")
print(f"   - Drowsy Duration: {analyzer.DROWSY_TIME_THRESHOLD}s")
print(f"   - Head Turn X: ±{analyzer.HEAD_TURN_THRESHOLD_X * 100}%")
print(f"   - Head Turn Y: ±{analyzer.HEAD_TURN_THRESHOLD_Y * 100}%")