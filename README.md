# IronPulse Gym Management Portal (Web Prototype)

A responsive full-stack **Gym Management Web Application** built with **React**, **Node.js (Express)**, and **PostgreSQL**, designed as a proposal-ready web prototype that can also power a future mobile app via its clean REST API.

## Key Features
- **Dual-Role Authentication (JWT)**
  - **Gym Owner Portal**: Live floor check-ins/check-outs, member management, membership plan setup, fee dues & payment recording, analytics reports with CSV export, and gym profile settings.
  - **Gym Customer Portal**: 1-tap self check-in/check-out with live workout timer, personal in-time/out-time history, fee status & printable payment receipts, and full personal profile & fitness metrics maintenance.
- **Attendance Management**: Accurate In-Time & Out-Time logging, automatic duration calculation in PostgreSQL (`GENERATED ALWAYS AS` column), duplicate active-session protection, and front-desk + self-service modes.
- **Fees & Payment Tracking**: Membership plans, automated fee invoices, partial/full payments (`Cash`, `UPI`, `Card`, `Bank Transfer`), and receipt generation.
- **Reports & Analytics**: Daily attendance trends, peak gym hours, top consistent members, revenue breakdown by method, pending/overdue dues, and CSV export.
- **Responsive UI (PC & Mobile)**: Desktop sidebar layout + mobile bottom navigation bar and card layouts for narrow screens.

---

## Project Structure
```
Gym-project/
├── package.json        # Root scripts (dev, db:setup, build)
├── server/             # Express REST API + PostgreSQL schema & seed
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── db/         # pool.js, schema.sql, setup.js
│       ├── middleware/ # auth.js (JWT + role guard)
│       └── routes/     # auth, profile, plans, members, attendance, fees, reports
└── client/             # Vite + React + Tailwind CSS v4 frontend
    └── src/
        ├── api/        # API client & formatters
        ├── context/    # AuthContext
        ├── components/ # Layout, StatCard, StatusBadge, Modal
        └── pages/      # LoginPage, owner/*, customer/*
```

---

## Quick Start

1. **Configure Environment** (`server/.env` is already pre-configured for local PostgreSQL):
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=gym_management
   DB_USER=postgres
   DB_PASSWORD=postgres
   JWT_SECRET=<long random string>   # required when NODE_ENV=production
   GYM_TIMEZONE=Asia/Kolkata         # decides "today", midnight auto check-out, due/expiry dates
   ```
   See `server/.env.example` for all options.

2. **Install Dependencies** (already installed if setup ran):
   ```bash
   npm run install:all
   ```

3. **Initialize & Seed PostgreSQL Database**:
   ```bash
   npm run db:setup
   ```

4. **Start Both Backend API & Frontend Dev Server**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`

---

## Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Gym Owner** | `owner@ironpulse.fit` | `owner123` |
| **Gym Customer** | `arjun@ironpulse.fit` | `member123` |
| **Gym Customer 2** | `priya@ironpulse.fit` | `member123` |

*(1-click Demo Login buttons are also available right on the Sign-In page.)*
