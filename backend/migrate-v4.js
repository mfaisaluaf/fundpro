/**
 * Migration v4: Fund location tracking + fund-to-fund transfers
 *
 * - fund_transfers: Move money between funds (Salary → Annual Expense Provision)
 * - fund_reallocations: Move money within a fund between physical locations (Cash → BAHL Savings)
 *
 * Fund location breakdown is DERIVED from:
 *   1. Transactions (payment_method tells us Cash vs Bank)
 *   2. Fund reallocations (manual moves like Cash → Savings Account)
 *   3. Fund transfers (between funds, carries location context)
 */
const db = require('./db')

console.log('Running migration v4...')

// 1. Create fund_transfers table
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS fund_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      from_fund_id INTEGER NOT NULL,
      to_fund_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      location TEXT DEFAULT 'Bank',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (from_fund_id) REFERENCES funds(id),
      FOREIGN KEY (to_fund_id) REFERENCES funds(id)
    )
  `).run()
  console.log('  + Created fund_transfers table')
} catch (e) {
  console.log('  ! Error creating fund_transfers:', e.message)
}

// 2. Create fund_reallocations table (move money within same fund between locations)
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS fund_reallocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      fund_id INTEGER NOT NULL,
      from_location TEXT NOT NULL,
      to_location TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fund_id) REFERENCES funds(id)
    )
  `).run()
  console.log('  + Created fund_reallocations table')
} catch (e) {
  console.log('  ! Error creating fund_reallocations:', e.message)
}

console.log('Migration v4 complete!')
