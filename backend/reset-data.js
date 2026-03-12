const db = require('./db')

// Clear all transactions
db.prepare('DELETE FROM transactions').run()
console.log('Cleared transactions')

// Clear fund transfers and reallocations
db.prepare('DELETE FROM fund_transfers').run()
console.log('Cleared fund_transfers')

db.prepare('DELETE FROM fund_reallocations').run()
console.log('Cleared fund_reallocations')

// Clear fund contributions
db.prepare('DELETE FROM fund_contributions').run()
console.log('Cleared fund_contributions')

// Reset all fund balances to 0
db.prepare('UPDATE funds SET current_balance = 0').run()
console.log('Reset fund balances to 0')

// Reset bank account balances
db.prepare('UPDATE bank_accounts SET current_balance = opening_balance').run()
console.log('Reset bank accounts')

// Reset credit card used
db.prepare('UPDATE credit_cards SET current_used = 0').run()
console.log('Reset credit cards')

console.log('\nDone! All transaction data cleared. Setup data preserved.')
