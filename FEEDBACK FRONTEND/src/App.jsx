import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import StudentView from './components/StudentView';
import TeacherDashboard from './components/TeacherDashboard';

function HomePage() {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#f9fafb',
            padding: '20px',
        }}>
            <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
                {/* Logo/Title */}
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{
                        fontSize: '48px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '16px',
                    }}>
                        Attention Monitoring System
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#6b7280',
                        marginBottom: '8px',
                    }}>
                        Real-Time AI-Powered Student Attention Tracking
                    </p>
                    <p style={{
                        fontSize: '14px',
                        color: '#9ca3af',
                    }}>
                        Powered by MediaPipe & FastAPI
                    </p>
                </div>

                {/* Feature Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '20px',
                    marginBottom: '40px',
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                        border: '2px solid #e5e7eb',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>👁️</div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Gaze Tracking
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                            Detects when students look away from the screen
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                        border: '2px solid #e5e7eb',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>😴</div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Drowsiness Detection
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                            Identifies signs of sleepiness and fatigue
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                        border: '2px solid #e5e7eb',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚡</div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Real-Time Alerts
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                            Instant notifications to teachers via WebSocket
                        </p>
                    </div>
                </div>

                {/* Role Selection */}
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                }}>
                    <h2 style={{
                        fontSize: '24px',
                        fontWeight: '600',
                        marginBottom: '24px',
                        color: '#111827',
                    }}>
                        Choose Your Role
                    </h2>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '20px',
                    }}>
                        <button
                            onClick={() => navigate('/student')}
                            style={{
                                padding: '32px 24px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#2563eb';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#3b82f6';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.2)';
                            }}
                        >
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎓</div>
                            Join as Student
                        </button>

                        <button
                            onClick={() => navigate('/teacher')}
                            style={{
                                padding: '32px 24px',
                                backgroundColor: '#8b5cf6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#7c3aed';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 12px rgba(139, 92, 246, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#8b5cf6';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px rgba(139, 92, 246, 0.2)';
                            }}
                        >
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👨‍🏫</div>
                            Enter as Teacher
                        </button>
                    </div>

                    <div style={{
                        marginTop: '24px',
                        padding: '16px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1e40af',
                        lineHeight: '1.6',
                    }}>
                        <strong>Note:</strong> This system requires camera access. Please allow camera
                        permissions when prompted. Your video is processed locally and not stored.
                    </div>
                </div>

                {/* How It Works */}
                <div style={{
                    marginTop: '40px',
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    textAlign: 'left',
                }}>
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#111827',
                    }}>
                        How It Works
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '16px',
                    }}>
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                }}>
                                    1
                                </div>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                    Teacher Creates Room
                                </h4>
                            </div>
                            <p style={{ fontSize: '13px', color: '#6b7280', marginLeft: '44px', lineHeight: '1.5' }}>
                                Teacher opens dashboard and receives a unique 6-digit room code
                            </p>
                        </div>

                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                }}>
                                    2
                                </div>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                    Students Join
                                </h4>
                            </div>
                            <p style={{ fontSize: '13px', color: '#6b7280', marginLeft: '44px', lineHeight: '1.5' }}>
                                Students enter their name and the room code to join the class
                            </p>
                        </div>

                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                }}>
                                    3
                                </div>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                    Real-Time Monitoring
                                </h4>
                            </div>
                            <p style={{ fontSize: '13px', color: '#6b7280', marginLeft: '44px', lineHeight: '1.5' }}>
                                AI analyzes attention and sends instant alerts to the teacher
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tech Stack */}
                <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                }}>
                    <h3 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        color: '#6b7280',
                    }}>
                        Built With
                    </h3>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        justifyContent: 'center',
                    }}>
                        {['React', 'Vite', 'MediaPipe', 'FastAPI', 'WebSockets', 'Python'].map(tech => (
                            <span
                                key={tech}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: '#4b5563',
                                }}
                            >
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/student" element={<StudentView />} />
                <Route path="/teacher" element={<TeacherDashboard />} />
            </Routes>
        </Router>
    );
}

export default App;