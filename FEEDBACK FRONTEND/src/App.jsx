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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
        }}>
            <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
                {/* Logo/Title */}
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{
                        fontSize: '52px',
                        fontWeight: 'bold',
                        color: 'white',
                        marginBottom: '16px',
                        lineHeight: '1.2',
                        textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    }}>
                        Live Feedback System
                    </h1>
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
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
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
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
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
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        border: '2px solid #e5e7eb',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚡</div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Real-Time Feedback
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                            Instant alerts and feedback to teachers
                        </p>
                    </div>
                </div>

                {/* Role Selection */}
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
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
                                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#2563eb';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#3b82f6';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
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
                                boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#7c3aed';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 12px rgba(139, 92, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#8b5cf6';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px rgba(139, 92, 246, 0.3)';
                            }}
                        >
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👨‍🏫</div>
                            Enter as Teacher
                        </button>
                    </div>

                    <div style={{
                        marginTop: '24px',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#92400e',
                        lineHeight: '1.6',
                    }}>
                        <strong>📹 Note:</strong> Camera access required. Your video is processed locally and not stored.
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