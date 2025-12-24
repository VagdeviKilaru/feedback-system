import { useState, useEffect, useRef, useCallback } from 'react';
import VideoCapture from './VideoCapture';
import { WebSocketManager } from '../utils/websocket';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const STATUS_COLORS = {
    attentive: '#22c55e',
    looking_away: '#f59e0b',
    drowsy: '#ef4444',
    distracted: '#f97316',
    offline: '#6b7280',
};

const STATUS_LABELS = {
    attentive: 'Attentive',
    looking_away: 'Looking Away',
    drowsy: 'Drowsy',
    distracted: 'Distracted',
    offline: 'Offline',
};

const ALERT_SEVERITY_COLORS = {
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#ef4444',
};

export default function TeacherDashboard() {
    const [students, setStudents] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [showCamera, setShowCamera] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        attentive: 0,
        needsAttention: 0,
    });

    const wsRef = useRef(null);
    const MAX_ALERTS = 50;

    const handleWebSocketMessage = useCallback((message) => {
        console.log('Teacher received:', message);

        switch (message.type) {
            case 'initial_state':
                setStudents(message.data.students || []);
                break;

            case 'student_join':
                setStudents(prev => {
                    const exists = prev.some(s => s.id === message.data.student_id);
                    if (exists) return prev;

                    return [...prev, {
                        id: message.data.student_id,
                        name: message.data.student_name,
                        status: 'attentive',
                        last_update: message.data.timestamp,
                        alerts_count: 0,
                    }];
                });
                break;

            case 'student_leave':
                setStudents(prev => prev.filter(s => s.id !== message.data.student_id));
                setAlerts(prev => prev.filter(a => a.student_id !== message.data.student_id));
                break;

            case 'attention_update':
                setStudents(prev => prev.map(student => {
                    if (student.id === message.data.student_id) {
                        return {
                            ...student,
                            status: message.data.status,
                            last_update: message.data.timestamp,
                        };
                    }
                    return student;
                }));
                break;

            case 'alert':
                setAlerts(prev => {
                    const newAlerts = [{
                        student_id: message.data.student_id,
                        student_name: message.data.student_name,
                        alert_type: message.data.alert_type,
                        message: message.data.message,
                        severity: message.data.severity,
                        timestamp: message.data.timestamp,
                    }, ...prev];

                    return newAlerts.slice(0, MAX_ALERTS);
                });

                setStudents(prev => prev.map(student => {
                    if (student.id === message.data.student_id) {
                        return {
                            ...student,
                            alerts_count: student.alerts_count + 1,
                        };
                    }
                    return student;
                }));
                break;

            default:
                break;
        }
    }, []);

    useEffect(() => {
        console.log('Connecting to WebSocket:', WS_URL);
        const wsUrl = `${WS_URL}/ws/teacher`;
        wsRef.current = new WebSocketManager(wsUrl, handleWebSocketMessage);

        wsRef.current.connect()
            .then(() => {
                console.log('✅ Teacher WebSocket connected');
                setIsConnected(true);
            })
            .catch((err) => {
                console.error('❌ Teacher WebSocket connection error:', err);
                setIsConnected(false);
            });

        return () => {
            if (wsRef.current) {
                wsRef.current.disconnect();
            }
        };
    }, [handleWebSocketMessage]);

    useEffect(() => {
        const total = students.length;
        const attentive = students.filter(s => s.status === 'attentive').length;
        const needsAttention = total - attentive;

        setStats({ total, attentive, needsAttention });
    }, [students]);

    const clearAlerts = () => {
        setAlerts([]);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);

        if (diffSecs < 60) return `${diffSecs}s ago`;
        if (diffMins < 60) return `${diffMins}m ago`;
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusIcon = (status) => {
        const icons = {
            attentive: '✓',
            looking_away: '👀',
            drowsy: '😴',
            distracted: '⚠',
            offline: '○',
        };
        return icons[status] || '○';
    };

    const getSeverityIcon = (severity) => {
        const icons = {
            low: 'ℹ️',
            medium: '⚠️',
            high: '🚨',
        };
        return icons[severity] || 'ℹ️';
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f9fafb',
            padding: '20px',
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: 'white',
                padding: '20px 24px',
                marginBottom: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: '#111827',
                            margin: 0,
                            marginBottom: '4px',
                        }}>
                            Teacher Dashboard
                        </h1>
                        <p style={{
                            margin: 0,
                            color: '#6b7280',
                            fontSize: '14px',
                        }}>
                            Real-Time Attention Monitoring System
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: '500',
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isConnected ? '#22c55e' : '#ef4444',
                            }} />
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </div>

                        <button
                            onClick={() => setShowCamera(!showCamera)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#f3f4f6',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                            }}
                        >
                            {showCamera ? 'Hide' : 'Show'} Camera
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                }}>
                    <div style={{
                        padding: '16px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '10px',
                        border: '2px solid #3b82f6',
                    }}>
                        <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '4px' }}>
                            Total Students
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a' }}>
                            {stats.total}
                        </div>
                    </div>

                    <div style={{
                        padding: '16px',
                        backgroundColor: '#dcfce7',
                        borderRadius: '10px',
                        border: '2px solid #22c55e',
                    }}>
                        <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>
                            Attentive
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#14532d' }}>
                            {stats.attentive}
                        </div>
                    </div>

                    <div style={{
                        padding: '16px',
                        backgroundColor: '#fee2e2',
                        borderRadius: '10px',
                        border: '2px solid #ef4444',
                    }}>
                        <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
                            Needs Attention
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#7f1d1d' }}>
                            {stats.needsAttention}
                        </div>
                    </div>

                    <div style={{
                        padding: '16px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '10px',
                        border: '2px solid #f59e0b',
                    }}>
                        <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                            Active Alerts
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#78350f' }}>
                            {alerts.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: showCamera ? '350px 1fr 1fr' : '1fr 1fr',
                gap: '20px',
                alignItems: 'start',
            }}>
                {/* Teacher Camera */}
                {showCamera && (
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            marginBottom: '12px',
                            color: '#111827',
                        }}>
                            Your Camera
                        </h3>
                        <VideoCapture
                            isActive={showCamera}
                            showMirror={true}
                        />
                    </div>
                )}

                {/* Participant List */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    height: '600px',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '16px',
                    }}>
                        Students ({students.length})
                    </h3>

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                    }}>
                        {students.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#9ca3af',
                                fontSize: '14px',
                            }}>
                                No students connected yet
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {students.map((student) => (
                                    <div
                                        key={student.id}
                                        style={{
                                            padding: '16px',
                                            border: `2px solid ${STATUS_COLORS[student.status]}`,
                                            borderRadius: '10px',
                                            backgroundColor: '#fafafa',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: '8px',
                                        }}>
                                            <div>
                                                <div style={{
                                                    fontWeight: '600',
                                                    fontSize: '16px',
                                                    color: '#111827',
                                                    marginBottom: '4px',
                                                }}>
                                                    {student.name}
                                                </div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: '#6b7280',
                                                }}>
                                                    ID: {student.id.substring(0, 8)}...
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                backgroundColor: STATUS_COLORS[student.status],
                                                color: 'white',
                                                borderRadius: '16px',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                            }}>
                                                <span>{getStatusIcon(student.status)}</span>
                                                <span>{STATUS_LABELS[student.status]}</span>
                                            </div>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: '12px',
                                            color: '#6b7280',
                                        }}>
                                            <span>Last Update: {formatTime(student.last_update)}</span>
                                            {student.alerts_count > 0 && (
                                                <span style={{
                                                    backgroundColor: '#fee2e2',
                                                    color: '#dc2626',
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    fontWeight: '600',
                                                }}>
                                                    {student.alerts_count} Alert{student.alerts_count !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Alert Panel */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    height: '600px',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                    }}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#111827',
                            margin: 0,
                        }}>
                            Real-Time Alerts
                        </h3>
                        {alerts.length > 0 && (
                            <span style={{
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                            }}>
                                {alerts.length} Active
                            </span>
                        )}
                    </div>

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                    }}>
                        {alerts.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#9ca3af',
                                fontSize: '14px',
                            }}>
                                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
                                <div>All students are attentive</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {alerts.map((alert, index) => (
                                    <div
                                        key={`${alert.student_id}-${alert.timestamp}-${index}`}
                                        style={{
                                            padding: '16px',
                                            border: `2px solid ${ALERT_SEVERITY_COLORS[alert.severity]}`,
                                            borderLeft: `6px solid ${ALERT_SEVERITY_COLORS[alert.severity]}`,
                                            borderRadius: '8px',
                                            backgroundColor: '#fafafa',
                                            animation: 'slideIn 0.3s ease-out',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: '8px',
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}>
                                                <span style={{ fontSize: '20px' }}>
                                                    {getSeverityIcon(alert.severity)}
                                                </span>
                                                <div>
                                                    <div style={{
                                                        fontWeight: '600',
                                                        fontSize: '15px',
                                                        color: '#111827',
                                                    }}>
                                                        {alert.student_name}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        color: '#6b7280',
                                                        marginTop: '2px',
                                                    }}>
                                                        {alert.alert_type.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                fontSize: '11px',
                                                color: '#9ca3af',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {formatTime(alert.timestamp)}
                                            </div>
                                        </div>

                                        <div style={{
                                            fontSize: '14px',
                                            color: '#4b5563',
                                            lineHeight: '1.5',
                                        }}>
                                            {alert.message}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {alerts.length > 0 && (
                        <button
                            onClick={clearAlerts}
                            style={{
                                marginTop: '12px',
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                            }}
                        >
                            Clear All Alerts
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}