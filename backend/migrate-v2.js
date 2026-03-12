/**
 * Migration v2: Bank Profit sub-categories, quantity field, dashboard config
 */
const db = require('./db')

console.log('Running migration v2...')

// 1. Add quantity column to transactions (optional, for grocery tracking)
try {
  db.prepare('ALTER TABLE transactions ADD COLUMN quantity TEXT').run()
  console.log('  + Added quantity column to transactions')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('  ~ quantity column already exists')
  } else {
    console.log('  ! Error adding quantity:', e.message)
  }
}

// 2. Add Bank Profit sub-categories (Alfalah, Askari, etc.)
const bankProfitId = db.prepare("SELECT id FROM categories WHERE name = 'Bank Profit' AND workspace_id = 2").get()
if (bankProfitId) {
  const existing = db.prepare("SELECT name FROM categories WHERE parent_id = ? AND is_active = 1").all(bankProfitId.id)
  const existingNames = existing.map(c => c.name)

  const bankProfitSubs = ['Alfalah Profit', 'Askari Profit', 'Other Bank Profit']
  for (const name of bankProfitSubs) {
    if (!existingNames.includes(name)) {
      db.prepare("INSERT INTO categories (name, type, workspace_id, parent_id, is_active) VALUES (?, 'income', 2, ?, 1)")
        .run(name, bankProfitId.id)
      console.log(`  + Added Bank Profit sub-category: ${name}`)
    } else {
      console.log(`  ~ Bank Profit sub-category already exists: ${name}`)
    }
  }
} else {
  console.log('  ! Bank Profit category not found')
}

// 3. Add dashboard_cards setting if not exists
const dashSetting = db.prepare("SELECT * FROM settings WHERE key = 'dashboard_cards'").get()
if (!dashSetting) {
  const defaultCards = JSON.stringify({
    office: ['totalBalance', 'thisMonthExpense', 'payable', 'cashOnHand', 'fridayLunch', 'ceoExpense'],
    personal: ['totalBalance', 'thisMonthExpense', 'savings', 'loansGiven', 'creditCard', 'receivables', 'bankProfit'],
    treat: ['totalBalance', 'thisMonthExpense', 'totalCollected', 'thisMonthSpent', 'contributors']
  })
  db.prepare("INSERT INTO settings (key, value) VALUES ('dashboard_cards', ?)").run(defaultCards)
  console.log('  + Added dashboard_cards setting')
} else {
  console.log('  ~ dashboard_cards setting already exists')
}

console.log('Migration v2 complete!')
