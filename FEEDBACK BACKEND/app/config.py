from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost"
    
    # Attention detection thresholds
    LOOKING_AWAY_THRESHOLD: float = 0.3
    DROWSY_EYE_RATIO_THRESHOLD: float = 0.2
    HEAD_ROTATION_THRESHOLD: int = 30
    CONSECUTIVE_FRAMES_THRESHOLD: int = 3
    
    class Config:
        env_file = ".env"

settings = Settings()