import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";

// ✅ IMPORT AS NAMED EXPORTS
import { StudentView } from "./components/StudentView";
import { TeacherDashboard } from "./components/TeacherDashboard";

function HomePage() {
    const navigate = useNavigate();

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                backgroundColor: "#f9fafb",
                padding: "20px",
            }}
        >
            <div style={{ maxWidth: "800px", width: "100%", textAlign: "center" }}>
                <h1
                    style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        marginBottom: "16px",
                    }}
                >
                    Attention Monitoring System
                </h1>

                <p
                    style={{
                        fontSize: "18px",
                        color: "#6b7280",
                        marginBottom: "40px",
                    }}
                >
                    Real-Time AI-Powered Student Attention Tracking
                </p>

                <div
                    style={{
                        backgroundColor: "white",
                        padding: "40px",
                        borderRadius: "16px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "24px",
                            fontWeight: "600",
                            marginBottom: "24px",
                            color: "#111827",
                        }}
                    >
                        Choose Your Role
                    </h2>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "20px",
                        }}
                    >
                        <button
                            onClick={() => navigate("/student")}
                            style={{
                                padding: "32px 24px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "12px",
                                cursor: "pointer",
                                fontSize: "18px",
                                fontWeight: "600",
                            }}
                        >
                            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎓</div>
                            Join as Student
                        </button>

                        <button
                            onClick={() => navigate("/teacher")}
                            style={{
                                padding: "32px 24px",
                                backgroundColor: "#8b5cf6",
                                color: "white",
                                border: "none",
                                borderRadius: "12px",
                                cursor: "pointer",
                                fontSize: "18px",
                                fontWeight: "600",
                            }}
                        >
                            <div style={{ fontSize: "32px", marginBottom: "8px" }}>👨‍🏫</div>
                            Enter as Teacher
                        </button>
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
