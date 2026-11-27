// ══════════════════════════════════════════════════════
//  MAIN GATE TRACKER  –  common.js
//  Shared constants, API helper, utility functions,
//  and shared React components (Header, Footer, etc.)
// ══════════════════════════════════════════════════════

// ── Auth Storage Keys ─────────────────────────────────
const TOKEN_KEY = "mgt_token";
const USER_KEY  = "mgt_user";

// ── API Helper ────────────────────────────────────────
/**
 * Thin fetch wrapper.
 * - Automatically attaches Authorization header with JWT.
 * - On 401, clears auth and redirects to login.
 * - Throws Error with the server's error message on failure.
 * - Pass rawResponse: true to get the raw Response (for file downloads).
 */
async function apiFetch(path, { method = "GET", body, rawResponse = false } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (rawResponse) return res;

  if (res.status === 401) {
    clearAuth();
    window.location.href = "index.html";
    return;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: "Network error. Check your connection." }));
    throw new Error(payload.error || `Request failed (${res.status}).`);
  }

  return res.json();
}

// ── Auth Helpers ──────────────────────────────────────
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); }
  catch { return null; }
}

function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Date / Time Utilities ─────────────────────────────
function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1)  return "just now";
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24)  return `${hrs}h ${diff % 60}m`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Shared React Components ───────────────────────────
function Header() {
  return (
    <header className="main-header">
      <div className="header-brand">
        <h2>Main Gate Tracker</h2>
        <span>ABESEC Ghaziabad</span>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="main-footer">
      <p>Developed &amp; Maintained By: Akansha Kukshal | Akash Kumar Singh</p>
      <p>Branch: CSE | Section: 11 &nbsp;·&nbsp; Full Stack Development Team</p>
      <p>© 2026 ABESEC Ghaziabad. All Rights Reserved.</p>
    </footer>
  );
}

function Spinner() {
  return <div className="spinner"></div>;
}

function Toast({ message, type = "success", onClose }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return (
    <div className={`toast toast-${type}`}>
      {message}
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}

