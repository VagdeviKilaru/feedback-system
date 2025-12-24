# Real-Time Attention Monitoring System

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# Start services
docker-compose up -d

# Access application
# Frontend: http://localhost
# Backend: http://localhost:8000
```

### Option 2: Manual Setup

**Backend:**
```bash
cd "FEEDBACK BACKEND"
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cd app
python main.py
```

**Frontend (new terminal):**
```bash
cd "FEEDBACK FRONTEND"
npm install
npm run dev
```

## 📱 Usage

1. Open http://localhost (Docker) or http://localhost:5173 (Dev)
2. Choose "Join as Student" or "Enter as Teacher"
3. **Student:** Enter name, allow camera access
4. **Teacher:** View all students in real-time

## 🎯 Features

- ✅ Real-time face detection with MediaPipe
- ✅ Attention analysis (looking away, drowsy, distracted)
- ✅ Teacher dashboard with alerts
- ✅ Student camera with status indicators
- ✅ WebSocket real-time communication

## 🔧 Tech Stack

- **Frontend:** React, Vite, MediaPipe
- **Backend:** FastAPI, Python, WebSockets
- **DevOps:** Docker, Nginx