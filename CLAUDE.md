# FundPro — Expense Manager (Claude Session Memory)

> This file is automatically read by Claude at the start of every session.
> It replaces lost chat history. Update the "Next Tasks" and "Session Log" sections after every session.

## MANDATORY SESSION RULES (Claude must follow without being asked)

1. **Auto-save session at end**: Before finishing any session, Claude MUST write a session log to `sessions/session-YYYY-MM-DD.md` covering everything done that day. Do not wait for user to ask.
2. **Update CLAUDE.md**: After saving session file, update the Session Logs table in this file and update "Current Status / Next Tasks".
3. **Auto-recover at start**: At the start of each session, read the latest session file in `sessions/` to recall prior context before doing any work.
4. **migrate-v7.js** is the latest migration — next one should be `migrate-v8.js`.

---

## Project Identity

- **App Name**: FundPro (previously Finzo)
- **Type**: Full-stack personal/office finance manager
- **Owner**: Faisal Ahmed (FA)
- **Currency**: Rs (Pakistani Rupees)
- **Date Format**: DD/MM/YYYY

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite (`frontend/`) |
| Backend | Node.js + Express (`backend/server.js`) |
| Database | SQLite via `better-sqlite3` (`database/money-manager.db`) |
| API Base | `http://localhost:3001/api` |
| Frontend Port | Vite default (5173) |

---

## Project Structure

```
expense-manager/
├── backend/
│   ├── server.js          ← Main Express API server
│   ├── db.js              ← SQLite connection
│   ├── migrate-v2.js      ← DB migrations (run sequentially)
│   ├── migrate-v3.js
│   ├── migrate-v4.js
│   ├── migrate-v5.js      ← Added allowed_types to payment_methods
│   ├── migrate-v6.js      ← Added allowed_types to categories
│   ├── fix-settlement.js  ← One-off fix: settlement category allowed_types
│   ├── reset-data.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 ← React Router setup
│   │   ├── main.jsx
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx      ← Sidebar + top header + workspace switcher
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       ← Main dashboard with cards, charts
│   │   │   ├── Transactions.jsx    ← Transaction list + filters
│   │   │   ├── CreditCards.jsx
│   │   │   ├── Budgets.jsx
│   │   │   ├── Loans.jsx
│   │   │   ├── Savings.jsx
│   │   │   ├── Funds.jsx
│   │   │   ├── Investments.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Receivables.jsx
│   │   │   ├── GroupExpenses.jsx
│   │   │   └── Admin.jsx           ← Admin panel (categories, people, payment methods, settings)
│   │   ├── components/
│   │   │   ├── AddTransactionModal.jsx   ← Add new transaction modal
│   │   │   ├── EditTransactionModal.jsx  ← Edit existing transaction
│   │   │   ├── DetailModal.jsx           ← View transaction details
│   │   │   └── PasswordConfirmModal.jsx  ← Password confirmation for delete
│   │   └── services/
│   │       └── api.js              ← All fetch calls to backend
│   └── package.json
├── database/
│   ├── schema.sql          ← Original schema
│   ├── schema-update.sql   ← Schema updates
│   ├── money-manager.db    ← SQLite database file
│   └── init-db.js
└── CLAUDE.md               ← THIS FILE
```

---

## Workspaces

The app has 3 workspaces (hardcoded IDs):

| ID | Key | Label | Purpose |
|---|---|---|---|
| 1 | `office` | 🏢 Office | Company/work expenses, payables, receivables |
| 2 | `personal` | 👤 Personal | Home finances, savings, loans, budgets |
| 3 | `treat` | 🎉 Treat | Group treat/outing fund (contributions + expenses) |

Workspace is passed via React Router `useOutletContext()` as `{ workspace }`.

---

## Database Tables

| Table | Purpose |
|---|---|
| `workspaces` | 3 workspaces (office, personal, treat) |
| `categories` | Expense/income categories per workspace. Has `parent_id` for sub-categories, `allowed_types` (CSV) for filtering |
| `transactions` | Main ledger: every income/expense/settlement/transfer |
| `people` | People (employees, vendors, family, friends) |
| `payment_methods` | Cash, Bank Transfer, Credit Cards, Payable, etc. Has `allowed_types` (CSV) |
| `funds` | Savings funds (personal workspace: Salary, etc.) |
| `fund_transfers` | Transfers between funds |
| `fund_reallocations` | Internal fund location changes (Bank ↔ Cash) |
| `bank_accounts` | Bank accounts (defined, not fully used in UI yet) |
| `credit_cards` | Credit card definitions |
| `settings` | Key/value app settings (currency, date_format, admin_password) |
| `tags` | Transaction tags (defined, not heavily used in UI) |
| `investments` | Investments tracking |
| `loans_obtained` / `loans_given` | Loan tracking |

---

## Key Business Logic

### Balance Calculation (Office/Personal)
- Cash balance = cash income − cash expense − cash settlements + transfer adjustments
- Bank balance = bank income − bank expense − bank settlements + transfer adjustments
- Total Balance = Cash + Bank (liquid money only)
- Credit card expenses do NOT reduce cash/bank balance (they're a separate liability)
- Payable expenses do NOT reduce cash/bank (employee paid, company owes)
- Settlements reduce cash/bank (paying off Payable liability)

### Transaction Types
- `income` — money received
- `expense` — money spent
- `settlement` — reimbursement (paying off a Payable)
- `transfer` — internal movement (ATM withdrawal, fund transfer, etc.)

### allowed_types System (added in v5/v6)
- Both `categories` and `payment_methods` tables have an `allowed_types` TEXT column
- Format: comma-separated e.g. `"income,expense"` or `"settlement"` or `"income,expense,settlement"`
- Used to filter dropdowns in AddTransactionModal based on selected transaction type
- Admin panel has inline checkbox toggles to manage allowed_types per category/method

### Payment Methods Special Behavior
- `Payable` — office only, hidden for personal workspace
- `Receivable` — requires person selection
- Credit Card methods — expense only, tracked separately for outstanding balance
- When `Payable` or `Receivable` is selected → person field becomes required

### Personal Workspace — Fund System
- Money is tracked across named "funds" (e.g. Salary, Emergency)
- Each fund has locations: Bank, Cash
- Transfers between funds: `fund_transfers` table
- Location changes (ATM, deposit): `fund_reallocations` table
- AddTransactionModal shows Fund Transfer UI instead of regular category form for personal transfers

---

## API Endpoints (backend/server.js)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard/:workspace` | Dashboard data |
| GET/POST | `/api/transactions` | List / add transactions |
| GET/PUT/DELETE | `/api/transactions/:id` | Get / edit / delete transaction |
| GET | `/api/transactions/by-category/:name` | Transactions by category |
| GET/POST | `/api/categories` | List / add categories |
| PUT/DELETE | `/api/categories/:id` | Edit / delete category |
| GET/POST | `/api/people` | List / add people |
| PUT/DELETE | `/api/people/:id` | Edit / delete person |
| GET/POST | `/api/payment-methods` | List / add payment methods |
| PUT/DELETE | `/api/payment-methods/:id` | Edit / delete payment method |
| GET/POST | `/api/funds` | List / add funds |
| PUT/DELETE | `/api/funds/:id` | Edit / delete fund |
| GET | `/api/funds-with-locations` | Funds + location breakdown |
| POST | `/api/fund-transfers` | Create fund transfer |
| GET | `/api/fund-transfers` | List fund transfers |
| POST | `/api/fund-reallocations` | Create fund reallocation |
| GET | `/api/fund-reallocations` | List fund reallocations |
| GET/PUT | `/api/dashboard-config` | Dashboard card visibility/order config |
| GET/PUT | `/api/settings/:key` | App settings |
| GET/POST | `/api/quantity-units` | Units (kg, pcs, etc.) |
| PUT/DELETE | `/api/quantity-units/:id` | Edit / delete unit |

---

## Dashboard Features

- **Cards**: configurable per workspace (show/hide, drag to reorder)
- **System cards**: totalBalance, thisMonthExpense, payable, receivables, cashOnHand, creditCard, savingsFunds, etc.
- **Category cards**: any parent category can be shown as a card (key format: `cat:CategoryName`)
- **Charts**: Bar chart (monthly expenses), Pie chart (by category)
- **Recent transactions** list with detail modal on click

---

## Admin Panel Features (Admin.jsx)

Tabs (workspace-aware):
1. **Categories** — hierarchical (parent/sub), inline allowed_types checkboxes (Income/Expense/Transfer/Settlement)
2. **People** — employee/vendor/family/friend/other
3. **Payment Methods** — inline allowed_types checkboxes (Income/Expense/Settlement)
4. **Savings Funds** — personal only, overview + history
5. **Quantity Units** — personal/treat, for grocery tracking
6. **Settings** — dashboard card toggles, currency, date format, admin password

---

## AddTransactionModal Features

- **Type buttons**: Expense / Income / Reimburse (office only) / Transfer
- **Category filtering**: filtered by `allowed_types` matching selected type
- **Payment method filtering**: filtered by `allowed_types` + hide Payable for personal
- **Personal Transfer**: special UI for Fund Transfer / ATM Withdrawal / Cash to Bank / Any Other
- **Fund selector**: personal workspace income/expense (not credit card/receivable)
- **Person field**: auto-shown for Payable, Receivable, Settlement, Treat income, Loan categories, Pocket Money
- **Quantity field**: shown for Grocery / Dairy / Fruits / Vegetables categories
- **Password confirm**: required for delete actions

---

## Session Logs (Full Correspondence)

All conversations are saved in `sessions/` folder. Read them for full history:

| File | Date | Summary |
|---|---|---|
| [sessions/session-2026-02-19.md](sessions/session-2026-02-19.md) | 2026-02-19 | Reconnected after lost session. Built allowed_types system recap. Created CLAUDE.md + session logs. |
| [sessions/session-2026-02-27.md](sessions/session-2026-02-27.md) | 2026-02-27 | Bug fixes: phantom Bank balance, stale fundsLocations, Loan Given in Income, workspace persistence. Features: modal draggable, no outside-click close, Via column, Fund Transfer Cash/Bank selector, Salary vs Savings separation (is_primary). Renamed app to FundPro. |
| [sessions/session-2026-03-11.md](sessions/session-2026-03-11.md) | 2026-03-11 | Balance reconciliation (Rs 90k ATM fix). Friday Lunch Budget card with carry-forward. Month-by-month history modal. Fixed charts (real 6-month data). Card UX improvements. |

> Every new session: Claude must AUTOMATICALLY save conversation to `sessions/session-YYYY-MM-DD.md` without waiting for user to ask.

---

## Session Log (Summary)

### Session ~1 (earliest)
- Set up full project: Express backend, React frontend, SQLite DB
- Created schema with all 16 tables
- Built MainLayout with sidebar, workspace switcher, localStorage persistence
- Built Dashboard page with cards, charts, recent transactions
- Built Transactions page with filters, add/edit/delete

### Session ~2
- Added credit card tracking (CreditCards page)
- Added Loans page
- Added Savings page
- Added Budgets page
- Added Reports page
- Added Admin panel (categories, people, payment methods)
- Added AddTransactionModal with workspace-aware fields
- Added EditTransactionModal, DetailModal, PasswordConfirmModal
- Added Funds page (personal savings funds)
- Added fund transfer / reallocation system
- Added Receivables, GroupExpenses pages
- Added quantity units for grocery tracking
- Added admin password protection for deletes
- Added dashboard config (show/hide cards, drag to reorder)
- Added dynamic category cards on dashboard

### Session ~3 (most recent — Feb 2026)
**Theme: allowed_types filtering system**
- `migrate-v5.js` — Added `allowed_types` column to `payment_methods` table
- `migrate-v6.js` — Added `allowed_types` column to `categories` table
- `fix-settlement.js` — Patched settlement categories to have `allowed_types = 'settlement'`
- `Admin.jsx` — Added inline checkbox toggles for allowed_types on categories AND payment methods (auto-save on toggle)
- `AddTransactionModal.jsx` — Now filters categories and payment methods by `allowed_types` when user selects transaction type

---

## Current Status / Next Tasks

- [ ] Find and fix Rs 60 expense discrepancy (one cash expense is Rs 60 higher than actual receipt)
- [ ] Test allowed_types filtering end-to-end
- [ ] Check if Reports, Investments, Receivables, GroupExpenses pages are fully implemented or need work

**Last session: 2026-03-11** — Friday Lunch Budget card + history modal built. Charts fixed to show real 6-month data. Balance reconciliation completed. See sessions/session-2026-03-11.md for full details.

---

## How to Run

```bash
# Backend
cd backend && node server.js
# or: npm start (port 3001)

# Frontend
cd frontend && npm run dev
# (port 5173)

# Run DB migrations if needed (in order)
cd backend
node migrate-v2.js
node migrate-v3.js
node migrate-v4.js
node migrate-v5.js
node migrate-v6.js
node fix-settlement.js
```

---

## Coding Conventions

- Frontend uses **named exports** from `services/api.js` for all API calls
- Workspace passed via `useOutletContext()` — always destructure as `const { workspace } = useOutletContext()`
- Workspace ID mapping: `{ office: 1, personal: 2, treat: 3 }`
- Currency format: `'Rs ' + (num || 0).toLocaleString()`
- Dates stored as `TEXT` in `YYYY-MM-DD` format
- Error handling: `setError(err.message)` pattern used throughout
- Success messages: `showSuccess('...')` with 2 second auto-clear
