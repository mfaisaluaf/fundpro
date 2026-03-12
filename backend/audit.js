const db = require('./db')

const bal = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as total_income,
    COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as total_expense,
    COALESCE(SUM(CASE
      WHEN payment_method='Cash' AND type='income' THEN amount
      WHEN payment_method='Cash' AND type='expense' THEN -amount
      WHEN payment_method='Cash' AND type='settlement' THEN -amount
      ELSE 0 END),0) as cash_balance,
    COALESCE(SUM(CASE
      WHEN payment_method IN ('Bank Transfer','Debit Card') AND type='income' THEN amount
      WHEN payment_method IN ('Bank Transfer','Debit Card') AND type='expense' THEN -amount
      WHEN payment_method IN ('Bank Transfer','Debit Card') AND type='settlement' THEN -amount
      ELSE 0 END),0) as bank_balance
  FROM transactions WHERE workspace_id=1
`).get()

const adj = db.prepare(`
  SELECT
    COALESCE(SUM(CASE
      WHEN c.name IN ('ATM Withdrawal','Bank to Cash') OR c.name LIKE 'Bank to Cash%' THEN t.amount
      WHEN c.name='Cash to Bank' THEN -t.amount ELSE 0 END),0) as cash_adj,
    COALESCE(SUM(CASE
      WHEN c.name IN ('ATM Withdrawal','Bank to Cash') OR c.name LIKE 'Bank to Cash%' THEN -t.amount
      WHEN c.name='Cash to Bank' THEN t.amount ELSE 0 END),0) as bank_adj
  FROM transactions t
  JOIN categories c ON t.category_id=c.id
  WHERE t.type='transfer' AND t.workspace_id=1
`).get()

console.log('Income:    Rs', bal.total_income.toLocaleString())
console.log('Expense:   Rs', bal.total_expense.toLocaleString())
console.log('Cash raw:  Rs', bal.cash_balance.toLocaleString())
console.log('Bank raw:  Rs', bal.bank_balance.toLocaleString())
console.log('Cash adj:  Rs', adj.cash_adj.toLocaleString(), '(ATM withdrawals)')
console.log('Bank adj:  Rs', adj.bank_adj.toLocaleString())
console.log('---')
console.log('Cash:      Rs', (bal.cash_balance + adj.cash_adj).toLocaleString())
console.log('Bank:      Rs', (bal.bank_balance + adj.bank_adj).toLocaleString())
console.log('Total:     Rs', (bal.cash_balance + adj.cash_adj + bal.bank_balance + adj.bank_adj).toLocaleString())

// All transfers with their category
const transfers = db.prepare(`
  SELECT t.id, t.date, t.description, t.amount, c.name as cat
  FROM transactions t
  LEFT JOIN categories c ON t.category_id=c.id
  WHERE t.type='transfer' AND t.workspace_id=1
  ORDER BY t.date
`).all()

console.log('\nAll transfers:')
transfers.forEach(r => console.log(' ', r.date, String(r.amount).padStart(8), (r.cat || '(NO CATEGORY)').padEnd(35), r.description))
