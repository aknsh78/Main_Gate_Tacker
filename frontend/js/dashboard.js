// ══════════════════════════════════════════════════════
//  MAIN GATE TRACKER  –  dashboard.js
// ══════════════════════════════════════════════════════
const { useState, useEffect } = React;

const PURPOSES_VISITOR = ["Parent Visit", "Admission Inquiry", "Vendor / Delivery", "Official Meeting"];
const PURPOSES_STUDENT = ["Student Late Entry / Outpass", "Hostel Gate Pass", "Event / Lab Permission"];

function DashboardApp() {
  const [user,          setUser]          = useState(null);
  const [entries,       setEntries]       = useState([]);
  const [stats,         setStats]         = useState({ total: 0, inside: 0, checkedOut: 0, pending: 0 });
  const [overstay,      setOverstay]      = useState([]);
  const [auditLogs,     setAuditLogs]     = useState([]);
  const [managedUsers,  setManagedUsers]  = useState([]);
  const [overstayHrs,   setOverstayHrs]   = useState(4);

  const [activeTab,     setActiveTab]     = useState("dashboard");
  const [loading,       setLoading]       = useState(true);
  const [entriesLoading,setEntriesLoading]= useState(false);
  const [toast,         setToast]         = useState({ msg: "", type: "success" });

  // Entry form
  const [name,       setName]       = useState("");
  const [phone,      setPhone]      = useState("");
  const [purpose,    setPurpose]    = useState("Parent Visit");
  const [formErrors, setFormErrors] = useState({});
  const [formLoading,setFormLoading]= useState(false);

  // Search / filter
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Reject modal
  const [rejectModal,  setRejectModal]  = useState({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState("");

  // User management
  const [userForm,       setUserForm]       = useState({ username: "", password: "", displayName: "", role: "Gate Guard", rollNo: "" });
  const [userFormErrors, setUserFormErrors] = useState({});
  const [userFormLoading,setUserFormLoading]= useState(false);

  // Settings / change password
  const [pwForm,    setPwForm]    = useState({ current: "", next: "" });
  const [pwError,   setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // ── Mount: verify token, load initial data ─────────
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.href = "index.html";
      return;
    }
    apiFetch("/auth/me")
      .then(async (u) => {
        setUser(u);
        setStoredUser(u);
        if (u.role === "Student") setPurpose("Student Late Entry / Outpass");
        const promises = [loadEntries(u, "all", "")];
        if (u.role !== "Student") promises.push(loadStats(), loadOverstay());
        await Promise.all(promises);
        setLoading(false);
      })
      .catch(() => { clearAuth(); window.location.href = "index.html"; });
  }, []);

  // ── Data Loaders ───────────────────────────────────
  const loadEntries = async (u = user, sf = statusFilter, s = search) => {
    setEntriesLoading(true);
    try {
      const params = new URLSearchParams();
      if (sf && sf !== "all") params.append("status", sf);
      if (s) params.append("search", s);
      const data = await apiFetch(`/entries?${params}`);
      setEntries(data.entries || []);
    } catch (err) { showToast(err.message, "error"); }
    finally { setEntriesLoading(false); }
  };

  const loadStats = async () => {
    try { const d = await apiFetch("/stats/today"); setStats(d); }
    catch {}
  };

  const loadOverstay = async () => {
    try {
      const d = await apiFetch("/entries/overstay");
      setOverstay(d.entries || []);
      setOverstayHrs(d.thresholdHours || 4);
    } catch {}
  };

  const loadAuditLogs = async () => {
    try { const d = await apiFetch("/audit-logs"); setAuditLogs(d.logs || []); }
    catch {}
  };

  const loadUsers = async () => {
    try { setManagedUsers(await apiFetch("/users")); }
    catch {}
  };

  // ── Tab Navigation ─────────────────────────────────
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch("");
    const sf =
      tab === "inside"  ? "Inside"  :
      tab === "pending" ? "Pending" : "all";
    setStatusFilter(sf);
    if (["dashboard", "inside", "all", "pending"].includes(tab)) loadEntries(user, sf, "");
    if (tab === "overstay") loadOverstay();
    if (tab === "audit")   loadAuditLogs();
    if (tab === "users")   loadUsers();
  };

  // ── Search ─────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    loadEntries(user, statusFilter, search);
  };

  // ── Entry Form Validation ─────────────────────────
  const validateEntryForm = () => {
    const errors = {};
    const isStudent = user?.role === "Student";
    const n = name.trim(), p = phone.trim();

    if (!n) errors.name = "Full name is required.";
    else if (n.length < 2) errors.name = "Name must be at least 2 characters.";
    else if (!/^[A-Za-z][A-Za-z\s.'-]*$/.test(n)) errors.name = "Letters, spaces, dots, or hyphens only.";

    if (!p) {
      errors.phone = isStudent ? "Roll No. or contact is required." : "Phone number is required.";
    } else if (isStudent) {
      if (!/^[A-Za-z0-9\-/]{5,20}$/.test(p) && !/^\d{10}$/.test(p.replace(/[\s-]/g, "")))
        errors.phone = "Enter a valid Roll No. (5–20 chars) or 10-digit phone.";
    } else {
      if (!/^\d{10}$/.test(p.replace(/[\s-]/g, "")))
        errors.phone = "Enter a valid 10-digit phone number.";
    }
    return errors;
  };

  // ── Add Entry ──────────────────────────────────────
  const handleAddVisitor = async (e) => {
    e.preventDefault();
    const errs = validateEntryForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setFormLoading(true);
    try {
      await apiFetch("/entries", { method: "POST", body: { name: name.trim(), phone: phone.trim(), purpose } });
      setName(""); setPhone("");
      showToast(user?.role === "Student" ? "Gate pass requested — awaiting approval." : "Visitor checked in!");
      await Promise.all([loadEntries(user, statusFilter, search), user?.role !== "Student" ? loadStats() : Promise.resolve()]);
    } catch (err) { showToast(err.message, "error"); }
    finally { setFormLoading(false); }
  };

  // ── Checkout ──────────────────────────────────────
  const handleCheckOut = async (id) => {
    try {
      await apiFetch(`/entries/${id}/checkout`, { method: "PATCH" });
      showToast("Checked out.");
      await Promise.all([loadEntries(user, statusFilter, search), loadStats()]);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Approve ───────────────────────────────────────
  const handleApprove = async (id) => {
    try {
      await apiFetch(`/entries/${id}/approve`, { method: "PATCH" });
      showToast("Entry approved — visitor is now inside.");
      await Promise.all([loadEntries(user, statusFilter, search), loadStats(), loadOverstay()]);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Reject ────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectModal.id) return;
    try {
      await apiFetch(`/entries/${rejectModal.id}/reject`, { method: "PATCH", body: { reason: rejectReason } });
      setRejectModal({ open: false, id: null }); setRejectReason("");
      showToast("Entry rejected.");
      await loadEntries(user, statusFilter, search);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Delete ────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Permanently delete this record?")) return;
    try {
      await apiFetch(`/entries/${id}`, { method: "DELETE" });
      showToast("Record deleted.");
      await Promise.all([loadEntries(user, statusFilter, search), loadStats()]);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Create User ───────────────────────────────────
  const validateUserForm = () => {
    const errs = {};
    if (!userForm.username.trim() || userForm.username.trim().length < 3) errs.username = "Min 3 characters.";
    if (!userForm.password || userForm.password.length < 6) errs.password = "Min 6 characters.";
    if (!userForm.displayName.trim()) errs.displayName = "Display name is required.";
    return errs;
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const errs = validateUserForm();
    if (Object.keys(errs).length) { setUserFormErrors(errs); return; }
    setUserFormErrors({});
    setUserFormLoading(true);
    try {
      await apiFetch("/users", { method: "POST", body: userForm });
      setUserForm({ username: "", password: "", displayName: "", role: "Gate Guard", rollNo: "" });
      showToast("User created successfully.");
      await loadUsers();
    } catch (err) { showToast(err.message, "error"); }
    finally { setUserFormLoading(false); }
  };

  const handleDeactivateUser = async (id) => {
    if (!confirm("Deactivate this user? They will not be able to log in.")) return;
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      showToast("User deactivated.");
      await loadUsers();
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Change Password ───────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(""); setPwSuccess("");
    if (!pwForm.current || !pwForm.next) { setPwError("Both fields are required."); return; }
    if (pwForm.next.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    try {
      await apiFetch("/auth/change-password", { method: "PATCH", body: { currentPassword: pwForm.current, newPassword: pwForm.next } });
      setPwSuccess("Password updated successfully."); setPwForm({ current: "", next: "" });
    } catch (err) { setPwError(err.message); }
  };

  // ── CSV Export ────────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await apiFetch("/entries/export", { rawResponse: true });
      if (!res.ok) { showToast("Export failed.", "error"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gate-entries-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Logout ────────────────────────────────────────
  const handleLogout = async () => {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch {}
    clearAuth();
    window.location.href = "index.html";
  };

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // ── Loading Screen ────────────────────────────────
  if (loading) {
    return (
      <div className="page-shell" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
        <div style={{ textAlign: "center" }}>
          <Spinner />
          <p style={{ marginTop: "12px", color: "#64748b" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isAdmin   = user.role === "Admin";
  const isGuard   = user.role === "Gate Guard";
  const isStudent = user.role === "Student";
  const canManage = isAdmin || isGuard;

  const tabLabel = {
    dashboard : isAdmin ? "Admin Dashboard" : isGuard ? "Gate Guard Operations" : "My Gate Pass",
    pending   : "Pending Approvals",
    inside    : "Currently Inside",
    all       : "All Visitor Logs",
    overstay  : "Overstay Alerts",
    users     : "Manage Users",
    audit     : "Audit Log",
    settings  : "Settings",
  };

  const showEntriesTable = ["dashboard", "pending", "inside", "all"].includes(activeTab);

  return (
    <div className="page-shell">
      <Header />

      <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: "", type: "success" })} />

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Reject Entry</h3>
            <p>Provide an optional rejection reason:</p>
            <textarea
              className="modal-textarea"
              rows={3}
              placeholder="e.g. No valid ID provided"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-delete"  onClick={handleReject}>Confirm Reject</button>
              <button className="btn-reset"   onClick={() => setRejectModal({ open: false, id: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-layout">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            {isAdmin ? "ADMIN PANEL" : isGuard ? "GUARD DESK" : "STUDENT PORTAL"}
          </div>
          <ul className="nav-links">
            <li className={activeTab === "dashboard" ? "active" : ""} onClick={() => handleTabChange("dashboard")}>
              {isStudent ? "My Gate Pass" : "Dashboard Overview"}
            </li>
            {canManage && (
              <>
                <li className={activeTab === "pending" ? "active" : ""} onClick={() => handleTabChange("pending")}>
                  Pending Approvals
                  {stats.pending > 0 && <span className="nav-badge">{stats.pending}</span>}
                </li>
                <li className={activeTab === "inside" ? "active" : ""} onClick={() => handleTabChange("inside")}>
                  Currently Inside ({stats.inside})
                </li>
                <li className={activeTab === "all" ? "active" : ""} onClick={() => handleTabChange("all")}>
                  All Visitor Logs
                </li>
                <li className={activeTab === "overstay" ? "active" : ""} onClick={() => handleTabChange("overstay")}>
                  Overstay Alerts
                  {overstay.length > 0 && <span className="nav-badge nav-badge-warn">{overstay.length}</span>}
                </li>
              </>
            )}
            {isAdmin && (
              <>
                <li className={activeTab === "users" ? "active" : ""} onClick={() => handleTabChange("users")}>Manage Users</li>
                <li className={activeTab === "audit" ? "active" : ""} onClick={() => handleTabChange("audit")}>Audit Log</li>
              </>
            )}
            <li className={activeTab === "settings" ? "active" : ""} onClick={() => handleTabChange("settings")}>Settings</li>
          </ul>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content">

          {/* Topbar */}
          <div className="topbar">
            <h1>{tabLabel[activeTab] || "Dashboard"}</h1>
            <div className="topbar-actions">
              {isAdmin && showEntriesTable && (
                <button className="btn-reset" onClick={handleExport}>⬇ Export CSV</button>
              )}
              {canManage && (
                <button className="btn-reset" onClick={() => { loadStats(); loadOverstay(); showToast("Refreshed."); }}>↻ Refresh</button>
              )}
              <div className="role-pill">Role: {user.role} ({user.username})</div>
            </div>
          </div>

          {/* Stats Cards */}
          {canManage && showEntriesTable && (
            <div className="stats-grid">
              <div className="stat-card"><span>Total Today</span><h2>{stats.total}</h2></div>
              <div className="stat-card"><span>Inside Campus</span><h2>{stats.inside}</h2></div>
              <div className="stat-card"><span>Checked Out</span><h2>{stats.checkedOut}</h2></div>
              <div className="stat-card stat-card-warn"><span>Pending</span><h2>{stats.pending}</h2></div>
            </div>
          )}

          {/* ── Overstay Tab ── */}
          {activeTab === "overstay" && (
            <div className="panel">
              <h3>Visitors Inside &gt; {overstayHrs} Hours</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>Purpose</th><th>Checked In</th><th>Duration</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {overstay.length === 0
                      ? <tr><td colSpan="6" style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>No overstay visitors 🎉</td></tr>
                      : overstay.map((v) => (
                          <tr key={v._id} className="row-warn">
                            <td><strong>{v.name}</strong></td>
                            <td>{v.phone}</td>
                            <td>{v.purpose}</td>
                            <td style={{ fontSize: "13px" }}>{formatDateTime(v.checkInAt)}</td>
                            <td><span className="badge-overstay">{timeAgo(v.checkInAt)}</span></td>
                            <td><button className="btn-checkout" onClick={() => handleCheckOut(v._id)}>Mark Exit</button></td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Entry Form (dashboard tab) ── */}
          {activeTab === "dashboard" && (
            <div className="panel">
              <h3>{isStudent ? "Request Gate Entry / Outpass" : "Register New Gate Entry"}</h3>
              <form className="entry-form" onSubmit={handleAddVisitor} noValidate>
                <div className="form-field">
                  <input
                    type="text"
                    placeholder={isStudent ? "Student Full Name" : "Visitor Full Name"}
                    className={formErrors.name ? "input-error" : ""}
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (formErrors.name) setFormErrors((p) => ({ ...p, name: "" })); }}
                    disabled={formLoading}
                    required
                  />
                  {formErrors.name && <span className="field-error">{formErrors.name}</span>}
                </div>
                <div className="form-field">
                  <input
                    type="text"
                    placeholder={isStudent ? "Roll No. / Contact" : "Phone Number"}
                    className={formErrors.phone ? "input-error" : ""}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: "" })); }}
                    disabled={formLoading}
                    required
                  />
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
                <div className="form-field">
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)} disabled={formLoading}>
                    {(isStudent ? PURPOSES_STUDENT : PURPOSES_VISITOR).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-add" disabled={formLoading}>
                  {formLoading ? "Saving…" : isStudent ? "+ Log My Entry" : "+ Check In Visitor"}
                </button>
              </form>
              {isStudent && (
                <p style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
                  ℹ️ Your request will stay <strong>Pending</strong> until a Guard or Admin approves it.
                </p>
              )}
            </div>
          )}

          {/* ── Search Bar ── */}
          {!isStudent && showEntriesTable && (
            <form className="search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search by name, phone, or purpose…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn-search">Search</button>
              {search && (
                <button type="button" className="btn-reset"
                  onClick={() => { setSearch(""); loadEntries(user, statusFilter, ""); }}>
                  Clear
                </button>
              )}
            </form>
          )}

          {/* ── Records Table ── */}
          {showEntriesTable && (
            <div className="panel">
              <h3>
                {isStudent ? "My Gate Pass History" :
                  activeTab === "pending" ? "Entries Awaiting Approval" :
                  activeTab === "inside"  ? "Visitors Currently Inside" : "All Records"}
              </h3>
              {entriesLoading
                ? <div style={{ textAlign: "center", padding: "32px" }}><Spinner /></div>
                : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>{isStudent ? "Roll / Contact" : "Phone"}</th>
                          <th>Purpose</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.length === 0
                          ? <tr><td colSpan="7" style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>No records found.</td></tr>
                          : entries.map((v) => (
                              <tr key={v._id}>
                                <td><strong>{v.name}</strong></td>
                                <td>{v.phone}</td>
                                <td>{v.purpose}</td>
                                <td style={{ fontSize: "13px" }}>{formatDateTime(v.checkInAt)}</td>
                                <td style={{ fontSize: "13px" }}>{v.checkOutAt ? formatDateTime(v.checkOutAt) : "—"}</td>
                                <td>
                                  <span className={
                                    v.status === "Inside"      ? "badge-in"       :
                                    v.status === "Checked Out" ? "badge-out"      :
                                    v.status === "Pending"     ? "badge-pending"  : "badge-rejected"
                                  }>{v.status}</span>
                                </td>
                                <td className="action-cell">
                                  {v.status === "Pending" && canManage && (
                                    <>
                                      <button className="btn-approve" onClick={() => handleApprove(v._id)}>Approve</button>
                                      <button className="btn-delete"  onClick={() => { setRejectModal({ open: true, id: v._id }); setRejectReason(""); }}>Reject</button>
                                    </>
                                  )}
                                  {v.status === "Inside" && (canManage || (isStudent && v.createdBy?._id === (user.id || user._id))) && (
                                    <button className="btn-checkout" onClick={() => handleCheckOut(v._id)}>Mark Exit</button>
                                  )}
                                  {["Checked Out", "Rejected"].includes(v.status) && !isAdmin && (
                                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>Completed</span>
                                  )}
                                  {isAdmin && (
                                    <button className="btn-delete" onClick={() => handleDelete(v._id)}>Delete</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* ── Users Tab (Admin only) ── */}
          {activeTab === "users" && isAdmin && (
            <>
              <div className="panel">
                <h3>Add New User</h3>
                <form className="entry-form" onSubmit={handleCreateUser} noValidate>
                  {[
                    { key: "username", ph: "Username", type: "text" },
                    { key: "password", ph: "Password", type: "password" },
                    { key: "displayName", ph: "Display Name", type: "text" },
                  ].map(({ key, ph, type }) => (
                    <div key={key} className="form-field">
                      <input
                        type={type}
                        placeholder={ph}
                        className={userFormErrors[key] ? "input-error" : ""}
                        value={userForm[key]}
                        onChange={(e) => { setUserForm((p) => ({ ...p, [key]: e.target.value })); if (userFormErrors[key]) setUserFormErrors((p) => ({ ...p, [key]: "" })); }}
                        required
                      />
                      {userFormErrors[key] && <span className="field-error">{userFormErrors[key]}</span>}
                    </div>
                  ))}
                  <div className="form-field">
                    <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
                      <option value="Gate Guard">Gate Guard</option>
                      <option value="Student">Student</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  {userForm.role === "Student" && (
                    <div className="form-field">
                      <input type="text" placeholder="Roll No. (optional)"
                        value={userForm.rollNo} onChange={(e) => setUserForm((p) => ({ ...p, rollNo: e.target.value }))} />
                    </div>
                  )}
                  <button type="submit" className="btn-add" disabled={userFormLoading}>
                    {userFormLoading ? "Creating…" : "+ Create User"}
                  </button>
                </form>
              </div>

              <div className="panel">
                <h3>All Active Users</h3>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Username</th><th>Display Name</th><th>Role</th><th>Roll No.</th><th>Created</th><th>Action</th></tr></thead>
                    <tbody>
                      {managedUsers.length === 0
                        ? <tr><td colSpan="6" style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>No users.</td></tr>
                        : managedUsers.map((u) => (
                            <tr key={u._id}>
                              <td><code>{u.username}</code></td>
                              <td>{u.displayName}</td>
                              <td>
                                <span className={`role-pill-sm role-${u.role.toLowerCase().replace(" ", "-")}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td>{u.rollNo || "—"}</td>
                              <td style={{ fontSize: "13px" }}>{formatDateTime(u.createdAt)}</td>
                              <td>
                                {u._id !== (user.id || user._id) && (
                                  <button className="btn-delete" onClick={() => handleDeactivateUser(u._id)}>Deactivate</button>
                                )}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Audit Log Tab (Admin only) ── */}
          {activeTab === "audit" && isAdmin && (
            <div className="panel">
              <h3>System Audit Log</h3>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
                  <tbody>
                    {auditLogs.length === 0
                      ? <tr><td colSpan="5" style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>No logs.</td></tr>
                      : auditLogs.map((l) => (
                          <tr key={l._id}>
                            <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{formatDateTime(l.createdAt)}</td>
                            <td><code style={{ fontSize: "12px" }}>{l.username}</code></td>
                            <td>
                              <span className={`action-badge action-${l.action.toLowerCase()}`}>{l.action}</span>
                            </td>
                            <td style={{ fontSize: "12px" }}>{l.details || "—"}</td>
                            <td style={{ fontSize: "12px", color: "#94a3b8" }}>{l.ip}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Settings Tab ── */}
          {activeTab === "settings" && (
            <div className="panel" style={{ maxWidth: "460px" }}>
              <h3>Change Password</h3>
              {pwError   && <div className="error-msg"   style={{ marginBottom: "14px" }}>{pwError}</div>}
              {pwSuccess && <div className="success-msg" style={{ marginBottom: "14px" }}>{pwSuccess}</div>}
              <form onSubmit={handleChangePassword} noValidate>
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" value={pwForm.next}    onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}    required />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: "0" }}>Update Password</button>
              </form>
            </div>
          )}

        </main>
      </div>
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<DashboardApp />);

