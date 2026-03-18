# NovaPay - Core Retail Banking PoC

A full-stack retail banking proof of concept built with **React**, **Tailwind CSS**, **Shadcn UI**, **Hono**, and **Cloudflare D1**. Designed to run on **Cloudflare Workers**.

## Features

### Authentication & Security
- Secure password hashing using PBKDF2-SHA256 via Web Crypto API
- HTTP-only cookie-based session management
- Account lockout after 5 consecutive failed login attempts (15-minute cooldown)
- Role-based access control (user / admin)
- Frozen account protection at the middleware level

### User Registration
- Generates a unique user ID in the format `firstname<2-digit-number>@novapay` (e.g., `john42@novapay`) with duplicate checking
- Automatically provisions a **Checking** account (seeded with ₹1,000 mock rupees) and a **Savings** account
- Audit log entry created on registration

### Account Management
- View all accounts with balances on the dashboard
- Rename accounts via inline editing
- Download plain-text account statements

### Transfers
- **Internal transfers** between the user's own accounts
- **External transfers** to established payees
- **Money requests** sent to other users by User ID
- All transfer requests require an **idempotency key** to prevent duplicate processing
- Transfers use **D1 batch operations** for atomicity
- Balance checks with conditional updates (`WHERE balance >= ?`) to prevent overdrafts
- Transaction status tracking: `pending`, `completed`, `failed`

### Payee Management
- Full CRUD operations for payees (create, read, update, delete)
- Auto-populate payee name and checking account ID by entering a User ID
- Nicknames for easy identification

### Notifications
- Mock notifications written to a log table when users receive funds
- Unread count badge in navigation header
- Mark individual or all notifications as read

### Admin Dashboard
- **Overview**: Total mock liquidity across all accounts, total users, total accounts
- **User Management**: View all users, freeze/unfreeze accounts
- **Transaction Oversight**: View all system transactions, reverse completed transactions
- **Audit Log**: Full history of all sensitive actions (registrations, logins, transfers, freezes, reversals)

## Architecture

```
/
├── src/                          # Backend (Hono + Cloudflare Workers)
│   ├── index.ts                  # Main Hono app with route mounting
│   ├── types.ts                  # TypeScript interfaces
│   ├── db/
│   │   └── schema.sql            # D1 database schema
│   ├── middleware/
│   │   └── auth.ts               # Auth & admin middleware
│   ├── routes/
│   │   ├── auth.ts               # Registration, login, logout
│   │   ├── accounts.ts           # Account CRUD, transactions, statements
│   │   ├── payees.ts             # Payee CRUD
│   │   ├── transfers.ts          # Internal, external, money requests
│   │   ├── admin.ts              # Admin liquidity, users, reversals
│   │   └── notifications.ts      # Notification listing & read status
│   └── utils/
│       ├── crypto.ts             # PBKDF2 hashing, ID/token generation
│       ├── audit.ts              # Audit logging & notification helpers
│       └── helpers.ts            # Currency formatting, ID generators
│
├── frontend/                     # Frontend (React + Vite + Tailwind)
│   ├── src/
│   │   ├── App.tsx               # Router & protected routes
│   │   ├── main.tsx              # React entry point
│   │   ├── index.css             # Tailwind + CSS variables
│   │   ├── lib/
│   │   │   ├── api.ts            # API client
│   │   │   └── utils.ts          # Utility functions
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx    # Authentication state
│   │   ├── components/
│   │   │   ├── Layout.tsx        # App shell with navigation
│   │   │   └── ui/               # Shadcn UI components
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Register.tsx
│   │       ├── Dashboard.tsx
│   │       ├── Transfers.tsx
│   │       ├── Payees.tsx
│   │       ├── Activity.tsx
│   │       ├── Notifications.tsx
│   │       └── Admin.tsx
│   └── ...config files
│
├── wrangler.toml                 # Cloudflare Workers configuration
└── package.json                  # Backend dependencies
```

## Database Schema

| Table          | Purpose                                            |
|----------------|----------------------------------------------------|
| `users`        | User accounts with hashed passwords and roles      |
| `sessions`     | Cookie-based session tokens with expiry             |
| `accounts`     | Checking/savings accounts with integer balances     |
| `payees`       | User-saved payee references                         |
| `transactions` | All financial movements with status tracking        |
| `audit_log`    | Immutable log of all sensitive system actions        |
| `notifications`| Mock notification log for fund receipts              |

Balances are stored in **paise** (integer) to avoid floating-point errors. 100 paise = ₹1.

## API Endpoints

| Method | Path                              | Description                    |
|--------|-----------------------------------|--------------------------------|
| POST   | `/api/auth/register`              | Create account                 |
| POST   | `/api/auth/login`                 | Sign in                        |
| POST   | `/api/auth/logout`                | Sign out                       |
| GET    | `/api/auth/me`                    | Current user info              |
| GET    | `/api/accounts`                   | List user accounts             |
| PATCH  | `/api/accounts/:id`               | Rename account                 |
| GET    | `/api/accounts/:id/transactions`  | Transaction history            |
| GET    | `/api/accounts/:id/statement`     | Download text statement        |
| GET    | `/api/payees`                     | List payees                    |
| POST   | `/api/payees`                     | Add payee                      |
| PUT    | `/api/payees/:id`                 | Update payee                   |
| DELETE | `/api/payees/:id`                 | Remove payee                   |
| POST   | `/api/transfers/internal`         | Internal transfer              |
| POST   | `/api/transfers/external`         | External transfer to payee     |
| POST   | `/api/transfers/request`          | Request money from user        |
| GET    | `/api/notifications`              | List notifications             |
| GET    | `/api/notifications/unread-count` | Unread count                   |
| PATCH  | `/api/notifications/:id/read`     | Mark notification read         |
| POST   | `/api/notifications/read-all`     | Mark all read                  |
| GET    | `/api/admin/liquidity`            | Total system liquidity         |
| GET    | `/api/admin/users`                | All users (paginated)          |
| POST   | `/api/admin/users/:id/freeze`     | Freeze/unfreeze user           |
| GET    | `/api/admin/transactions`         | All transactions               |
| POST   | `/api/admin/transactions/:id/reverse` | Reverse transaction       |
| GET    | `/api/admin/audit-log`            | Full audit log                 |

## Deployment

The app is deployed as a **single Cloudflare Worker** that serves both the API and the React frontend.

**Live URL**: https://novapay.www5.workers.dev

### How It Works
- Static frontend assets (JS, CSS, HTML) are served via the Workers Assets binding
- API routes under `/api/*` are handled by the Hono backend
- Non-API, non-asset routes fall back to `index.html` for SPA client-side routing
- The `SESSION_SECRET` is stored as a Cloudflare secret (not in code)

### Deploy Commands

```bash
# Build the frontend
cd frontend && npm run build && cd ..

# Run database migrations (remote)
npx wrangler d1 execute novapay-db --remote --file=./src/db/schema.sql

# Deploy the worker
npx wrangler deploy
```

## Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- npm

### Install Dependencies

```bash
# Backend
npm install

# Frontend
cd frontend && npm install
```

### Initialize Local Database

```bash
npm run db:migrate
```

### Start Development Servers

```bash
# Terminal 1 - Backend (port 8787)
npm run dev

# Terminal 2 - Frontend (port 5173)
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

### Default Admin Setup

1. Register a new account via the UI
2. Promote to admin via D1 CLI:
   ```bash
   npx wrangler d1 execute novapay-db --local --command="UPDATE users SET role = 'admin' WHERE email = 'your@email.com';"
   ```

## Security Notes

- Passwords hashed with PBKDF2-SHA256 (100,000 iterations)
- Session tokens are cryptographically random (256-bit)
- HTTP-only, Secure, SameSite cookies prevent XSS/CSRF
- API keys and secrets are never exposed to the client
- All sensitive actions are recorded in the audit log
- `SESSION_SECRET` is set via `wrangler secret put` for production (never committed to code)
