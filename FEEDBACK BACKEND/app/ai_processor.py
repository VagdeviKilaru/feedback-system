from typing import Dict, Tuple, Optional
from datetime import datetime

class AttentionAnalyzer:
    def __init__(self):
        # Much more sensitive thresholds
        self.DROWSY_THRESHOLD = 0.28  # Higher = more sensitive to closed eyes
        self.LOOKING_AWAY_THRESHOLD_X = 0.15  # Lower = detect smaller gaze movements
        self.LOOKING_AWAY_THRESHOLD_Y = 0.15
        self.HEAD_POSE_THRESHOLD_PITCH = 15  # Lower = detect smaller head movements
        self.HEAD_POSE_THRESHOLD_YAW = 15
        
        # Faster alert generation
        self.CONSECUTIVE_FRAMES = 1  # Alert after just 1 frame
        
        # Track student states
        self.student_states: Dict[str, dict] = {}
    
    def analyze_attention(
        self, 
        student_id: str, 
        landmark_data: dict
    ) -> Tuple[str, float, dict]:
        """
        Analyze student attention from facial landmarks
        Returns: (status, confidence, analysis_details)
        """
        
        # Extract features
        gaze = landmark_data.get('gaze_direction', {})
        head_pose = landmark_data.get('head_pose', {})
        ear = landmark_data.get('eye_aspect_ratio', 1.0)
        
        gaze_x = abs(gaze.get('x', 0))
        gaze_y = abs(gaze.get('y', 0))
        pitch = abs(head_pose.get('pitch', 0))
        yaw = abs(head_pose.get('yaw', 0))
        
        # Initialize student state if needed
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'status_count': 0,
                'last_status_change': datetime.now()
            }
        
        state = self.student_states[student_id]
        
        # Determine status (VERY SENSITIVE)
        status = 'attentive'
        confidence = 1.0
        
        # Check drowsiness (eyes closing)
        if ear < self.DROWSY_THRESHOLD:
            status = 'drowsy'
            confidence = 1.0 - (ear / self.DROWSY_THRESHOLD)
            print(f"🔴 {student_id} DROWSY detected! EAR={ear:.3f}")
        
        # Check looking away (gaze)
        elif gaze_x > self.LOOKING_AWAY_THRESHOLD_X or gaze_y > self.LOOKING_AWAY_THRESHOLD_Y:
            status = 'looking_away'
            confidence = max(gaze_x, gaze_y) / 0.5
            print(f"👀 {student_id} LOOKING AWAY detected! Gaze X={gaze_x:.3f}, Y={gaze_y:.3f}")
        
        # Check distracted (head turned)
        elif pitch > self.HEAD_POSE_THRESHOLD_PITCH or yaw > self.HEAD_POSE_THRESHOLD_YAW:
            status = 'distracted'
            confidence = max(pitch, yaw) / 45
            print(f"⚠️ {student_id} DISTRACTED detected! Pitch={pitch}°, Yaw={yaw}°")
        
        # Update state
        if status != state['current_status']:
            state['status_count'] = 1
            state['current_status'] = status
            state['last_status_change'] = datetime.now()
        else:
            state['status_count'] += 1
        
        # Analysis details
        analysis = {
            'gaze_direction': gaze,
            'head_pose': head_pose,
            'eye_aspect_ratio': ear,
            'frames_in_state': state['status_count']
        }
        
        return status, min(confidence, 1.0), analysis
    
    def generate_alert(
        self, 
        student_id: str, 
        student_name: str, 
        status: str, 
        analysis: dict
    ) -> Optional[dict]:
        """Generate alert for non-attentive behavior"""
        
        if status == 'attentive':
            return None
        
        state = self.student_states.get(student_id)
        if not state:
            return None
        
        # Generate alert immediately (no consecutive frames needed)
        if state['status_count'] >= self.CONSECUTIVE_FRAMES:
            
            # Determine severity
            severity = 'low'
            if status == 'drowsy':
                severity = 'high'
            elif status == 'looking_away':
                severity = 'medium'
            elif status == 'distracted':
                severity = 'medium'
            
            # Create message
            messages = {
                'drowsy': f"{student_name} appears drowsy (eyes closing)",
                'looking_away': f"{student_name} is looking away from screen",
                'distracted': f"{student_name} seems distracted (head turned)"
            }
            
            alert = {
                'alert_type': status,
                'message': messages.get(status, f"{student_name} needs attention"),
                'severity': severity,
                'student_id': student_id,
                'student_name': student_name,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"🚨 ALERT GENERATED: {alert}")
            return alert
        
        return None
    
    def reset_student_tracking(self, student_id: str):
        """Reset tracking for a student"""
        if student_id in self.student_states:
            del self.student_states[student_id]
            print(f"♻️ Reset tracking for {student_id}")

# Global instance
analyzer = AttentionAnalyzer()