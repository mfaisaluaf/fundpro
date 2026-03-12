/**
 * Migration v7: Add is_primary flag to funds table
 * Marks the Salary fund as the primary bucket (not a savings fund).
 * This separates the "Salary Bucket" from dedicated savings funds on the dashboard.
 */

const db = require('./db')

console.log('Running migration v7: Add is_primary to funds...')

// Add is_primary column
try {
  db.prepare(`ALTER TABLE funds ADD COLUMN is_primary INTEGER DEFAULT 0`).run()
  console.log('✓ Added is_primary column to funds')
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('  is_primary column already exists, skipping')
  } else {
    throw e
  }
}

// Mark Salary fund as primary
const result = db.prepare(`UPDATE funds SET is_primary = 1 WHERE LOWER(name) = 'salary'`).run()
console.log(`✓ Marked ${result.changes} fund(s) as primary (Salary)`)

console.log('Migration v7 complete.')
