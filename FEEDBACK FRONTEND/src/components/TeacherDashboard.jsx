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
  const [showCamera, setShowCamera] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    attentive: 0,
    needsAttention: 0,
  });

  // Chat state
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const MAX_ALERTS = 50;

  const handleWebSocketMessage = useCallback((message) => {
    console.log('Teacher received:', message);

    switch (message.type) {
      case 'room_created':
        setRoomId(message.data.room_id);
        setStudents(message.data.students || []);
        console.log('✅ Room created with ID:', message.data.room_id);
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

      case 'chat_message':
        setMessages(prev => [...prev, message.data]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    console.log('Connecting to WebSocket:', WS_URL);
    const wsUrl = `${WS_URL}/ws/teacher?name=Teacher`;
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

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      alert(`Room code ${roomId} copied to clipboard!`);
    }
  };

  const sendMessage = () => {
    if (messageInput.trim() && wsRef.current?.isConnected()) {
      wsRef.current.send({
        type: 'chat_message',
        message: messageInput.trim()
      });
      setMessageInput('');
    }
  };

  const handleLeaveClass = () => {
    if (confirm('Are you sure you want to leave? This will end the class for all students.')) {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      window.location.href = '/';
    }
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
      timeZone: 'GMT',
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px 24px',
        marginBottom: '20px',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: roomId ? '16px' : '0',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0,
              marginBottom: '4px',
            }}>
              Live Feedback System
            </h1>
            <p style={{
              margin: 0,
              color: '#6b7280',
              fontSize: '14px',
            }}>
              Real-Time Student Feedback Generator & Attention Tracker
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
              {showCamera ? 'Hide' : 'Show'} My Camera
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              💬 Chat {messages.length > 0 && `(${messages.length})`}
            </button>

            <button
              onClick={handleLeaveClass}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              Leave Class
            </button>
          </div>
        </div>

        {/* Room Code Display */}
        {roomId ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            borderRadius: '12px',
            border: '3px solid #3b82f6',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(59, 130, 246, 0.1)',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div>
              <div style={{
                fontSize: '13px',
                color: '#1e40af',
                marginBottom: '8px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>
                📋 Room Code - Share with Students
              </div>
              <div style={{
                fontSize: '42px',
                fontWeight: 'bold',
                color: '#1e3a8a',
                letterSpacing: '8px',
                fontFamily: 'monospace',
              }}>
                {roomId}
              </div>
            </div>
            <button
              onClick={copyRoomCode}
              style={{
                padding: '14px 28px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2563eb';
                e.target.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
                e.target.style.transform = 'scale(1)';
              }}
            >
              📋 Copy Code
            </button>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#92400e',
            textAlign: 'center',
            fontWeight: '500',
          }}>
            ⏳ Generating room code... Please wait.
          </div>
        )}

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            borderRadius: '10px',
            border: '2px solid #3b82f6',
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '4px', fontWeight: '600' }}>
              Total Students
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a' }}>
              {stats.total}
            </div>
          </div>

          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            borderRadius: '10px',
            border: '2px solid #22c55e',
          }}>
            <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px', fontWeight: '600' }}>
              Attentive
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#14532d' }}>
              {stats.attentive}
            </div>
          </div>

          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            borderRadius: '10px',
            border: '2px solid #ef4444',
          }}>
            <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px', fontWeight: '600' }}>
              Needs Attention
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#7f1d1d' }}>
              {stats.needsAttention}
            </div>
          </div>

          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '10px',
            border: '2px solid #f59e0b',
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px', fontWeight: '600' }}>
              Active Alerts
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#78350f' }}>
              {alerts.length}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          width: '350px',
          height: 'calc(100vh - 40px)',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
              💬 Chat
            </h3>
            <button
              onClick={() => setShowChat(false)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#f9fafb',
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: '40px', fontSize: '14px' }}>
                No messages yet
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: msg.user_type === 'teacher' ? '#eff6ff' : 'white',
                    borderRadius: '8px',
                    border: `2px solid ${msg.user_type === 'teacher' ? '#3b82f6' : '#e5e7eb'}`,
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                    {msg.user_name}
                    {msg.user_type === 'teacher' && ' 👨‍🏫'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#374151' }}>
                    {msg.message}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '16px', borderTop: '2px solid #e5e7eb', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!messageInput.trim()}
              style={{
                padding: '12px 20px',
                background: messageInput.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: messageInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

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
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
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

        {/* Student Cameras Grid */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
          minHeight: '600px',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '16px',
          }}>
            Students ({students.length})
          </h3>

          {students.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '400px',
              color: '#9ca3af',
              fontSize: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>👥</div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>No students connected yet</div>
              <div>Share room code <strong style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>{roomId || '...'}</strong></div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}>
              {students.map((student) => (
                <div
                  key={student.id}
                  style={{
                    padding: '12px',
                    border: `3px solid ${STATUS_COLORS[student.status]}`,
                    borderRadius: '12px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {/* Student Video Placeholder */}
                  <div style={{
                    width: '100%',
                    height: '150px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '48px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                  }}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{
                    fontWeight: '600',
                    fontSize: '15px',
                    color: '#111827',
                    marginBottom: '6px',
                  }}>
                    {student.name}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    backgroundColor: STATUS_COLORS[student.status],
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginBottom: '6px',
                  }}>
                    <span>{getStatusIcon(student.status)}</span>
                    <span>{STATUS_LABELS[student.status]}</span>
                  </div>

                  <div style={{
                    fontSize: '11px',
                    color: '#6b7280',
                  }}>
                    Updated: {formatTime(student.last_update)}
                  </div>

                  {student.alerts_count > 0 && (
                    <div style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>
                      {student.alerts_count} Alert{student.alerts_count !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alert Panel */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
          minHeight: '600px',
          maxHeight: '600px',
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
                <div style={{ fontWeight: '600' }}>All students are attentive</div>
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