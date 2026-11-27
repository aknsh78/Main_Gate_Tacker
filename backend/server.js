"use strict";
// ══════════════════════════════════════════════════════════════════
//  MAIN GATE TRACKER  –  backend/server.js
//  Node.js + Express + MongoDB (Mongoose)
//  Single-file backend: DB schemas, auth, all API routes, static serve
// ══════════════════════════════════════════════════════════════════
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express      = require("express");
const mongoose     = require("mongoose");
const bcrypt       = require("bcryptjs");
const jwt          = require("jsonwebtoken");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const rateLimit    = require("express-rate-limit");
const path         = require("path");

const app = express();
app.set("trust proxy", 1); // Required behind Render/Railway reverse proxies for rateLimit & IP

// ── Environment ───────────────────────────────────────────────────
const {
  PORT          = 5000,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN = "8h",
  NODE_ENV       = "development",
  OVERSTAY_HOURS = 4,
  ADMIN_USERNAME = "admin",
  ADMIN_PASSWORD = "admin123",
  ADMIN_DISPLAY_NAME = "Admin Officer",
} = process.env;

// ══════════════════════════════════════════════════════════════════
//  MONGOOSE SCHEMAS
// ══════════════════════════════════════════════════════════════════

// ── User ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  displayName:  { type: String, required: true, trim: true },
  role:         { type: String, enum: ["Admin", "Gate Guard", "Student"], required: true },
  rollNo:       { type: String, default: null },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

// ── Gate Entry ────────────────────────────────────────────────────
const entrySchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  phone:           { type: String, required: true, trim: true },
  purpose:         { type: String, required: true },
  entryType:       { type: String, enum: ["visitor", "student_pass"], default: "visitor" },
  status:          { type: String, enum: ["Pending", "Inside", "Checked Out", "Rejected"], default: "Inside" },
  checkInAt:       { type: Date, default: Date.now },
  checkOutAt:      { type: Date, default: null },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  notes:           { type: String, default: "" },
  rejectionReason: { type: String, default: "" },
  isDeleted:       { type: Boolean, default: false },
  date:            { type: String }, // YYYY-MM-DD for daily queries
}, { timestamps: true });

entrySchema.index({ date: 1, isDeleted: 1 });
entrySchema.index({ status: 1, isDeleted: 1 });
entrySchema.index({ createdBy: 1 });

// ── Audit Log ─────────────────────────────────────────────────────
const auditSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  username: String,
  action:   {
    type: String,
    enum: ["LOGIN", "LOGOUT", "CHECK_IN", "CHECK_OUT", "APPROVE", "REJECT",
           "DELETE", "CREATE_USER", "UPDATE_USER"],
  },
  entryId:  { type: mongoose.Schema.Types.ObjectId, ref: "GateEntry", default: null },
  details:  { type: String, default: "" },
  ip:       String,
}, { timestamps: true });

auditSchema.index({ createdAt: -1 });

const User      = mongoose.model("User",      userSchema);
const GateEntry = mongoose.model("GateEntry", entrySchema);
const AuditLog  = mongoose.model("AuditLog",  auditSchema);

// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════
const todayStr = () => new Date().toISOString().slice(0, 10);

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

async function logAudit(userId, username, action, ip, entryId = null, details = "") {
  try { await AuditLog.create({ userId, username, action, ip, entryId, details }); } catch {}
}

const getIP = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";

// Validation helpers
const isValidName  = (n) => n.length >= 2 && /^[A-Za-z][A-Za-z\s.'-]*$/.test(n);
const isValidPhone = (p) => /^\d{10}$/.test(p.replace(/[\s-]/g, ""));
const isValidRoll  = (r) => /^[A-Za-z0-9\-/]{5,20}$/.test(r);

// ══════════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════════════════
// Helmet: disable CSP so CDN React / Babel loads from unpkg.com
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors({
  origin: NODE_ENV === "production" ? false : "*",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Login rate limiter: 10 attempts per 15 min
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true, legacyHeaders: false,
}));

// Global API rate limiter
app.use("/api", rateLimit({
  windowMs: 60 * 1000, max: 300,
  message: { error: "Too many requests. Slow down." },
}));

// ══════════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════════
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required." });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid or expired. Please log in again." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    next();
  };
}

// ══════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role)
      return res.status(400).json({ error: "username, password, and role are required." });

    const user = await User.findOne({ username: String(username).toLowerCase().trim(), isActive: true });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });
    if (user.role !== role) return res.status(401).json({ error: `Account is not registered as ${role}.` });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    await logAudit(user._id, user.username, "LOGIN", getIP(req));
    res.json({
      token: signToken(user),
      user: { id: user._id, username: user.username, displayName: user.displayName, role: user.role, rollNo: user.rollNo },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error." }); }
});

// POST /api/auth/logout
app.post("/api/auth/logout", authenticate, async (req, res) => {
  await logAudit(req.user.id, req.user.username, "LOGOUT", getIP(req));
  res.json({ message: "Logged out successfully." });
});

// GET /api/auth/me
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found or inactive." });
    res.json({
      id: user._id,
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      rollNo: user.rollNo,
    });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// PATCH /api/auth/change-password
app.patch("/api/auth/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "currentPassword and newPassword are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "New password must be at least 6 characters." });

    const user = await User.findById(req.user.id);
    if (!await bcrypt.compare(currentPassword, user.passwordHash))
      return res.status(401).json({ error: "Current password is incorrect." });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: "Password changed successfully." });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// ══════════════════════════════════════════════════════════════════
//  USER MANAGEMENT (Admin only)
// ══════════════════════════════════════════════════════════════════

// GET /api/users
app.get("/api/users", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select("-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// POST /api/users
app.post("/api/users", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const { username, password, displayName, role, rollNo } = req.body;
    if (!username || !password || !displayName || !role)
      return res.status(400).json({ error: "username, password, displayName, and role are required." });
    if (!["Admin", "Gate Guard", "Student"].includes(role))
      return res.status(400).json({ error: "Invalid role." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (await User.findOne({ username: username.toLowerCase().trim() }))
      return res.status(409).json({ error: "Username already exists." });

    const user = await User.create({
      username: username.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(password, 12),
      displayName, role,
      rollNo: rollNo || null,
    });
    await logAudit(req.user.id, req.user.username, "CREATE_USER", getIP(req), null, `Created: ${username}`);
    res.status(201).json({ message: "User created.", user: { id: user._id, username: user.username, displayName: user.displayName, role: user.role } });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// PATCH /api/users/:id
app.patch("/api/users/:id", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const { displayName, role, rollNo, password, isActive } = req.body;
    if (displayName)  user.displayName = displayName;
    if (role && ["Admin", "Gate Guard", "Student"].includes(role)) user.role = role;
    if (rollNo  !== undefined) user.rollNo   = rollNo;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
      user.passwordHash = await bcrypt.hash(password, 12);
    }
    await user.save();
    await logAudit(req.user.id, req.user.username, "UPDATE_USER", getIP(req), null, `Updated: ${user.username}`);
    res.json({ message: "User updated." });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// DELETE /api/users/:id  (soft deactivate)
app.delete("/api/users/:id", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    if (req.params.id === String(req.user.id))
      return res.status(400).json({ error: "Cannot deactivate your own account." });
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ message: "User deactivated." });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// ══════════════════════════════════════════════════════════════════
//  GATE ENTRIES
// ══════════════════════════════════════════════════════════════════

// NOTE: Specific paths (/export, /overstay) are defined BEFORE /:id routes
//       to prevent Express matching them as :id = "export"

// GET /api/entries/export  (Admin only – CSV download)
app.get("/api/entries/export", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const filter = { isDeleted: false };
    if (req.query.date)   filter.date   = req.query.date;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;

    const entries = await GateEntry.find(filter)
      .populate("createdBy", "displayName role")
      .sort({ checkInAt: -1 });

    const headers = ["ID", "Name", "Phone/Roll", "Purpose", "Entry Type", "Status",
                     "Check-In", "Check-Out", "Added By", "Notes", "Rejection Reason"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = entries.map((e) => [
      e._id, e.name, e.phone, e.purpose, e.entryType, e.status,
      e.checkInAt  ? new Date(e.checkInAt ).toLocaleString("en-IN") : "",
      e.checkOutAt ? new Date(e.checkOutAt).toLocaleString("en-IN") : "",
      e.createdBy?.displayName || "",
      e.notes, e.rejectionReason,
    ].map(esc).join(","));

    const csv = [headers.map(esc).join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="gate-entries-${req.query.date || "all"}.csv"`);
    res.send(csv);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// GET /api/entries/overstay  (Admin & Guard)
app.get("/api/entries/overstay", authenticate, requireRole("Admin", "Gate Guard"), async (req, res) => {
  try {
    const threshold = new Date(Date.now() - Number(OVERSTAY_HOURS) * 3_600_000);
    const entries = await GateEntry.find({ status: "Inside", checkInAt: { $lt: threshold }, isDeleted: false })
      .populate("createdBy", "displayName role username")
      .sort({ checkInAt: 1 });
    res.json({ count: entries.length, entries, thresholdHours: Number(OVERSTAY_HOURS) });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// GET /api/entries  (paginated, filtered)
app.get("/api/entries", authenticate, async (req, res) => {
  try {
    const { status, search, date, page = 1, limit = 100 } = req.query;
    const filter = { isDeleted: false };

    // Students only see their own records
    if (req.user.role === "Student") filter.createdBy = req.user.id;

    if (status && status !== "all") filter.status = status;
    if (date)   filter.date = date;
    if (search) {
      const safeSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name:    { $regex: safeSearch, $options: "i" } },
        { phone:   { $regex: safeSearch, $options: "i" } },
        { purpose: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      GateEntry.find(filter)
        .populate("createdBy",  "displayName role username")
        .populate("approvedBy", "displayName")
        .sort({ checkInAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      GateEntry.countDocuments(filter),
    ]);

    res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// POST /api/entries
app.post("/api/entries", authenticate, async (req, res) => {
  try {
    const { name, phone, purpose } = req.body;
    const isStudent = req.user.role === "Student";

    if (!name || !phone || !purpose)
      return res.status(400).json({ error: "name, phone, and purpose are required." });
    if (!isValidName(name.trim()))
      return res.status(400).json({ error: "Invalid name. Use letters, spaces, dots, or hyphens." });
    if (isStudent) {
      if (!isValidRoll(phone.trim()) && !isValidPhone(phone.trim()))
        return res.status(400).json({ error: "Enter a valid Roll No. (5–20 chars) or 10-digit phone." });
    } else {
      if (!isValidPhone(phone.trim()))
        return res.status(400).json({ error: "Enter a valid 10-digit phone number." });
    }

    const entry = await GateEntry.create({
      name: name.trim(),
      phone: isStudent ? phone.trim() : phone.trim().replace(/[\s-]/g, ""),
      purpose,
      entryType:  isStudent ? "student_pass" : "visitor",
      status:     isStudent ? "Pending"       : "Inside",
      createdBy:  req.user.id,
      date:       todayStr(),
    });

    await entry.populate("createdBy", "displayName role username");
    await logAudit(req.user.id, req.user.username, "CHECK_IN", getIP(req), entry._id, `Entry for: ${name}`);
    res.status(201).json(entry);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// PATCH /api/entries/:id/checkout
app.patch("/api/entries/:id/checkout", authenticate, async (req, res) => {
  try {
    const entry = await GateEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!entry) return res.status(404).json({ error: "Entry not found." });
    if (entry.status !== "Inside") return res.status(400).json({ error: "Entry is not currently inside." });

    // Students can only check out their own entries
    if (req.user.role === "Student" && String(entry.createdBy) !== String(req.user.id))
      return res.status(403).json({ error: "Access denied." });

    entry.status     = "Checked Out";
    entry.checkOutAt = new Date();
    await entry.save();
    await logAudit(req.user.id, req.user.username, "CHECK_OUT", getIP(req), entry._id);
    res.json(entry);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// PATCH /api/entries/:id/approve  (Guard or Admin)
app.patch("/api/entries/:id/approve", authenticate, requireRole("Admin", "Gate Guard"), async (req, res) => {
  try {
    const entry = await GateEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!entry) return res.status(404).json({ error: "Entry not found." });
    if (entry.status !== "Pending") return res.status(400).json({ error: "Entry is not pending." });

    entry.status     = "Inside";
    entry.approvedBy = req.user.id;
    entry.checkInAt  = new Date();
    await entry.save();
    await entry.populate("createdBy",  "displayName role username");
    await entry.populate("approvedBy", "displayName");
    await logAudit(req.user.id, req.user.username, "APPROVE", getIP(req), entry._id);
    res.json(entry);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// PATCH /api/entries/:id/reject  (Guard or Admin)
app.patch("/api/entries/:id/reject", authenticate, requireRole("Admin", "Gate Guard"), async (req, res) => {
  try {
    const entry = await GateEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!entry) return res.status(404).json({ error: "Entry not found." });
    if (entry.status !== "Pending") return res.status(400).json({ error: "Entry is not pending." });

    entry.status          = "Rejected";
    entry.rejectionReason = req.body.reason || "";
    entry.approvedBy      = req.user.id;
    await entry.save();
    await logAudit(req.user.id, req.user.username, "REJECT", getIP(req), entry._id, req.body.reason || "");
    res.json(entry);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// PATCH /api/entries/:id/notes  (Admin or Guard)
app.patch("/api/entries/:id/notes", authenticate, requireRole("Admin", "Gate Guard"), async (req, res) => {
  try {
    const entry = await GateEntry.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { notes: req.body.notes || "" },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: "Entry not found." });
    res.json(entry);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// DELETE /api/entries/:id  (Admin only – soft delete)
app.delete("/api/entries/:id", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const entry = await GateEntry.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: "Entry not found." });
    await logAudit(req.user.id, req.user.username, "DELETE", getIP(req), entry._id);
    res.json({ message: "Entry deleted." });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// ══════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════

// GET /api/stats/today
app.get("/api/stats/today", authenticate, requireRole("Admin", "Gate Guard"), async (req, res) => {
  try {
    const today = todayStr();
    const [total, inside, checkedOut, pending] = await Promise.all([
      GateEntry.countDocuments({ date: today, isDeleted: false }),
      GateEntry.countDocuments({ date: today, status: "Inside",      isDeleted: false }),
      GateEntry.countDocuments({ date: today, status: "Checked Out", isDeleted: false }),
      GateEntry.countDocuments({ date: today, status: "Pending",     isDeleted: false }),
    ]);
    res.json({ total, inside, checkedOut, pending, date: today });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// GET /api/stats/weekly  (Admin only)
app.get("/api/stats/weekly", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const results = await Promise.all(
      days.map(async (date) => ({
        date,
        count: await GateEntry.countDocuments({ date, isDeleted: false }),
      }))
    );
    res.json(results);
  } catch { res.status(500).json({ error: "Server error." }); }
});

// ══════════════════════════════════════════════════════════════════
//  AUDIT LOGS
// ══════════════════════════════════════════════════════════════════

// GET /api/audit-logs  (Admin only)
app.get("/api/audit-logs", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLog.countDocuments(),
    ]);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch { res.status(500).json({ error: "Server error." }); }
});

// ══════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════════════════════════════════════════
app.get("/api/health", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: states[mongoose.connection.readyState] || "unknown",
    env: NODE_ENV,
  });
});

// ══════════════════════════════════════════════════════════════════
//  STATIC FILES  (serves frontend/)
// ══════════════════════════════════════════════════════════════════
const FRONTEND = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND));
app.get(/^(?!\/api).*$/, (_req, res) => res.sendFile(path.join(FRONTEND, "index.html")));

// ══════════════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ══════════════════════════════════════════════════════════════════
//  DATABASE SEED  (runs once on first boot)
// ══════════════════════════════════════════════════════════════════
async function seed() {
  // Seed admin
  if (!await User.findOne({ username: ADMIN_USERNAME })) {
    await User.create({ username: ADMIN_USERNAME, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), displayName: ADMIN_DISPLAY_NAME, role: "Admin" });
    console.log(`✅  Admin seeded  → ${ADMIN_USERNAME}`);
  }
  // Seed demo guard
  if (!await User.findOne({ username: "guard" })) {
    await User.create({ username: "guard", passwordHash: await bcrypt.hash("guard123", 12), displayName: "Main Gate Security", role: "Gate Guard" });
    console.log("✅  Guard seeded  → guard");
  }
  // Seed demo student
  if (!await User.findOne({ username: "student" })) {
    await User.create({ username: "student", passwordHash: await bcrypt.hash("student123", 12), displayName: "Akash Singh (CSE-11)", role: "Student", rollNo: "CSE-11-001" });
    console.log("✅  Student seeded → student");
  }
  // Seed demo entries
  if (await GateEntry.countDocuments() === 0) {
    const admin = await User.findOne({ username: ADMIN_USERNAME });
    await GateEntry.insertMany([
      { name: "Rohan Sharma",  phone: "9876543210", purpose: "Admission Inquiry", status: "Inside",      createdBy: admin._id, date: todayStr(), checkInAt: new Date(Date.now() - 3_600_000) },
      { name: "Priya Verma",   phone: "9123456780", purpose: "Parent Visit",       status: "Checked Out", createdBy: admin._id, date: todayStr(), checkInAt: new Date(Date.now() - 7_200_000), checkOutAt: new Date(Date.now() - 1_800_000) },
      { name: "Amit Kumar",    phone: "9988776655", purpose: "Vendor / Delivery",  status: "Inside",      createdBy: admin._id, date: todayStr(), checkInAt: new Date(Date.now() - 5_400_000) },
    ]);
    console.log("✅  Demo entries seeded.");
  }
}

// ══════════════════════════════════════════════════════════════════
//  STARTUP
// ══════════════════════════════════════════════════════════════════
async function start() {
  if (!MONGODB_URI) {
    console.error("❌  MONGODB_URI is not set in .env. Add it and restart.");
    process.exit(1);
  }
  if (!JWT_SECRET || JWT_SECRET === "change_this_to_a_strong_random_secret_before_production") {
    if (NODE_ENV === "production") {
      console.error("❌  JWT_SECRET must be set to a strong random value in production.");
      process.exit(1);
    }
    console.warn("⚠️   JWT_SECRET is using the default. Set a strong secret in .env before deploying.");
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅  MongoDB connected.");
    await seed();
    app.listen(PORT, () => {
      console.log(`\n🚀  Main Gate Tracker  →  http://localhost:${PORT}`);
      console.log(`    Environment: ${NODE_ENV}\n`);
    });
  } catch (err) {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

start();

