from typing import Dict, Tuple, Optional
from datetime import datetime

class AttentionAnalyzer:
    def __init__(self):
        self.DROWSY_EYE_THRESHOLD = 0.20
        self.DROWSY_TIME_THRESHOLD = 2.0
        self.HEAD_TURN_THRESHOLD = 25
        self.NO_MOVEMENT_SECONDS = 60
        self.student_states: Dict[str, dict] = {}
    
    def analyze_attention(self, student_id: str, landmark_data: dict) -> Tuple[str, float, dict]:
        gaze = landmark_data.get('gaze_direction', {})
        head_pose = landmark_data.get('head_pose', {})
        ear = landmark_data.get('eye_aspect_ratio', 1.0)
        
        pitch = abs(head_pose.get('pitch', 0))
        yaw = abs(head_pose.get('yaw', 0))
        
        if student_id not in self.student_states:
            self.student_states[student_id] = {
                'current_status': 'attentive',
                'eyes_closed_start': None,
                'eyes_closed_duration': 0.0,
                'last_position': {'pitch': pitch, 'yaw': yaw, 'ear': ear},
                'last_movement': datetime.now(),
                'last_alert_time': None,
                'last_alert_type': None
            }
        
        state = self.student_states[student_id]
        current_time = datetime.now()
        
        last_pos = state['last_position']
        movement_detected = (
            abs(pitch - last_pos['pitch']) > 3 or
            abs(yaw - last_pos['yaw']) > 3 or
            abs(ear - last_pos['ear']) > 0.03
        )
        
        if movement_detected:
            state['last_movement'] = current_time
            state['last_position'] = {'pitch': pitch, 'yaw': yaw, 'ear': ear}
        
        status = 'attentive'
        confidence = 1.0
        
        # 1. HEAD TURNED = LOOKING AWAY
        if pitch > self.HEAD_TURN_THRESHOLD or yaw > self.HEAD_TURN_THRESHOLD:
            status = 'looking_away'
            confidence = max(pitch, yaw) / 45
            state['eyes_closed_start'] = None
            state['eyes_closed_duration'] = 0.0
        
        # 2. EYES CLOSED > 2 seconds = DROWSY
        elif ear < self.DROWSY_EYE_THRESHOLD:
            if state['eyes_closed_start'] is None:
                state['eyes_closed_start'] = current_time
                state['eyes_closed_duration'] = 0.0
                status = 'attentive'
            else:
                state['eyes_closed_duration'] = (current_time - state['eyes_closed_start']).total_seconds()
                
                if state['eyes_closed_duration'] >= self.DROWSY_TIME_THRESHOLD:
                    status = 'drowsy'
                    confidence = min(state['eyes_closed_duration'] / 5.0, 1.0)
                else:
                    status = 'attentive'
        
        # 3. NORMAL = ATTENTIVE
        else:
            status = 'attentive'
            state['eyes_closed_start'] = None
            state['eyes_closed_duration'] = 0.0
        
        state['current_status'] = status
        
        analysis = {
            'gaze_direction': gaze,
            'head_pose': head_pose,
            'eye_aspect_ratio': ear,
            'eyes_closed_duration': state['eyes_closed_duration'],
            'no_movement_seconds': (current_time - state['last_movement']).total_seconds()
        }
        
        return status, min(confidence, 1.0), analysis
    
    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: dict) -> Optional[dict]:
        state = self.student_states.get(student_id)
        if not state or status == 'attentive':
            if state:
                state['last_alert_type'] = None
            return None
        
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
        
        should_send = False
        
        if state['last_alert_type'] != status:
            should_send = True
        elif state['last_alert_time']:
            time_since_last = (datetime.now() - state['last_alert_time']).total_seconds()
            if time_since_last >= 10:
                should_send = True
        else:
            should_send = True
        
        if should_send:
            state['last_alert_time'] = datetime.now()
            state['last_alert_type'] = status
            
            severity = 'high' if status == 'drowsy' else 'medium'
            
            messages = {
                'drowsy': f"{student_name} appears drowsy (eyes closed {analysis.get('eyes_closed_duration', 0):.1f}s)",
                'looking_away': f"{student_name} is looking away (head turned)",
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