-- SCHEMA UPDATE: Additional tables from Personal Expense Analysis
-- Phase 3.1

-- =============================================
-- TABLE 17: BUDGETS
-- Think of this as: Monthly spending limits per category
-- Example: Grocery budget = Rs 20,000/month
-- =============================================
CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,
    category_id INTEGER,             -- Which category
    period_type TEXT DEFAULT 'monthly', -- "monthly", "yearly", "weekly"
    amount REAL NOT NULL,            -- Budget limit
    start_date TEXT,                 -- When this budget starts
    end_date TEXT,                   -- When it ends (NULL = ongoing)
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- =============================================
-- TABLE 18: GROUP EXPENSES (Split expenses)
-- Think of this as: Shared expenses like parties, trips
-- Example: Mehfil event - who paid what, who owes whom
-- =============================================
CREATE TABLE IF NOT EXISTS group_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "Mehfil Dec 2025", "Office Trip"
    description TEXT,
    total_amount REAL NOT NULL,      -- Total expense
    date TEXT NOT NULL,
    status TEXT DEFAULT 'open',      -- "open", "settled", "partial"
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 19: GROUP EXPENSE ITEMS
-- Think of this as: Individual items in a group expense
-- Example: BBQ Rs 15,000 paid by Faisal
-- =============================================
CREATE TABLE IF NOT EXISTS group_expense_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_expense_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,         -- "BBQ", "Pool", "Drinks"
    amount REAL NOT NULL,
    paid_by_person_id INTEGER,       -- Who paid
    paid_by_name TEXT,               -- If not in people table
    notes TEXT,
    FOREIGN KEY (group_expense_id) REFERENCES group_expenses(id),
    FOREIGN KEY (paid_by_person_id) REFERENCES people(id)
);

-- =============================================
-- TABLE 20: GROUP EXPENSE SPLITS
-- Think of this as: Who owes how much in a group expense
-- Example: Each person's share and payment status
-- =============================================
CREATE TABLE IF NOT EXISTS group_expense_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_expense_id INTEGER NOT NULL,
    person_id INTEGER,
    person_name TEXT,                -- If not in people table
    share_amount REAL NOT NULL,      -- Their share
    paid_amount REAL DEFAULT 0,      -- How much they've paid
    status TEXT DEFAULT 'pending',   -- "pending", "partial", "settled"
    FOREIGN KEY (group_expense_id) REFERENCES group_expenses(id),
    FOREIGN KEY (person_id) REFERENCES people(id)
);

-- =============================================
-- TABLE 21: COMETI (Committee/Savings Circle)
-- Think of this as: Traditional rotating savings group
-- Common in Pakistan/India - monthly contribution, take turns getting the pool
-- =============================================
CREATE TABLE IF NOT EXISTS cometi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "Office Cometi", "Family Cometi"
    monthly_amount REAL NOT NULL,    -- Monthly contribution
    total_members INTEGER,           -- How many people
    duration_months INTEGER,         -- How many months
    start_date TEXT,
    your_turn_month INTEGER,         -- Which month you get the pool
    status TEXT DEFAULT 'active',    -- "active", "completed"
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 22: COMETI PAYMENTS
-- Think of this as: Monthly cometi payment tracking
-- =============================================
CREATE TABLE IF NOT EXISTS cometi_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cometi_id INTEGER NOT NULL,
    month_number INTEGER,            -- Month 1, 2, 3...
    payment_date TEXT,
    amount REAL NOT NULL,
    type TEXT,                       -- "contribution" or "received"
    status TEXT DEFAULT 'paid',      -- "paid", "pending", "received"
    notes TEXT,
    FOREIGN KEY (cometi_id) REFERENCES cometi(id)
);

-- =============================================
-- TABLE 23: SAVINGS LOCATIONS
-- Think of this as: Where your savings are kept
-- Different from bank accounts - these are savings pots
-- =============================================
CREATE TABLE IF NOT EXISTS savings_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "PF Savings", "Cometi Savings"
    type TEXT,                       -- "provident_fund", "cometi", "fixed_deposit", "cash", "investment"
    bank_account_id INTEGER,         -- If linked to a bank account
    current_amount REAL DEFAULT 0,
    owner TEXT,                      -- Whose savings
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

-- =============================================
-- TABLE 24: RECEIVABLES (Short-term)
-- Think of this as: Small amounts others owe you
-- Different from loans - these are casual/short-term
-- Example: Mehreen shopping Rs 10,000
-- =============================================
CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER,
    person_name TEXT,                -- If not in people table
    description TEXT NOT NULL,       -- "Shopping advance", "Lunch money"
    amount REAL NOT NULL,
    date_given TEXT NOT NULL,
    expected_date TEXT,              -- When expected back
    amount_received REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',   -- "pending", "partial", "received"
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id)
);

-- =============================================
-- INDEXES for new tables
-- =============================================
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_group_expense_items_group ON group_expense_items(group_expense_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
