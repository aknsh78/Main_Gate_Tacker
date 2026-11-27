const { useState, useEffect } = React;

function DashboardApp() {
  const [user, setUser] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Visitor / Student entry form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("Parent Visit");

  useEffect(() => {
    const loggedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (!loggedUser) {
      window.location.href = "index.html";
      return;
    }
    const parsedUser = JSON.parse(loggedUser);
    setUser(parsedUser);

    if (parsedUser.role === "Student") {
      setPurpose("Student Late Entry / Outpass");
    }

    setVisitors(getVisitors());
  }, []);

  const handleAddVisitor = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newEntry = {
      id: Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      purpose,
      addedBy: user.role,
      checkIn: getCurrentTime(),
      checkOut: null,
      status: "Inside"
    };

    const updated = [newEntry, ...visitors];
    setVisitors(updated);
    saveVisitors(updated);

    setName("");
    setPhone("");
  };

  const handleCheckOut = (id) => {
    const updated = visitors.map((v) =>
      v.id === id
        ? { ...v, status: "Checked Out", checkOut: getCurrentTime() }
        : v
    );
    setVisitors(updated);
    saveVisitors(updated);
  };

  // Admin-only action: delete a record
  const handleDeleteRecord = (id) => {
    if (user.role !== "Admin") return;
    const updated = visitors.filter((v) => v.id !== id);
    setVisitors(updated);
    saveVisitors(updated);
  };

  // Admin-only action: reset demo data
  const handleResetDemo = () => {
    if (user.role !== "Admin") return;
    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(DEFAULT_VISITORS));
    setVisitors(DEFAULT_VISITORS);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    window.location.href = "index.html";
  };

  if (!user) return null;

  const isAdmin = user.role === "Admin";
  const isGuard = user.role === "Gate Guard";
  const isStudent = user.role === "Student";

  // Metrics
  const totalVisitors = visitors.length;
  const insideCampus = visitors.filter((v) => v.status === "Inside").length;
  const checkedOut = visitors.filter((v) => v.status === "Checked Out").length;

  // Role-based record filtering
  let displayedVisitors = visitors;
  if (isStudent) {
    displayedVisitors = visitors.filter((v) => v.addedBy === "Student");
  } else if (activeTab === "inside") {
    displayedVisitors = visitors.filter((v) => v.status === "Inside");
  }

  return (
    <div className="page-shell">
      <Header />
      <div className="dashboard-layout">
        {/* Navigation Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            {isAdmin ? "ADMIN PANEL" : isGuard ? "GUARD DESK" : "STUDENT PORTAL"}
          </div>
          <ul className="nav-links">
            <li
              className={activeTab === "dashboard" ? "active" : ""}
              onClick={() => setActiveTab("dashboard")}
            >
              {isStudent ? "My Gate Pass" : "Dashboard Overview"}
            </li>

            {!isStudent && (
              <>
                <li
                  className={activeTab === "inside" ? "active" : ""}
                  onClick={() => setActiveTab("inside")}
                >
                  Currently Inside ({insideCampus})
                </li>
                <li
                  className={activeTab === "all" ? "active" : ""}
                  onClick={() => setActiveTab("all")}
                >
                  All Visitor Logs
                </li>
              </>
            )}
          </ul>

          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <div className="topbar">
            <h1>
              {isAdmin
                ? "Admin Dashboard"
                : isGuard
                ? "Gate Guard Operations"
                : "Student Gate Pass"}
            </h1>
            <div className="topbar-actions">
              {isAdmin && (
                <button className="btn-reset" onClick={handleResetDemo}>
                  Reset Demo Data
                </button>
              )}
              <div className="role-pill">
                Role: {user.role} ({user.username})
              </div>
            </div>
          </div>

          {/* Summary Statistics (Admin & Guard Only) */}
          {!isStudent && (
            <div className="stats-grid">
              <div className="stat-card">
                <span>Total Visitors Today</span>
                <h2>{totalVisitors}</h2>
              </div>
              <div className="stat-card">
                <span>Currently Inside Campus</span>
                <h2>{insideCampus}</h2>
              </div>
              <div className="stat-card">
                <span>Visitors Checked Out</span>
                <h2>{checkedOut}</h2>
              </div>
            </div>
          )}

          {/* Entry / Pass Registration Form */}
          <div className="panel">
            <h3>
              {isStudent ? "Request Student Gate Entry / Outpass" : "Register New Gate Entry"}
            </h3>
            <form className="entry-form" onSubmit={handleAddVisitor}>
              <input
                type="text"
                placeholder={isStudent ? "Student Full Name" : "Visitor Full Name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder={isStudent ? "Roll No. / Contact" : "Phone Number"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {isStudent ? (
                  <>
                    <option value="Student Late Entry / Outpass">Late Entry / Outpass</option>
                    <option value="Hostel Gate Pass">Hostel Gate Pass</option>
                    <option value="Event / Lab Permission">Event / Lab Permission</option>
                  </>
                ) : (
                  <>
                    <option value="Parent Visit">Parent Visit</option>
                    <option value="Admission Inquiry">Admission Inquiry</option>
                    <option value="Vendor / Delivery">Vendor / Delivery</option>
                    <option value="Official Meeting">Official Meeting</option>
                  </>
                )}
              </select>
              <button type="submit" className="btn-add">
                {isStudent ? "+ Log My Entry" : "+ Check In Visitor"}
              </button>
            </form>
          </div>

          {/* Records Table */}
          <div className="panel">
            <h3>{isStudent ? "My Gate Pass History" : "Recent Visitor Records"}</h3>
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
                  {displayedVisitors.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", color: "#64748b" }}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    displayedVisitors.map((visitor) => (
                      <tr key={visitor.id}>
                        <td><strong>{visitor.name}</strong></td>
                        <td>{visitor.phone}</td>
                        <td>{visitor.purpose}</td>
                        <td>{visitor.checkIn}</td>
                        <td>{visitor.checkOut || "—"}</td>
                        <td>
                          <span
                            className={
                              visitor.status === "Inside" ? "badge-in" : "badge-out"
                            }
                          >
                            {visitor.status}
                          </span>
                        </td>
                        <td className="action-cell">
                          {visitor.status === "Inside" ? (
                            <button
                              className="btn-checkout"
                              onClick={() => handleCheckOut(visitor.id)}
                            >
                              Mark Exit
                            </button>
                          ) : (
                            <span>Completed</span>
                          )}

                          {/* Delete button strictly visible to Admin */}
                          {isAdmin && (
                            <button
                              className="btn-delete"
                              onClick={() => handleDeleteRecord(visitor.id)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<DashboardApp />);