# Main Gate Tracker

A campus visitor and student gate-pass management system built for **ABESEC Ghaziabad** using Node.js, Express, MongoDB, and React.

**Live Deployment:** https://main-gate-tracker-v196.onrender.com

## Features

- **Role-Based Access Control** — Separate views and server-enforced permissions for `Admin`, `Gate Guard`, and `Student`.
- **Visitor Check-In & Check-Out** — Guards and Admins can log visitor entries, track who is currently inside campus, and record exits.
- **Student Gate Pass Workflow** — Students submit entry/outpass requests (`Pending`), which Guards or Admins can `Approve` or `Reject` with a reason.
- **Overstay Alerts** — Flags visitors who remain inside past the configured `OVERSTAY_HOURS` threshold.
- **Search, Stats & CSV Export** — Daily campus counts, keyword search by name/phone/purpose, and CSV export for Admins.
- **User Management & Audit Log** — Admins can create or deactivate accounts and review timestamped action logs.
- **Authentication & Validation** — JWT sessions, bcrypt password hashing, login rate limiting, and client/server input validation.

## Tech Stack

- **Backend:** Node.js, Express, Mongoose (MongoDB), JWT, bcryptjs, Helmet
- **Frontend:** React 18 (CDN), HTML5, CSS3

## Project Structure

```
Main_Gate_Tacker/
├── backend/
│   └── server.js
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── css/
│   │   ├── style.css
│   │   ├── login.css
│   │   └── dashboard.css
│   └── js/
│       ├── common.js
│       ├── auth.js
│       └── dashboard.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local instance or MongoDB Atlas)

### Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/aknsh78/Main_Gate_Tacker.git
   cd Main_Gate_Tacker
   npm install
   ```

2. Create a `.env` file from the template:

   ```bash
   cp .env.example .env
   ```

   Update the variables in `.env`:

   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_random_secret_key
   JWT_EXPIRES_IN=8h
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_admin_password
   ADMIN_DISPLAY_NAME=Admin Officer
   OVERSTAY_HOURS=4
   ```

3. Run the server:

   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

   Open `http://localhost:5000` in your browser.

### Default Accounts (First Boot Seed)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` (or `ADMIN_PASSWORD` from `.env`) |
| Gate Guard | `guard` | `guard123` |
| Student | `student` | `student123` |

Change default passwords from the **Settings** tab after signing in.

## Contributors

- **Akansha Kukshal** — CSE-11, ABESEC Ghaziabad
- **Akash Kumar Singh** — CSE-11, ABESEC Ghaziabad
