/**
 * Add Loan categories for Personal workspace
 */
const db = require('./db')

// Add Loan Given category (expense type - money going out)
const loanGiven = db.prepare(`
  INSERT OR IGNORE INTO categories (name, type, workspace_id, icon, is_active)
  VALUES ('Loan Given', 'expense', 2, '💸', 1)
`).run()

// Add Loan Recovery category (income type - money coming back)
const loanRecovery = db.prepare(`
  INSERT OR IGNORE INTO categories (name, type, workspace_id, icon, is_active)
  VALUES ('Loan Recovery', 'income', 2, '💰', 1)
`).run()

console.log('Loan categories added successfully')

// Verify
const categories = db.prepare(`
  SELECT * FROM categories WHERE name LIKE '%Loan%'
`).all()
console.log('Loan categories:', categories)
