import time
from typing import Dict, Tuple, Optional
import math

class AttentionAnalyzer:
    def __init__(self):
        # UPDATED THRESHOLDS FOR BETTER DETECTION
        self.DROWSY_EYE_THRESHOLD = 0.18  # Eyes closed
        self.DROWSY_TIME_THRESHOLD = 2.5  # Must be closed 2.5 seconds
        self.HEAD_TURN_THRESHOLD_YAW = 25  # Left/right head turn
        self.HEAD_TURN_THRESHOLD_PITCH = 20  # Up/down head turn
        self.GAZE_THRESHOLD = 0.25  # Gaze direction
        
        # Tracking state
        self.student_states: Dict[str, dict] = {}
        self.last_alert_time: Dict[str, float] = {}
        self.ALERT_COOLDOWN = 10.0  # 10 seconds between same alerts
        
        # Movement tracking for no-movement detection
        self.NO_MOVEMENT_THRESHOLD = 60.0  # 60 seconds
        self.MOVEMENT_SENSITIVITY = 0.03  # Minimum movement to detect
        
    def reset_student_tracking(self, student_id: str):
        """Reset tracking for a student"""
        if student_id in self.student_states:
            del self.student_states[student_id]
        if student_id in self.last_alert_time:
            del self.last_alert_time[student_id]
    
    def calculate_ear(self, eye_points: dict) -> float:
        """Calculate Eye Aspect Ratio"""
        if not all(k in eye_points for k in ['upper', 'lower', 'left', 'right']):
            return 1.0
        
        vertical = abs(eye_points['upper'] - eye_points['lower'])
        horizontal = abs(eye_points['right'] - eye_points['left'])
        
        if horizontal == 0:
            return 1.0
        
        ear = vertical / horizontal
        return ear
    
    def calculate_head_pose(self, landmarks: dict) -> Tuple[float, float]:
        """Calculate head pose (yaw, pitch)"""
        if not all(k in landmarks for k in ['nose', 'left_eye', 'right_eye']):
            return 0.0, 0.0
        
        nose_x = landmarks['nose']
        eye_center = (landmarks['left_eye'] + landmarks['right_eye']) / 2
        
        # Yaw (horizontal rotation): -30 to +30 degrees approximately
        yaw = (nose_x - 0.5) * 60  # Convert to degrees
        
        # Pitch (vertical): Simplified calculation
        pitch = (eye_center - 0.5) * 40
        
        return yaw, pitch
    
    def analyze_attention(
        self, 
        student_id: str, 
        landmark_data: dict
    ) -> Tuple[str, float, dict]:
        """
        Analyze student attention based on landmarks
        
        Returns:
            - status: 'attentive', 'looking_away', 'drowsy', 'no_face'
            - confidence: 0.0 to 1.0
            - analysis: detailed analysis data
        """
        
        current_time = time.time()
        
        # Initialize student state if needed
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'eyes_closed_start': None,
                'last_movement_time': current_time,
                'last_position': None,
                'consecutive_no_face': 0
            }
        
        state = self.student_states[student_id]
        
        # Check if landmarks exist and are valid
        if not landmark_data or not isinstance(landmark_data, dict):
            state['consecutive_no_face'] += 1
            
            # Only return no_face after 3 consecutive frames (reduce false positives)
            if state['consecutive_no_face'] >= 3:
                return 'no_face', 0.0, {'reason': 'No face detected'}
            else:
                return 'attentive', 0.5, {'reason': 'Temporary detection loss'}
        
        # Reset no_face counter when face is detected
        state['consecutive_no_face'] = 0
        
        # Extract features
        ear = landmark_data.get('ear', 1.0)
        nose_x = landmark_data.get('nose_x', 0.5)
        nose_y = landmark_data.get('nose_y', 0.5)
        
        # Calculate head pose
        yaw = (nose_x - 0.5) * 60  # -30 to +30 degrees
        pitch = (nose_y - 0.5) * 40  # -20 to +20 degrees
        
        print(f"👤 {student_id}: EAR={ear:.3f}, Yaw={yaw:.1f}°, Pitch={pitch:.1f}°")
        
        # Detect movement
        current_position = (nose_x, nose_y, ear)
        if state['last_position']:
            movement = sum(abs(a - b) for a, b in zip(current_position, state['last_position']))
            if movement > self.MOVEMENT_SENSITIVITY:
                state['last_movement_time'] = current_time
        state['last_position'] = current_position
        
        # PRIORITY 1: HEAD TURNED (Check FIRST)
        if abs(yaw) > self.HEAD_TURN_THRESHOLD_YAW or abs(pitch) > self.HEAD_TURN_THRESHOLD_PITCH:
            state['eyes_closed_start'] = None  # Reset drowsy detection
            print(f"👀 HEAD TURNED: Yaw={yaw:.1f}°, Pitch={pitch:.1f}°")
            return 'looking_away', 0.9, {
                'reason': 'head_turned',
                'yaw': yaw,
                'pitch': pitch
            }
        
        # PRIORITY 2: GAZE AWAY
        if abs(nose_x - 0.5) > self.GAZE_THRESHOLD or abs(nose_y - 0.5) > self.GAZE_THRESHOLD:
            state['eyes_closed_start'] = None  # Reset drowsy detection
            print(f"👁️ GAZE AWAY: nose_x={nose_x:.3f}, nose_y={nose_y:.3f}")
            return 'looking_away', 0.85, {
                'reason': 'gaze_away',
                'gaze_x': nose_x,
                'gaze_y': nose_y
            }
        
        # PRIORITY 3: DROWSY (Eyes closed for extended period)
        if ear < self.DROWSY_EYE_THRESHOLD:
            if state['eyes_closed_start'] is None:
                state['eyes_closed_start'] = current_time
                print(f"😴 EYES CLOSING: EAR={ear:.3f}")
            
            eyes_closed_duration = current_time - state['eyes_closed_start']
            
            if eyes_closed_duration >= self.DROWSY_TIME_THRESHOLD:
                print(f"😴 DROWSY DETECTED: Eyes closed for {eyes_closed_duration:.1f}s")
                return 'drowsy', 0.95, {
                    'reason': 'eyes_closed',
                    'duration': eyes_closed_duration,
                    'ear': ear
                }
        else:
            # Eyes are open - reset drowsy tracking
            if state['eyes_closed_start'] is not None:
                print(f"✅ EYES OPENED: EAR={ear:.3f}")
            state['eyes_closed_start'] = None
        
        # Check for no movement (person may have left)
        time_since_movement = current_time - state['last_movement_time']
        if time_since_movement > self.NO_MOVEMENT_THRESHOLD:
            return 'looking_away', 0.7, {
                'reason': 'no_movement',
                'duration': time_since_movement
            }
        
        # DEFAULT: ATTENTIVE
        return 'attentive', 1.0, {
            'reason': 'attentive',
            'ear': ear,
            'yaw': yaw,
            'pitch': pitch
        }
    
    def generate_alert(
        self,
        student_id: str,
        student_name: str,
        status: str,
        analysis: dict
    ) -> Optional[dict]:
        """
        Generate alert if status requires attention
        
        Returns:
            Alert dict or None
        """
        
        if status == 'attentive':
            return None
        
        current_time = time.time()
        
        # Check cooldown
        alert_key = f"{student_id}_{status}"
        if alert_key in self.last_alert_time:
            if current_time - self.last_alert_time[alert_key] < self.ALERT_COOLDOWN:
                return None
        
        self.last_alert_time[alert_key] = current_time
        
        # Generate appropriate alert message
        alert_data = {
            'alert_type': status,
            'severity': 'medium',
            'message': ''
        }
        
        if status == 'looking_away':
            reason = analysis.get('reason', 'unknown')
            if reason == 'head_turned':
                yaw = analysis.get('yaw', 0)
                pitch = analysis.get('pitch', 0)
                alert_data['message'] = f"{student_name} turned head away (Yaw: {yaw:.0f}°, Pitch: {pitch:.0f}°)"
                alert_data['severity'] = 'medium'
            elif reason == 'gaze_away':
                alert_data['message'] = f"{student_name} is looking away from screen"
                alert_data['severity'] = 'medium'
            elif reason == 'no_movement':
                duration = analysis.get('duration', 0)
                alert_data['message'] = f"{student_name} - No movement for {duration:.0f}s"
                alert_data['severity'] = 'high'
            else:
                alert_data['message'] = f"{student_name} is not looking at screen"
                alert_data['severity'] = 'medium'
        
        elif status == 'drowsy':
            duration = analysis.get('duration', 0)
            alert_data['message'] = f"{student_name} appears drowsy (eyes closed {duration:.1f}s)"
            alert_data['severity'] = 'high'
        
        elif status == 'no_face':
            alert_data['message'] = f"{student_name} - Camera not detecting face"
            alert_data['severity'] = 'high'
        
        print(f"🚨 ALERT: {alert_data['message']}")
        return alert_data

# Global analyzer instance
analyzer = AttentionAnalyzer()