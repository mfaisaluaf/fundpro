/**
 * Add Savings categories for Personal workspace
 */
const db = require('./db')

// Add Savings category (income type - money saved)
const savingsDeposit = db.prepare(`
  INSERT OR IGNORE INTO categories (name, type, workspace_id, icon, is_active)
  VALUES ('Savings Deposit', 'expense', 2, '🏦', 1)
`).run()

// Add Savings Withdrawal category (expense from savings)
const savingsWithdrawal = db.prepare(`
  INSERT OR IGNORE INTO categories (name, type, workspace_id, icon, is_active)
  VALUES ('Savings Withdrawal', 'income', 2, '💸', 1)
`).run()

console.log('Savings categories added successfully')

// Verify
const categories = db.prepare(`
  SELECT * FROM categories WHERE name LIKE '%Savings%'
`).all()
console.log('Savings categories:', categories)
