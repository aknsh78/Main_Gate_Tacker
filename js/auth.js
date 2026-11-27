const { useState } = React;

function LoginApp() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    const credentials = {
      Admin: { user: "admin", pass: "admin123", displayName: "Admin Officer" },
      "Gate Guard": { user: "guard", pass: "guard123", displayName: "Main Gate Security" },
      Student: { user: "student", pass: "student123", displayName: "Akash Singh (CSE-11)" }
    };

    const match = credentials[role];

    if (match && username.trim() === match.user && password === match.pass) {
      localStorage.setItem(
        STORAGE_KEYS.USER,
        JSON.stringify({
          username: match.user,
          displayName: match.displayName,
          role
        })
      );
      window.location.href = "dashboard.html";
    } else {
      setError(`Invalid credentials for ${role}. Check the demo box below.`);
    }
  };

  return (
    <div className="page-shell">
      <Header />
      <div className="login-wrapper">
        <div className="login-card">
          <div className="brand-header">
            <div className="brand-badge">MAIN GATE</div>
            <h2>Campus Visitor &amp; Entry Portal</h2>
            <p>Sign in with your assigned role</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Select Role</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setError("");
                }}
              >
                <option value="Admin">Admin</option>
                <option value="Gate Guard">Gate Guard</option>
                <option value="Student">Student</option>
              </select>
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary">
              Sign In
            </button>
          </form>

          <div className="demo-hint">
            <strong>Demo Credentials:</strong><br />
            Admin: <code>admin</code> / <code>admin123</code><br />
            Guard: <code>guard</code> / <code>guard123</code><br />
            Student: <code>student</code> / <code>student123</code>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<LoginApp />);