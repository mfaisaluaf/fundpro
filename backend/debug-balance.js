const db = require('./db');
const wid = 1; // office workspace

const balanceByMethod = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
    COALESCE(SUM(CASE WHEN type = 'settlement' THEN amount ELSE 0 END), 0) as total_settlement,
    COALESCE(SUM(CASE
      WHEN payment_method = 'Cash' AND type = 'income' THEN amount
      WHEN payment_method = 'Cash' AND type = 'expense' THEN -amount
      WHEN payment_method = 'Cash' AND type = 'settlement' THEN -amount
      ELSE 0
    END), 0) as cash_balance,
    COALESCE(SUM(CASE
      WHEN payment_method IN ('Bank Transfer', 'Debit Card') AND type = 'income' THEN amount
      WHEN payment_method IN ('Bank Transfer', 'Debit Card') AND type = 'expense' THEN -amount
      WHEN payment_method IN ('Bank Transfer', 'Debit Card') AND type = 'settlement' THEN -amount
      ELSE 0
    END), 0) as bank_balance,
    COALESCE(SUM(CASE WHEN payment_method = 'Payable' AND type = 'expense' THEN amount ELSE 0 END), 0) as payable_expenses,
    COALESCE(SUM(CASE WHEN payment_method LIKE '%Credit Card%' AND type = 'expense' THEN amount ELSE 0 END), 0) as credit_used
  FROM transactions WHERE workspace_id = ?
`).get(wid);

const ta = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN c.name LIKE 'Bank to Cash%' OR c.name = 'ATM Withdrawal' THEN t.amount ELSE 0 END), 0) as cash_adj,
    COALESCE(SUM(CASE WHEN c.name LIKE 'Bank to Cash%' OR c.name = 'ATM Withdrawal' THEN -t.amount ELSE 0 END), 0) as bank_adj
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.type = 'transfer' AND t.workspace_id = ?
`).get(wid);

const payables = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'Payable' THEN amount ELSE 0 END), 0) as total_payable_expense,
    COALESCE(SUM(CASE WHEN type = 'settlement' THEN amount ELSE 0 END), 0) as total_settled,
    COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'Payable' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'settlement' THEN amount ELSE 0 END), 0) as net_payable
  FROM transactions WHERE workspace_id = ?
`).get(wid);

// Cash expenses breakdown
const cashExpenses = db.prepare(`
  SELECT c.name as category, SUM(t.amount) as total
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.workspace_id = 1 AND t.type = 'expense' AND t.payment_method = 'Cash'
  GROUP BY c.name ORDER BY total DESC
`).all();

// Bank/Debit expenses breakdown
const bankExpenses = db.prepare(`
  SELECT c.name as category, t.payment_method, SUM(t.amount) as total
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.workspace_id = 1 AND t.type = 'expense' AND t.payment_method IN ('Bank Transfer', 'Debit Card')
  GROUP BY c.name, t.payment_method ORDER BY total DESC
`).all();

// Income breakdown
const income = db.prepare(`
  SELECT c.name as category, t.payment_method, SUM(t.amount) as total
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.workspace_id = 1 AND t.type = 'income'
  GROUP BY c.name, t.payment_method ORDER BY total DESC
`).all();

// Transfers
const transfers = db.prepare(`
  SELECT c.name as category, t.amount, t.date, t.notes
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.workspace_id = 1 AND t.type = 'transfer'
  ORDER BY t.date
`).all();

// Settlements
const settlements = db.prepare(`
  SELECT t.date, t.amount, t.payment_method, t.notes, p.name as person
  FROM transactions t
  LEFT JOIN people p ON t.person_id = p.id
  WHERE t.workspace_id = 1 AND t.type = 'settlement'
  ORDER BY t.date
`).all();

const finalCash = balanceByMethod.cash_balance + ta.cash_adj;
const finalBank = balanceByMethod.bank_balance + ta.bank_adj;

console.log('========================================');
console.log('   OFFICE WORKSPACE — BALANCE AUDIT');
console.log('========================================');

console.log('\n--- INCOME ---');
income.forEach(r => console.log(`  ${r.date || ''} | ${r.payment_method} | ${r.category} | Rs ${r.total.toLocaleString()}`));
console.log(`  TOTAL INCOME: Rs ${balanceByMethod.total_income.toLocaleString()}`);
console.log(`    > Goes to Bank: Rs ${income.filter(i=>i.payment_method==='Bank Transfer').reduce((s,i)=>s+i.total,0).toLocaleString()}`);
console.log(`    > Goes to Cash: Rs ${income.filter(i=>i.payment_method==='Cash').reduce((s,i)=>s+i.total,0).toLocaleString()}`);

console.log('\n--- CASH EXPENSES ---');
cashExpenses.forEach(r => console.log(`  ${r.category}: Rs ${r.total.toLocaleString()}`));
const totalCashExp = cashExpenses.reduce((s,r)=>s+r.total,0);
console.log(`  TOTAL CASH EXPENSE: Rs ${totalCashExp.toLocaleString()}`);

console.log('\n--- BANK/DEBIT EXPENSES ---');
bankExpenses.forEach(r => console.log(`  ${r.payment_method} | ${r.category}: Rs ${r.total.toLocaleString()}`));
const totalBankExp = bankExpenses.reduce((s,r)=>s+r.total,0);
console.log(`  TOTAL BANK/DEBIT EXPENSE: Rs ${totalBankExp.toLocaleString()}`);

console.log('\n--- PAYABLE EXPENSES (employee fronted, NOT deducted from cash/bank) ---');
console.log(`  Total Payable Expenses: Rs ${balanceByMethod.payable_expenses.toLocaleString()}`);

console.log('\n--- SETTLEMENTS (reimbursements paid out in cash) ---');
settlements.forEach(r => console.log(`  ${r.date} | ${r.payment_method} | Rs ${r.amount.toLocaleString()} | ${r.person || ''} | ${r.notes || ''}`));
console.log(`  TOTAL SETTLEMENTS: Rs ${balanceByMethod.total_settlement.toLocaleString()}`);

console.log('\n--- TRANSFERS (ATM / Bank to Cash) ---');
transfers.forEach(r => console.log(`  ${r.date} | ${r.category} | Rs ${r.amount.toLocaleString()} | ${r.notes || ''}`));
console.log(`  TOTAL TRANSFERS: Rs ${ta.cash_adj.toLocaleString()} (cash +, bank -)`);

console.log('\n========================================');
console.log('   FINAL BALANCE CALCULATION');
console.log('========================================');
console.log(`Cash from income:           +Rs ${income.filter(i=>i.payment_method==='Cash').reduce((s,i)=>s+i.total,0).toLocaleString()}`);
console.log(`Cash expenses:              -Rs ${totalCashExp.toLocaleString()}`);
console.log(`Cash settlements:           -Rs ${balanceByMethod.total_settlement.toLocaleString()}`);
console.log(`ATM/Bank-to-Cash transfers: +Rs ${ta.cash_adj.toLocaleString()}`);
console.log(`                           --------`);
console.log(`CASH BALANCE:               Rs ${finalCash.toLocaleString()}`);
console.log('');
console.log(`Bank from income:           +Rs ${income.filter(i=>i.payment_method==='Bank Transfer').reduce((s,i)=>s+i.total,0).toLocaleString()}`);
console.log(`Bank/Debit expenses:        -Rs ${totalBankExp.toLocaleString()}`);
console.log(`ATM/Bank-to-Cash transfers: -Rs ${ta.cash_adj.toLocaleString()}`);
console.log(`                           --------`);
console.log(`BANK BALANCE:               Rs ${finalBank.toLocaleString()}`);
console.log('');
console.log(`TOTAL BALANCE (Cash+Bank):  Rs ${(finalCash + finalBank).toLocaleString()}`);
console.log('');
console.log(`PAYABLE (outstanding):      Rs ${payables.net_payable.toLocaleString()}`);
console.log(`  (Total owed: ${payables.total_payable_expense.toLocaleString()} - Settled: ${payables.total_settled.toLocaleString()})`);
