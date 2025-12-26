from typing import Dict, Tuple, Optional
from datetime import datetime

class AttentionAnalyzer:
    def __init__(self):
        self.DROWSY_THRESHOLD = 0.25
        self.LOOKING_AWAY_THRESHOLD_X = 0.18
        self.LOOKING_AWAY_THRESHOLD_Y = 0.15
        self.HEAD_POSE_THRESHOLD_PITCH = 20
        self.HEAD_POSE_THRESHOLD_YAW = 20
        self.CONSECUTIVE_FRAMES = 1
        self.NO_MOVEMENT_SECONDS = 60
        
        self.student_states: Dict[str, dict] = {}
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        gaze = landmark_data.get('gaze_direction', {})
        head_pose = landmark_data.get('head_pose', {})
        ear = landmark_data.get('eye_aspect_ratio', 1.0)
        
        gaze_x = abs(gaze.get('x', 0))
        gaze_y = abs(gaze.get('y', 0))
        pitch = abs(head_pose.get('pitch', 0))
        yaw = abs(head_pose.get('yaw', 0))
        
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'status_count': 0,
                'last_status_change': datetime.now(),
                'last_position': {'pitch': pitch, 'yaw': yaw, 'ear': ear},
                'last_movement': datetime.now(),
                'last_alert_time': None,
                'last_alert_type': None
            }
        
        state = self.student_states[student_id]
        
        # Check movement
        last_pos = state['last_position']
        movement_detected = (
            abs(pitch - last_pos['pitch']) > 3 or
            abs(yaw - last_pos['yaw']) > 3 or
            abs(ear - last_pos['ear']) > 0.03
        )
        
        if movement_detected:
            state['last_movement'] = datetime.now()
            state['last_position'] = {'pitch': pitch, 'yaw': yaw, 'ear': ear}
        
        # Detect status
        status = 'attentive'
        confidence = 1.0
        
        if ear < self.DROWSY_THRESHOLD:
            status = 'drowsy'
            confidence = 1.0 - (ear / self.DROWSY_THRESHOLD)
        elif gaze_x > self.LOOKING_AWAY_THRESHOLD_X or gaze_y > self.LOOKING_AWAY_THRESHOLD_Y:
            status = 'looking_away'
            confidence = max(gaze_x, gaze_y) / 0.5
        elif pitch > self.HEAD_POSE_THRESHOLD_PITCH or yaw > self.HEAD_POSE_THRESHOLD_YAW:
            status = 'distracted'
            confidence = max(pitch, yaw) / 45
        
        state['current_status'] = status
        state['status_count'] = state.get('status_count', 0) + 1
        
        analysis = {
            'gaze_direction': gaze,
            'head_pose': head_pose,
            'eye_aspect_ratio': ear,
            'frames_in_state': state['status_count'],
            'no_movement_seconds': (datetime.now() - state['last_movement']).total_seconds()
        }
        
        return status, min(confidence, 1.0), analysis
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        """Generate alert ONLY if NOT attentive"""
        
        state = self.student_states.get(student_id)
        if not state:
            return None
        
        # NO ALERT if student is attentive
        if status == 'attentive':
            # Clear alert tracking when back to normal
            state['last_alert_type'] = None
            return None
        
        # Check no movement
        no_movement_time = (datetime.now() - state['last_movement']).total_seconds()
        if no_movement_time >= self.NO_MOVEMENT_SECONDS:
            if state['last_alert_type'] != 'no_movement' or \
               (state['last_alert_time'] and (datetime.now() - state['last_alert_time']).total_seconds() >= 60):
                state['last_alert_time'] = datetime.now()
                state['last_alert_type'] = 'no_movement'
                
                return {
                    'alert_type': 'no_movement',
                    'message': f"{student_name} has not moved for {int(no_movement_time/60)} minute(s)",
                    'severity': 'high',
                    'student_id': student_id,
                    'student_name': student_name,
                    'timestamp': datetime.now().isoformat()
                }
        
        # Status alerts
        should_send = False
        
        if state['last_alert_type'] != status:
            should_send = True
        elif state['last_alert_time']:
            time_since_last = (datetime.now() - state['last_alert_time']).total_seconds()
            if time_since_last >= 5:
                should_send = True
        else:
            should_send = True
        
        if should_send:
            state['last_alert_time'] = datetime.now()
            state['last_alert_type'] = status
            
            severity = 'high' if status == 'drowsy' else 'medium'
            
            messages = {
                'drowsy': f"{student_name} appears drowsy",
                'looking_away': f"{student_name} is looking away",
                'distracted': f"{student_name} seems distracted"
            }
            
            return {
                'alert_type': status,
                'message': messages.get(status, f"{student_name} needs attention"),
                'severity': severity,
                'student_id': student_id,
                'student_name': student_name,
                'timestamp': datetime.now().isoformat()
            }
        
        return None
    
    def reset_student_tracking(self, student_id: str):
        if student_id in self.student_states:
            del self.student_states[student_id]

analyzer = AttentionAnalyzer()