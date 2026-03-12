/**
 * Clean up duplicate categories and restructure savings
 */
const db = require('./db')

// Find and remove duplicate Loan Given categories (keep the one with transactions or most recent)
const loanGivenCats = db.prepare(`
  SELECT c.*, COUNT(t.id) as txn_count
  FROM categories c
  LEFT JOIN transactions t ON t.category_id = c.id
  WHERE c.name = 'Loan Given'
  GROUP BY c.id
  ORDER BY txn_count DESC, c.id ASC
`).all()

console.log('Loan Given categories:', loanGivenCats)

if (loanGivenCats.length > 1) {
  // Keep the first one (has most transactions or oldest)
  const keepId = loanGivenCats[0].id
  console.log('Keeping Loan Given id:', keepId)

  // Deactivate others
  for (let i = 1; i < loanGivenCats.length; i++) {
    db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(loanGivenCats[i].id)
    console.log('Deactivated duplicate Loan Given id:', loanGivenCats[i].id)
  }
}

// Same for Loan Recovery
const loanRecoveryCats = db.prepare(`
  SELECT c.*, COUNT(t.id) as txn_count
  FROM categories c
  LEFT JOIN transactions t ON t.category_id = c.id
  WHERE c.name = 'Loan Recovery'
  GROUP BY c.id
  ORDER BY txn_count DESC, c.id ASC
`).all()

console.log('Loan Recovery categories:', loanRecoveryCats)

if (loanRecoveryCats.length > 1) {
  const keepId = loanRecoveryCats[0].id
  console.log('Keeping Loan Recovery id:', keepId)

  for (let i = 1; i < loanRecoveryCats.length; i++) {
    db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(loanRecoveryCats[i].id)
    console.log('Deactivated duplicate Loan Recovery id:', loanRecoveryCats[i].id)
  }
}

// Create Savings parent category for Personal workspace
const existingSavings = db.prepare(`
  SELECT * FROM categories WHERE name = 'Savings' AND workspace_id = 2 AND parent_id IS NULL
`).get()

let savingsParentId
if (!existingSavings) {
  const result = db.prepare(`
    INSERT INTO categories (name, type, workspace_id, icon, is_active)
    VALUES ('Savings', 'both', 2, '🏦', 1)
  `).run()
  savingsParentId = result.lastInsertRowid
  console.log('Created Savings parent category id:', savingsParentId)
} else {
  savingsParentId = existingSavings.id
  console.log('Savings parent already exists id:', savingsParentId)
}

// Update Savings Deposit and Withdrawal to be sub-categories
db.prepare(`
  UPDATE categories SET parent_id = ?, type = 'expense'
  WHERE name = 'Savings Deposit' AND workspace_id = 2 AND is_active = 1
`).run(savingsParentId)

db.prepare(`
  UPDATE categories SET parent_id = ?, type = 'income'
  WHERE name = 'Savings Withdrawal' AND workspace_id = 2 AND is_active = 1
`).run(savingsParentId)

console.log('Updated savings sub-categories')

// Create Loans parent category for Personal workspace
const existingLoans = db.prepare(`
  SELECT * FROM categories WHERE name = 'Loans' AND workspace_id = 2 AND parent_id IS NULL
`).get()

let loansParentId
if (!existingLoans) {
  const result = db.prepare(`
    INSERT INTO categories (name, type, workspace_id, icon, is_active)
    VALUES ('Loans', 'both', 2, '💸', 1)
  `).run()
  loansParentId = result.lastInsertRowid
  console.log('Created Loans parent category id:', loansParentId)
} else {
  loansParentId = existingLoans.id
  console.log('Loans parent already exists id:', loansParentId)
}

// Update Loan Given and Loan Recovery to be sub-categories
db.prepare(`
  UPDATE categories SET parent_id = ?
  WHERE name = 'Loan Given' AND workspace_id = 2 AND is_active = 1
`).run(loansParentId)

db.prepare(`
  UPDATE categories SET parent_id = ?
  WHERE name = 'Loan Recovery' AND workspace_id = 2 AND is_active = 1
`).run(loansParentId)

console.log('Updated loan sub-categories')

// Add Bank Profit category for tracking bank interest
const existingBankProfit = db.prepare(`
  SELECT * FROM categories WHERE name = 'Bank Profit' AND workspace_id = 2
`).get()

if (!existingBankProfit) {
  db.prepare(`
    INSERT INTO categories (name, type, workspace_id, icon, is_active)
    VALUES ('Bank Profit', 'income', 2, '🏦', 1)
  `).run()
  console.log('Created Bank Profit category')
} else {
  console.log('Bank Profit already exists')
}

// Verify final state
const allPersonalCats = db.prepare(`
  SELECT * FROM categories WHERE workspace_id = 2 AND is_active = 1 ORDER BY parent_id, name
`).all()
console.log('\nAll active Personal categories:', allPersonalCats.map(c => ({
  id: c.id,
  name: c.name,
  type: c.type,
  parent_id: c.parent_id
})))
