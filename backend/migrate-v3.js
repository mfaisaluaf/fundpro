/**
 * Migration v3: Quantity units table, savings funds for personal workspace
 */
const db = require('./db')

console.log('Running migration v3...')

// 1. Create quantity_units table
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS quantity_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    )
  `).run()
  console.log('  + Created quantity_units table')
} catch (e) {
  console.log('  ! Error creating quantity_units:', e.message)
}

// 2. Add default quantity units
const defaultUnits = [
  { name: 'Pieces', abbreviation: 'pcs', sort_order: 1 },
  { name: 'Kilogram', abbreviation: 'kg', sort_order: 2 },
  { name: 'Gram', abbreviation: 'g', sort_order: 3 },
  { name: 'Dozen', abbreviation: 'dozen', sort_order: 4 },
  { name: 'Litre', abbreviation: 'litre', sort_order: 5 },
  { name: 'Pack', abbreviation: 'pack', sort_order: 6 },
  { name: 'Box', abbreviation: 'box', sort_order: 7 },
  { name: 'Bottle', abbreviation: 'bottle', sort_order: 8 }
]

const existingUnits = db.prepare('SELECT abbreviation FROM quantity_units').all()
const existingAbbrevs = existingUnits.map(u => u.abbreviation)

for (const unit of defaultUnits) {
  if (!existingAbbrevs.includes(unit.abbreviation)) {
    db.prepare('INSERT INTO quantity_units (name, abbreviation, sort_order) VALUES (?, ?, ?)')
      .run(unit.name, unit.abbreviation, unit.sort_order)
    console.log(`  + Added unit: ${unit.name} (${unit.abbreviation})`)
  } else {
    console.log(`  ~ Unit already exists: ${unit.abbreviation}`)
  }
}

// 3. Add quantity_unit column to transactions (stores abbreviation)
try {
  db.prepare('ALTER TABLE transactions ADD COLUMN quantity_unit TEXT DEFAULT NULL').run()
  console.log('  + Added quantity_unit column to transactions')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('  ~ quantity_unit column already exists')
  } else {
    console.log('  ! Error adding quantity_unit:', e.message)
  }
}

// 4. Create default savings funds for personal workspace (workspace_id = 2)
const personalFunds = [
  { name: 'Salary', description: 'Monthly salary and surplus savings' },
  { name: 'Bank Profit', description: 'Interest/profit from bank accounts' },
  { name: 'Business Profit', description: 'Profits from business activities' },
  { name: 'Annual Expense Provision', description: 'Set aside for annual expenses' },
  { name: 'Investment Profit', description: 'Returns from investments' }
]

const existingFunds = db.prepare('SELECT name FROM funds WHERE workspace_id = 2').all()
const existingFundNames = existingFunds.map(f => f.name)

for (const fund of personalFunds) {
  if (!existingFundNames.includes(fund.name)) {
    db.prepare('INSERT INTO funds (workspace_id, name, description, opening_balance, current_balance) VALUES (2, ?, ?, 0, 0)')
      .run(fund.name, fund.description)
    console.log(`  + Added personal fund: ${fund.name}`)
  } else {
    console.log(`  ~ Personal fund already exists: ${fund.name}`)
  }
}

console.log('Migration v3 complete!')
