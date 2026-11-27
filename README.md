# Main Gate Tracker 🏫

> **Campus Main Gate Visitor & Entry Management System**
> ABESEC Ghaziabad · Full Stack Development Team

A production-ready web application for managing campus visitor check-ins, student gate passes, overstay alerts, and audit trails — built with **Node.js + Express + MongoDB** on the backend and **React 18 (CDN)** on the frontend.

---

## ✨ Features

### Authentication & Security
- JWT-based login with role-aware credentials
- bcrypt password hashing (cost factor 12)
- HTTP rate limiting — 10 login attempts per 15 minutes
- Server-side RBAC on every route (Admin → Guard → Student)
- Audit trail for every login, check-in, check-out, approve, reject, and delete

### Roles
| Role | Capabilities |
|---|---|
| **Admin** | Full access: manage users, approve/reject passes, delete records, export CSV, view audit log |
| **Gate Guard** | Check in visitors, approve/reject student passes, mark exits, see overstay alerts |
| **Student** | Submit gate pass requests (enters Pending state), view own history, change password |

### Gate Entry Workflow
- **Visitors** (by Guard/Admin): immediately `Inside` on check-in → `Checked Out` on exit
- **Students**: `Pending` after submission → Guard/Admin `Approves` → `Inside` → `Checked Out`
- Guard/Admin can optionally **Reject** with a reason
- **Soft delete** — records are hidden, not erased, for auditability

### Dashboard Features
- Live stats: Total today, Inside campus, Checked out, Pending approvals
- **Overstay Alerts** tab — flags visitors inside > N hours (configurable via `OVERSTAY_HOURS`)
- **Search** by name, phone, or purpose
- **Filter** by status (All / Pending / Inside / Checked Out)
- **CSV Export** (Admin, filtered by date/status)
- **Manage Users** — create, view, deactivate Guard/Student/Admin accounts
- **Audit Log** — paginated system action history with timestamp, user, action, and IP
- **Settings** — in-app password change for all roles
- Real-time **Reject Modal** with optional rejection reason
- Toast notifications for all actions
- Responsive sidebar layout (collapses on mobile)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Backend Framework | Express.js 4 |
| Database | MongoDB (via Mongoose 8) |
| Authentication | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Logging | `morgan` |
| Frontend | React 18 + Babel (CDN, no build step) |
| Styling | Vanilla CSS (CSS variables, responsive grid) |

---

## 📁 Project Structure

```
Main-gate-tracker/
├── backend/
│   └── server.js          ← All backend code (single file)
├── frontend/              ← All frontend files (served by Express)
│   ├── index.html         ← Login page
│   ├── dashboard.html     ← Dashboard
│   ├── css/
│   │   ├── style.css      ← Shared styles (variables, header, toast, modal, spinner)
│   │   ├── login.css      ← Login card styles
│   │   └── dashboard.css  ← Sidebar, table, badges, responsive layout
│   └── js/
│       ├── common.js      ← API helper (apiFetch), auth storage, shared components
│       ├── auth.js        ← Login page (LoginApp React component)
│       └── dashboard.js   ← Dashboard (DashboardApp React component, all tabs)
├── .env                   ← Environment variables (DO NOT commit)
├── .env.example           ← Template — copy to .env and fill in values
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js ≥ 18 (`node --version`)
- A MongoDB instance — local or [MongoDB Atlas](https://cloud.mongodb.com) (free tier)

### 2. Clone & Install
```bash
git clone <your-repo-url>
cd Main-gate-tracker
npm install
```

### 3. Configure Environment
```bash
# Copy the example file
copy .env.example .env
```

Open `.env` and fill in at minimum:

```env
MONGODB_URI=mongodb://localhost:27017/main-gate-tracker
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
```

### 4. Start the Server
```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

The app runs at **http://localhost:5000** (or your `PORT`).

On first boot, seed data is created automatically:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `guard` | `guard123` | Gate Guard |
| `student` | `student123` | Student |

> Change these credentials immediately after first login via **Settings → Change Password** or update `ADMIN_PASSWORD` in `.env` before deploying.

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `5000` | HTTP port |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | (insecure default) | Strong random string for signing JWTs |
| `JWT_EXPIRES_IN` | No | `8h` | Token lifetime (e.g. `8h`, `1d`) |
| `ADMIN_USERNAME` | No | `admin` | Seed admin username |
| `ADMIN_PASSWORD` | No | `admin123` | Seed admin password |
| `ADMIN_DISPLAY_NAME` | No | `Admin Officer` | Seed admin display name |
| `OVERSTAY_HOURS` | No | `4` | Hours after which a visitor is flagged as overstay |

---

## 🌐 API Reference

All routes are prefixed with `/api`. Protected routes require:
```
Authorization: Bearer <token>
```

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login, returns JWT + user |
| `POST` | `/api/auth/logout` | Any | Logs out (audit only) |
| `GET` | `/api/auth/me` | Any | Current user profile |
| `PATCH` | `/api/auth/change-password` | Any | Change own password |

### Gate Entries
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/entries` | Any | List entries (Students: own only) |
| `POST` | `/api/entries` | Any | Check in visitor / request student pass |
| `PATCH` | `/api/entries/:id/checkout` | Any | Mark exit |
| `PATCH` | `/api/entries/:id/approve` | Admin, Guard | Approve pending student pass |
| `PATCH` | `/api/entries/:id/reject` | Admin, Guard | Reject with reason |
| `PATCH` | `/api/entries/:id/notes` | Admin, Guard | Add/update notes |
| `DELETE` | `/api/entries/:id` | Admin | Soft-delete a record |
| `GET` | `/api/entries/export` | Admin | Download entries as CSV |
| `GET` | `/api/entries/overstay` | Admin, Guard | Visitors inside > OVERSTAY_HOURS |

**Query params for `GET /api/entries`:**  `status`, `search`, `date` (YYYY-MM-DD), `page`, `limit`

### Stats
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stats/today` | Admin, Guard | Today's totals |
| `GET` | `/api/stats/weekly` | Admin | Last 7 days entry counts |

### Users (Admin only)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List active users |
| `POST` | `/api/users` | Create user |
| `PATCH` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Deactivate user |

### System
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server + DB status (public) |
| `GET` | `/api/audit-logs` | Paginated audit trail (Admin) |

---

## ☁️ Deployment

### Railway (Recommended)
1. Push repo to GitHub.
2. Create a new **Railway** project → "Deploy from GitHub repo".
3. Add a **MongoDB** plugin or use an external Atlas URI.
4. Set environment variables in the Railway dashboard (see table above).
5. Railway auto-detects `npm start` from `package.json`.

### Render
1. New **Web Service** → connect GitHub repo.
2. Build command: `npm install` · Start command: `npm start`
3. Add all env vars in the Render dashboard.

### Heroku
```bash
heroku create main-gate-tracker
heroku config:set MONGODB_URI="..." JWT_SECRET="..." NODE_ENV=production
git push heroku main
```

### Production Checklist
- [ ] `MONGODB_URI` → Atlas cluster with IP whitelist / VPC
- [ ] `JWT_SECRET` → strong random 64-byte hex string
- [ ] `NODE_ENV=production`
- [ ] Change all seed passwords immediately after first login
- [ ] Enable HTTPS (handled by Railway/Render automatically)
- [ ] Set `OVERSTAY_HOURS` to campus policy (default 4 hours)

---

## 🌐 Online CDN Dependencies

The frontend loads React 18 and Babel from `unpkg.com` (requires internet on first load; browsers cache aggressively). For a fully offline campus intranet deployment, download these scripts locally and update the `<script>` tags in `index.html` and `dashboard.html`:

```
https://unpkg.com/react@18/umd/react.production.min.js
https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
https://unpkg.com/@babel/standalone/babel.min.js
```

---

## 👥 Developed By

| Name | Role |
|---|---|
| **Akansha Kukshal** | Full Stack Developer |
| **Akash Kumar Singh** | Full Stack Developer |

**Branch:** CSE · **Section:** 11 · **Institution:** ABESEC Ghaziabad  
© 2026 ABESEC Ghaziabad. All Rights Reserved.

