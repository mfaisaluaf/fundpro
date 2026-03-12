/**
 * Migration v5: Add allowed_types to payment_methods
 * Controls which transaction types each payment method can be used with
 * Format: comma-separated string e.g. "income,expense,transfer,settlement"
 */
const db = require('./db')

console.log('Running migration v5: payment method allowed types...')

// Add allowed_types column
try {
  db.prepare('ALTER TABLE payment_methods ADD COLUMN allowed_types TEXT').run()
  console.log('Added allowed_types column')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('Column already exists, skipping')
  } else {
    throw e
  }
}

// Set sensible defaults
const defaults = {
  'Cash': 'income,expense,settlement',
  'Bank Transfer': 'income,expense,settlement',
  'Debit Card': 'expense',
  'Payable': 'expense',
  'Receivable': 'expense',
  'Easypaisa': 'income,expense,settlement',
  'Jazcash': 'income,expense,settlement',
}

// Credit cards are expense-only
const methods = db.prepare('SELECT * FROM payment_methods').all()
for (const m of methods) {
  let types = defaults[m.name]
  if (!types) {
    // Credit cards
    if (m.name.includes('Credit Card')) {
      types = 'expense'
    } else {
      // Default: all types
      types = 'income,expense,settlement'
    }
  }
  db.prepare('UPDATE payment_methods SET allowed_types = ? WHERE id = ?').run(types, m.id)
  console.log(`  ${m.name} → ${types}`)
}

console.log('\nMigration v5 complete!')
