const { useState, useEffect } = React;

function DashboardApp() {
  const [user, setUser] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  // New visitor form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("Parent Visit");

  useEffect(() => {
    const loggedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (!loggedUser) {
      window.location.href = "index.html";
      return;
    }
    setUser(JSON.parse(loggedUser));
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

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    window.location.href = "index.html";
  };

  if (!user) return null;

  // Dashboard Metrics
  const totalVisitors = visitors.length;
  const insideCampus = visitors.filter((v) => v.status === "Inside").length;
  const checkedOut = visitors.filter((v) => v.status === "Checked Out").length;

  // Filter table based on sidebar selection
  const displayedVisitors =
    activeTab === "inside"
      ? visitors.filter((v) => v.status === "Inside")
      : visitors;

  return (
    <div className="dashboard-layout">
      {/* Navigation Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">MAIN GATE TRACKER</div>
        <ul className="nav-links">
          <li
            className={activeTab === "dashboard" ? "active" : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard Overview
          </li>
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
        </ul>

        <button className="btn-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="topbar">
          <h1>Admin Dashboard</h1>
          <div className="role-pill">
            Logged in as: {user.username} ({user.role})
          </div>
        </div>

        {/* Summary Statistics */}
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

        {/* Quick Visitor Entry Form */}
        <div className="panel">
          <h3>Register New Gate Entry</h3>
          <form className="entry-form" onSubmit={handleAddVisitor}>
            <input
              type="text"
              placeholder="Visitor Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="Parent Visit">Parent Visit</option>
              <option value="Admission Inquiry">Admission Inquiry</option>
              <option value="Vendor / Delivery">Vendor / Delivery</option>
              <option value="Official Meeting">Official Meeting</option>
            </select>
            <button type="submit" className="btn-add">
              + Check In Visitor
            </button>
          </form>
        </div>

        {/* Recent Visitor Records Table */}
        <div className="panel">
          <h3>Recent Visitor Records</h3>
          <table>
            <thead>
              <tr>
                <th>Visitor Name</th>
                <th>Phone</th>
                <th>Purpose</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedVisitors.map((visitor) => (
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
                  <td>
                    {visitor.status === "Inside" ? (
                      <button
                        className="btn-checkout"
                        onClick={() => handleCheckOut(visitor.id)}
                      >
                        Mark Exit
                      </button>
                    ) : (
                      "Completed"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<DashboardApp />);