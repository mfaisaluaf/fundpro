/**
 * Migration v6: Add allowed_types to categories
 * Controls which transaction types each category can be used with
 * Derives defaults from existing 'type' column (expense, income, both, transfer)
 */
const db = require('./db')

console.log('Running migration v6: category allowed types...')

// Add allowed_types column
try {
  db.prepare('ALTER TABLE categories ADD COLUMN allowed_types TEXT').run()
  console.log('Added allowed_types column')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('Column already exists, skipping')
  } else {
    throw e
  }
}

// Set defaults based on existing type column
const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1').all()
for (const cat of categories) {
  let types
  switch (cat.type) {
    case 'income':
      types = 'income'
      break
    case 'expense':
      types = 'expense'
      break
    case 'both':
      types = 'income,expense'
      break
    case 'transfer':
      types = 'transfer'
      break
    default:
      types = 'expense'
  }
  db.prepare('UPDATE categories SET allowed_types = ? WHERE id = ?').run(types, cat.id)
  console.log(`  [${cat.workspace_id}] ${cat.name} (${cat.type}) → ${types}`)
}

console.log('\nMigration v6 complete!')
