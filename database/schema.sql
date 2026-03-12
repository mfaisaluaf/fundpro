-- MONEY MANAGER DATABASE SCHEMA
-- Created: Phase 3
-- Purpose: Complete personal finance management

-- =============================================
-- TABLE 1: WORKSPACES
-- Think of this as: Different "accounts" or "books"
-- Example: Office expenses, Home expenses, Business
-- =============================================
CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "Office", "Home", "Business"
    description TEXT,                -- Optional details
    is_active INTEGER DEFAULT 1,     -- 1 = active, 0 = hidden
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 2: CATEGORIES
-- Think of this as: Labels for types of income/expense
-- Example: Salary, Friday Lunch, Utility Bills, Groceries
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,            -- Which workspace this belongs to (NULL = global)
    name TEXT NOT NULL,              -- "Friday Lunch", "Utility Bills"
    type TEXT NOT NULL,              -- "income", "expense", "both"
    icon TEXT,                       -- Optional emoji or icon name
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- =============================================
-- TABLE 3: PEOPLE
-- Think of this as: Contact list of people involved
-- Example: Colleagues, family, friends, vendors
-- =============================================
CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "Faisal", "Arshaman", "Usman"
    type TEXT,                       -- "colleague", "family", "friend", "vendor", "other"
    phone TEXT,                      -- Optional contact
    notes TEXT,                      -- Any extra info
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 4: BANK ACCOUNTS
-- Think of this as: Your bank accounts list
-- Example: HBL Savings, Meezan Current, Cash in hand
-- =============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "HBL Savings", "Cash"
    bank_name TEXT,                  -- "HBL", "Meezan", "Cash"
    account_number TEXT,             -- Optional
    account_type TEXT,               -- "savings", "current", "cash", "wallet"
    opening_balance REAL DEFAULT 0,  -- Starting amount
    current_balance REAL DEFAULT 0,  -- Auto-calculated
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 5: CREDIT CARDS
-- Think of this as: Your credit cards list
-- Tracks: Limit, usage, billing dates
-- =============================================
CREATE TABLE IF NOT EXISTS credit_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "HBL Red", "UBL Gold"
    bank_name TEXT,                  -- "HBL", "UBL"
    card_number_last4 TEXT,          -- Last 4 digits only (security)
    credit_limit REAL NOT NULL,      -- Maximum limit
    current_used REAL DEFAULT 0,     -- How much spent (auto-calculated)
    billing_date INTEGER,            -- Day of month (1-31)
    due_date INTEGER,                -- Day of month for payment
    min_payment_percent REAL,        -- Minimum payment % (e.g., 5%)
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 6: FUNDS
-- Think of this as: Special money pools
-- Example: Petty Cash, Treat Fund, CEO Account
-- =============================================
CREATE TABLE IF NOT EXISTS funds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,            -- Which workspace
    name TEXT NOT NULL,              -- "Petty Cash", "Treat Fund"
    description TEXT,                -- What is this fund for
    opening_balance REAL DEFAULT 0,  -- Starting amount
    current_balance REAL DEFAULT 0,  -- Auto-calculated
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- =============================================
-- TABLE 7: TAGS
-- Think of this as: Extra labels you can add to anything
-- Example: "urgent", "reimbursable", "tax-deductible"
-- =============================================
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,       -- "urgent", "reimbursable"
    color TEXT,                      -- Optional color code
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 8: TRANSACTIONS (MAIN TABLE)
-- Think of this as: Every money movement recorded
-- This is your main register - like your Excel sheet
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- WHEN
    date TEXT NOT NULL,              -- Transaction date

    -- WHAT TYPE
    type TEXT NOT NULL,              -- "income", "expense", "transfer"

    -- WHERE (which workspace/fund)
    workspace_id INTEGER,
    fund_id INTEGER,                 -- If from a specific fund

    -- WHAT
    category_id INTEGER,
    description TEXT,                -- Details of transaction

    -- HOW MUCH
    amount REAL NOT NULL,

    -- HOW PAID
    payment_method TEXT,             -- "cash", "bank", "credit_card"
    bank_account_id INTEGER,         -- If paid from bank
    credit_card_id INTEGER,          -- If paid by credit card
    purchase_mode TEXT,              -- "physical", "online"

    -- WHO
    person_id INTEGER,               -- Related person (paid by/for)

    -- EXTRA
    reference_number TEXT,           -- Voucher no, receipt no
    notes TEXT,                      -- Any extra notes

    -- SYSTEM
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (fund_id) REFERENCES funds(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
    FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id),
    FOREIGN KEY (person_id) REFERENCES people(id)
);

-- =============================================
-- TABLE 9: TRANSACTION TAGS (Link table)
-- Think of this as: Connecting tags to transactions
-- One transaction can have multiple tags
-- =============================================
CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (transaction_id, tag_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- =============================================
-- TABLE 10: FUND CONTRIBUTIONS
-- Think of this as: Money going INTO funds
-- Example: Arshaman contributed Rs 2000 to Treat Fund
-- =============================================
CREATE TABLE IF NOT EXISTS fund_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    person_id INTEGER,               -- Who contributed
    reason TEXT,                     -- "Birthday contribution", "Lost bet"
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fund_id) REFERENCES funds(id),
    FOREIGN KEY (person_id) REFERENCES people(id)
);

-- =============================================
-- TABLE 11: INVESTMENTS
-- Think of this as: Where your money is growing
-- Example: Stocks, Mutual Funds, Property, Gold
-- =============================================
CREATE TABLE IF NOT EXISTS investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "PSX Stocks", "Meezan Fund"
    type TEXT NOT NULL,              -- "stocks", "mutual_fund", "property", "gold", "crypto", "fixed_deposit"
    platform TEXT,                   -- "AKD Securities", "Bank", etc.

    invested_amount REAL NOT NULL,   -- Total money put in
    current_value REAL,              -- Current worth (update manually or auto)

    purchase_date TEXT,
    maturity_date TEXT,              -- For FD, bonds
    interest_rate REAL,              -- For FD

    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 12: LOANS OBTAINED
-- Think of this as: Money YOU borrowed
-- Example: Bank loan, personal loan from friend
-- =============================================
CREATE TABLE IF NOT EXISTS loans_obtained (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "Car Loan", "Home Loan"
    lender TEXT NOT NULL,            -- "HBL", "Friend Name"
    lender_type TEXT,                -- "bank", "person", "company"

    principal_amount REAL NOT NULL,  -- Original loan amount
    interest_rate REAL,              -- Annual interest %

    loan_date TEXT NOT NULL,         -- When taken
    tenure_months INTEGER,           -- Loan period

    emi_amount REAL,                 -- Monthly payment
    emi_date INTEGER,                -- Day of month

    total_paid REAL DEFAULT 0,       -- Auto-calculated
    remaining_amount REAL,           -- Auto-calculated

    status TEXT DEFAULT 'active',    -- "active", "closed"
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE 13: LOANS GIVEN
-- Think of this as: Money YOU lent to others
-- Example: Lent Rs 10,000 to friend
-- =============================================
CREATE TABLE IF NOT EXISTS loans_given (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borrower_id INTEGER,             -- Person who borrowed
    borrower_name TEXT,              -- If not in people table

    amount REAL NOT NULL,            -- How much lent
    date_given TEXT NOT NULL,        -- When given
    expected_return_date TEXT,       -- When expected back

    amount_returned REAL DEFAULT 0,  -- How much received back
    status TEXT DEFAULT 'pending',   -- "pending", "partial", "returned", "written_off"

    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES people(id)
);

-- =============================================
-- TABLE 14: LOAN PAYMENTS
-- Think of this as: EMI payments or loan repayments
-- Tracks every payment made
-- =============================================
CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_type TEXT NOT NULL,         -- "obtained" or "given"
    loan_id INTEGER NOT NULL,        -- Which loan

    date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    bank_account_id INTEGER,

    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

-- =============================================
-- TABLE 15: SAVINGS GOALS
-- Think of this as: Targets you're saving for
-- Example: Emergency fund, Car, Vacation
-- =============================================
CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- "Emergency Fund", "New Car"
    target_amount REAL NOT NULL,     -- How much you want
    current_amount REAL DEFAULT 0,   -- How much saved
    deadline TEXT,                   -- Target date

    linked_account_id INTEGER,       -- Which bank account
    notes TEXT,
    status TEXT DEFAULT 'active',    -- "active", "achieved", "cancelled"
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_account_id) REFERENCES bank_accounts(id)
);

-- =============================================
-- TABLE 16: SETTINGS
-- Think of this as: App configuration storage
-- Stores all your preferences
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,            -- Setting name
    value TEXT,                      -- Setting value
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES (Make searches faster)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_fund_contributions_fund ON fund_contributions(fund_id);
