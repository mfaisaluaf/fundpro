/**
 * Update Database: Add hierarchical categories and Treat workspace
 */

const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, 'money-manager.db')
const db = new Database(dbPath)

console.log('Updating database...\n')

// 1. Add Treat workspace
console.log('1. Adding Treat workspace...')
try {
  db.exec(`
    INSERT OR IGNORE INTO workspaces (id, name, description)
    VALUES (3, 'Treat', 'Office colleagues treat fund')
  `)
  console.log('   ✓ Treat workspace added')
} catch (e) {
  console.log('   → Treat workspace may already exist')
}

// 2. Add parent_id column to categories if not exists
console.log('\n2. Updating categories table...')
try {
  db.exec(`ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id)`)
  console.log('   ✓ Added parent_id column')
} catch (e) {
  console.log('   → parent_id column may already exist')
}

// 3. Clear existing categories and add new ones
console.log('\n3. Adding categories from Excel...')

// Delete existing categories (fresh start for Personal)
db.exec(`DELETE FROM categories WHERE workspace_id = 2 OR workspace_id IS NULL`)

// Office categories (workspace_id = 1)
const officeCategories = [
  { name: 'Utility Bills', type: 'expense' },
  { name: 'Friday Lunch', type: 'expense' },
  { name: 'Office Equipment', type: 'expense' },
  { name: 'Stationery Items', type: 'expense' },
  { name: 'Kitchen / Grocery', type: 'expense' },
  { name: 'Janitorial Items', type: 'expense' },
  { name: 'Repair & Maintenance', type: 'expense' },
  { name: 'Other Food Expense', type: 'expense' },
  { name: 'Late Hours Food', type: 'expense' },
  { name: 'Birthday Celebration', type: 'expense' },
  { name: 'Travelling Expense', type: 'expense' },
  { name: 'Fuel Expense', type: 'expense' },
  { name: 'Miscellaneous Expense', type: 'expense' },
  { name: 'CEO Personal Expense', type: 'expense' },
  { name: 'Petty Cash Reload', type: 'income' },
  { name: 'Reimbursement', type: 'income' }
]

// Insert office categories
const insertCat = db.prepare(`
  INSERT INTO categories (name, type, workspace_id, parent_id, is_active)
  VALUES (?, ?, ?, ?, 1)
`)

officeCategories.forEach(cat => {
  try {
    insertCat.run(cat.name, cat.type, 1, null)
  } catch (e) { }
})
console.log('   ✓ Office categories added')

// Personal Main Categories with Sub-categories
const personalCategories = {
  'Monthly Utility Expense': ['FESCO', 'WASA', 'Internet', 'Katchra', 'Netflix', 'Mobile Package', 'Gas Filling'],
  'Monthly Kids Educational Expense': ['School Fee', 'Tuition Fee', 'Nazra Fee', 'Riksha Fee'],
  'Medical Expense': ['Medicines', 'Dr. Checkup', 'Other'],
  'Healthy & Fitness': ['Dry Fruits', 'Herbal', 'Multivitamins', 'Gym Fee'],
  'Pet Food & Accessories': ['Cat Food', 'Accessories', 'Dr. Checkup', 'Medicines'],
  'Vehicle Maintenance': ['Bike Tuning & Repair', 'Car Tuning & Repair', 'Scooty & Cycles'],
  'Fuel Expenses': ['Bike Fuel', 'Car Fuel'],
  'Breakfast': ['Weekend Breakfast'],
  'Monthly Contribution': ['Mehfil/Milad', 'Society Fund'],
  'Monthly Pocket Money': ['Mehreen', 'Ami', 'Kids'],
  'Dairy Products': ['Milk', 'Dahi', 'Other'],
  'Fruits': ['Fruits'],
  'Vegetables': ['Vegetables'],
  'Outside Food': ['Weekend Food', 'Breakfast/Lunch/Dinner'],
  'Guest Food': ['Guest Food'],
  'Maid Expense': ['Monthly Fee'],
  'Home Repair & Renovation': ['Repair Expense', 'Renovation Expense'],
  'Annual Expense Provision': ['Insurance Installment', 'Property Tax Installment', 'Income Tax Installment', 'Qurbani Contribution', 'Tour Contribution', 'Zakat Installment'],
  'Loan Given': ['Mehreen', 'Office', 'Other'],
  'Loan Recovery': ['Mehreen', 'Office', 'Other'],
  'Credit Card Payments': ['Alfalah', 'Askari'],
  'Donations': ['Zakat', 'Sadqa'],
  'Shopping Expense': ['Shopping Expense'],
  'Other Expense': ['Other Expense'],
  'Other Food Expense': ['Other Food Expense'],
  'Grocery': ['Oil/Ghee', 'Tea', 'Daal', 'Rice', 'Cosmetical', 'Bakery', 'Eggs', 'Masalajat', 'Bread/Bun', 'Sugar', 'Noodles', 'Meda Besan Ata', 'Janitorial Items', 'Snacks/Biscuits', 'Meat', 'Drink', 'Frozen', 'Other']
}

// Income categories for Personal
const personalIncomeCategories = ['Salary', 'Business Income', 'Bank Profit', 'Loan Received', 'Other Income']

// Insert Personal main categories and sub-categories
Object.entries(personalCategories).forEach(([main, subs]) => {
  // Insert main category
  const result = db.prepare(`
    INSERT INTO categories (name, type, workspace_id, parent_id, is_active)
    VALUES (?, 'expense', 2, NULL, 1)
  `).run(main)

  const parentId = result.lastInsertRowid

  // Insert sub-categories
  subs.forEach(sub => {
    db.prepare(`
      INSERT INTO categories (name, type, workspace_id, parent_id, is_active)
      VALUES (?, 'expense', 2, ?, 1)
    `).run(sub, parentId)
  })
})

// Insert Personal income categories
personalIncomeCategories.forEach(cat => {
  db.prepare(`
    INSERT INTO categories (name, type, workspace_id, parent_id, is_active)
    VALUES (?, 'income', 2, NULL, 1)
  `).run(cat)
})

console.log('   ✓ Personal categories with sub-categories added')

// Treat workspace categories
const treatCategories = [
  { name: 'Birthday Contribution', type: 'income' },
  { name: 'Bet/Fine Contribution', type: 'income' },
  { name: 'Other Contribution', type: 'income' },
  { name: 'Team Treat', type: 'expense' },
  { name: 'Birthday Celebration', type: 'expense' },
  { name: 'Party Expense', type: 'expense' },
  { name: 'Other Expense', type: 'expense' }
]

treatCategories.forEach(cat => {
  try {
    insertCat.run(cat.name, cat.type, 3, null)
  } catch (e) { }
})
console.log('   ✓ Treat categories added')

// 4. Add payment_methods table if not exists
console.log('\n4. Adding payment methods...')
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      is_active INTEGER DEFAULT 1
    )
  `)

  const paymentMethods = ['Cash', 'Bank Transfer', 'Askari Credit Card', 'Alfalah Credit Card', 'Debit Card', 'Payable', 'Receivable']
  const insertPM = db.prepare('INSERT OR IGNORE INTO payment_methods (name, type) VALUES (?, ?)')
  paymentMethods.forEach(pm => insertPM.run(pm, 'general'))
  console.log('   ✓ Payment methods added')
} catch (e) {
  console.log('   → Payment methods may already exist')
}

// 5. Update funds - remove Treat Fund from Office (it's now separate workspace)
console.log('\n5. Updating funds...')
db.exec(`DELETE FROM funds WHERE name = 'Treat Fund'`)
console.log('   ✓ Removed Treat Fund from Office (now separate workspace)')

db.close()

console.log('\n========================================')
console.log('Database updated successfully!')
console.log('========================================')
console.log('\nWorkspaces: Office, Personal, Treat')
console.log('Categories: Hierarchical (Main → Sub)')
console.log('Payment Methods: 7 types')
