import { useNavigate } from 'react-router-dom';

export default function HomePage() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
        }}>
            <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
                {/* Title */}
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{
                        fontSize: '52px',
                        fontWeight: 'bold',
                        color: 'white',
                        marginBottom: '16px',
                        textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    }}>
                        Live Feedback System
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        maxWidth: '600px',
                        margin: '0 auto',
                    }}>
                        Real-time attention monitoring and feedback for online classes
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
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>👁️</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Gaze Tracking
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                            Detects when students look away from the screen
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>😴</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Drowsiness Detection
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                            Identifies signs of sleepiness and fatigue
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚡</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                            Real-Time Alerts
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                            Instant notifications sent to teachers
                        </p>
                    </div>
                </div>

                {/* Role Selection */}
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                }}>
                    <h2 style={{
                        fontSize: '28px',
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
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#2563eb';
                                e.target.style.transform = 'translateY(-4px)';
                                e.target.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#3b82f6';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                            }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎓</div>
                            Join as Student
                        </button>

                        <button
                            onClick={() => navigate('/teacher')}
                            style={{
                                padding: '32px 24px',
                                backgroundColor: '#8b5cf6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#7c3aed';
                                e.target.style.transform = 'translateY(-4px)';
                                e.target.style.boxShadow = '0 8px 16px rgba(139, 92, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#8b5cf6';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px rgba(139, 92, 246, 0.3)';
                            }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '8px' }}>👨‍🏫</div>
                            Enter as Teacher
                        </button>
                    </div>

                    <div style={{
                        marginTop: '32px',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: '#92400e',
                        lineHeight: '1.6',
                    }}>
                        <strong>📹 Note:</strong> Camera access required. Your video is processed locally in real-time.
                    </div>
                </div>
            </div>
        </div>
    );
}