"""
AI-based attention analyzer
Processes facial landmark data and determines attention status
"""

from typing import Dict, Any, Optional, Tuple

class AttentionStatus:
    ATTENTIVE = "attentive"
    LOOKING_AWAY = "looking_away"
    DROWSY = "drowsy"
    DISTRACTED = "distracted"

class AttentionAnalyzer:
    def __init__(self):
        # Thresholds for attention detection
        self.LOOKING_AWAY_THRESHOLD = 0.3
        self.DROWSY_EYE_RATIO_THRESHOLD = 0.2
        self.HEAD_ROTATION_THRESHOLD = 30
        self.CONSECUTIVE_FRAMES_THRESHOLD = 3
        
        # Track consecutive frames
        self.student_frame_counts: Dict[str, Dict[str, int]] = {}

    def analyze_attention(self, student_id: str, landmark_data: Dict[str, Any]) -> Tuple[str, float, Dict[str, Any]]:
        """
        Analyze student attention based on facial landmarks
        
        Returns:
            Tuple of (status, confidence, analysis_details)
        """
        if student_id not in self.student_frame_counts:
            self.student_frame_counts[student_id] = {
                "looking_away": 0,
                "drowsy": 0,
                "distracted": 0
            }
        
        analysis = {
            "gaze_direction": landmark_data.get("gaze_direction", {}),
            "head_pose": landmark_data.get("head_pose", {}),
            "eye_aspect_ratio": landmark_data.get("eye_aspect_ratio", 1.0),
            "features": []
        }
        
        status = AttentionStatus.ATTENTIVE
        confidence = 0.0
        
        # Check gaze direction (looking away)
        gaze = landmark_data.get("gaze_direction", {})
        if abs(gaze.get("x", 0)) > self.LOOKING_AWAY_THRESHOLD or abs(gaze.get("y", 0)) > self.LOOKING_AWAY_THRESHOLD:
            self.student_frame_counts[student_id]["looking_away"] += 1
            analysis["features"].append("looking_away")
            
            if self.student_frame_counts[student_id]["looking_away"] >= self.CONSECUTIVE_FRAMES_THRESHOLD:
                status = AttentionStatus.LOOKING_AWAY
                confidence = min(1.0, self.student_frame_counts[student_id]["looking_away"] / 10)
        else:
            self.student_frame_counts[student_id]["looking_away"] = max(0, self.student_frame_counts[student_id]["looking_away"] - 1)
        
        # Check eye aspect ratio (drowsiness)
        eye_ratio = landmark_data.get("eye_aspect_ratio", 1.0)
        if eye_ratio < self.DROWSY_EYE_RATIO_THRESHOLD:
            self.student_frame_counts[student_id]["drowsy"] += 1
            analysis["features"].append("drowsy")
            
            if self.student_frame_counts[student_id]["drowsy"] >= self.CONSECUTIVE_FRAMES_THRESHOLD:
                status = AttentionStatus.DROWSY
                confidence = min(1.0, self.student_frame_counts[student_id]["drowsy"] / 10)
        else:
            self.student_frame_counts[student_id]["drowsy"] = max(0, self.student_frame_counts[student_id]["drowsy"] - 1)
        
        # Check head pose (excessive rotation)
        head_pose = landmark_data.get("head_pose", {})
        pitch = abs(head_pose.get("pitch", 0))
        yaw = abs(head_pose.get("yaw", 0))
        
        if pitch > self.HEAD_ROTATION_THRESHOLD or yaw > self.HEAD_ROTATION_THRESHOLD:
            self.student_frame_counts[student_id]["distracted"] += 1
            analysis["features"].append("head_rotated")
            
            if self.student_frame_counts[student_id]["distracted"] >= self.CONSECUTIVE_FRAMES_THRESHOLD:
                status = AttentionStatus.DISTRACTED
                confidence = min(1.0, self.student_frame_counts[student_id]["distracted"] / 10)
        else:
            self.student_frame_counts[student_id]["distracted"] = max(0, self.student_frame_counts[student_id]["distracted"] - 1)
        
        # If attentive, set high confidence
        if status == AttentionStatus.ATTENTIVE:
            confidence = 0.9
        
        return status, confidence, analysis

    def generate_alert(self, student_id: str, student_name: str, status: str, analysis: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Generate alert message if attention issues detected
        """
        if status == AttentionStatus.ATTENTIVE:
            return None
        
        alert_messages = {
            AttentionStatus.LOOKING_AWAY: f"{student_name} is looking away from the screen",
            AttentionStatus.DROWSY: f"{student_name} appears drowsy or sleepy",
            AttentionStatus.DISTRACTED: f"{student_name} seems distracted"
        }
        
        severity_map = {
            AttentionStatus.LOOKING_AWAY: "medium",
            AttentionStatus.DROWSY: "high",
            AttentionStatus.DISTRACTED: "medium"
        }
        
        return {
            "student_id": student_id,
            "alert_type": status,
            "message": alert_messages.get(status, f"{student_name} needs attention"),
            "severity": severity_map.get(status, "low"),
            "details": analysis
        }

    def reset_student_tracking(self, student_id: str):
        """Reset tracking for a student"""
        if student_id in self.student_frame_counts:
            del self.student_frame_counts[student_id]

# Global instance
analyzer = AttentionAnalyzer()