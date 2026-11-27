// ══════════════════════════════════════════════════════
//  MAIN GATE TRACKER  –  auth.js  (Login page)
// ══════════════════════════════════════════════════════
const { useState, useEffect } = React;

function LoginApp() {
  const [username,    setUsername]    = useState("");
  const [password,    setPassword]    = useState("");
  const [role,        setRole]        = useState("Admin");
  const [error,       setError]       = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading,     setLoading]     = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) window.location.href = "dashboard.html";
  }, []);

  // ── Validation ────────────────────────────────────
  const validate = () => {
    const errors = {};
    const u = username.trim();
    if (!u)              errors.username = "Username is required.";
    else if (u.length < 3)   errors.username = "Must be at least 3 characters.";
    else if (/\s/.test(u))   errors.username = "Username cannot contain spaces.";

    if (!password)             errors.password = "Password is required.";
    else if (password.length < 6) errors.password = "Must be at least 6 characters.";
    return errors;
  };

  // ── Submit ────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { username: username.trim().toLowerCase(), password, role },
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      setStoredUser(data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearFieldError = (field) =>
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));

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

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label>Select Role</label>
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); setError(""); }}
                disabled={loading}
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
                className={fieldErrors.username ? "input-error" : ""}
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearFieldError("username"); }}
                disabled={loading}
                autoComplete="username"
                required
              />
              {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                className={fieldErrors.password ? "input-error" : ""}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                disabled={loading}
                autoComplete="current-password"
                required
              />
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="demo-hint">
            <strong>Demo Credentials</strong><br />
            Admin &nbsp;→ <code>admin</code> / <code>admin123</code><br />
            Guard &nbsp;→ <code>guard</code> / <code>guard123</code><br />
            Student → <code>student</code> / <code>student123</code>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<LoginApp />);

