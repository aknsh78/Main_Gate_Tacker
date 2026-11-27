const { useState } = React;

function LoginApp() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // Simple student-level credential check
    const validAdmin = role === "Admin" && username === "admin" && password === "admin123";
    const validGuard = role === "Gate Guard" && username === "guard" && password === "guard123";

    if (validAdmin || validGuard) {
      localStorage.setItem(
        STORAGE_KEYS.USER,
        JSON.stringify({ username, role })
      );
      window.location.href = "dashboard.html";
    } else {
      setError("Invalid username or password for selected role.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="brand-header">
          <div className="brand-badge">MAIN GATE</div>
          <h2>Campus Visitor Portal</h2>
          <p>Sign in to manage entry & exit logs</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Select Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Admin">Admin</option>
              <option value="Gate Guard">Gate Guard</option>
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
          Admin: <code>admin</code> / <code>admin123</code> &nbsp;|&nbsp;
          Guard: <code>guard</code> / <code>guard123</code>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<LoginApp />);