const db = require('./db');

// List ALL office transactions in detail for cross-checking
const all = db.prepare(`
  SELECT t.id, t.date, t.type, t.amount, t.payment_method, t.description,
         c.name as category, p.name as person
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN people p ON t.person_id = p.id
  WHERE t.workspace_id = 1
  ORDER BY t.date, t.id
`).all();

console.log('ID  | DATE       | TYPE       | PAYMENT METHOD | CATEGORY                  | AMOUNT      | DESCRIPTION');
console.log('----+------------+------------+----------------+---------------------------+-------------+-----------------------------');
all.forEach(r => {
  const id = String(r.id).padEnd(4);
  const date = (r.date || '').padEnd(10);
  const type = (r.type || '').padEnd(10);
  const pm = (r.payment_method || 'transfer').padEnd(14);
  const cat = (r.category || '').padEnd(25);
  const amt = ('Rs ' + r.amount.toLocaleString()).padStart(11);
  const desc = r.description || '';
  console.log(`${id} | ${date} | ${type} | ${pm} | ${cat} | ${amt} | ${desc}`);
});

console.log('\n--- TOTALS BY TYPE ---');
const types = ['income', 'expense', 'settlement', 'transfer'];
types.forEach(t => {
  const total = all.filter(r=>r.type===t).reduce((s,r)=>s+r.amount,0);
  console.log(`${t.padEnd(12)}: Rs ${total.toLocaleString()}`);
});

console.log('\n--- EXPENSE BREAKDOWN BY PAYMENT METHOD ---');
const pmGroups = {};
all.filter(r=>r.type==='expense').forEach(r => {
  const pm = r.payment_method || 'unknown';
  pmGroups[pm] = (pmGroups[pm] || 0) + r.amount;
});
Object.entries(pmGroups).forEach(([pm, total]) => {
  console.log(`  ${pm.padEnd(20)}: Rs ${total.toLocaleString()}`);
});

// Excel figures
const excelCashOpening = 92100;
const excelBankOpening = 525620;
const excelTotalExpense = 854360;
const excelPaidByFaisal = 245115;
const excelReimbursements = 245115;
const excelCashEnd = 2325;
const excelBankEnd = 297455;

const appTotalIncome = all.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
const appTotalExpense = all.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
const appSettlements = all.filter(r=>r.type==='settlement').reduce((s,r)=>s+r.amount,0);
const appATM = all.filter(r=>r.type==='transfer').reduce((s,r)=>s+r.amount,0);

console.log('\n--- EXCEL vs APP COMPARISON ---');
console.log(`Excel Total Expense:       Rs ${excelTotalExpense.toLocaleString()}`);
console.log(`App Total Expense:         Rs ${appTotalExpense.toLocaleString()}`);
console.log(`Difference:                Rs ${(appTotalExpense - excelTotalExpense).toLocaleString()}`);
console.log('');
console.log(`Excel Reimbursements:      Rs ${excelReimbursements.toLocaleString()}`);
console.log(`App Settlements:           Rs ${appSettlements.toLocaleString()}`);
console.log(`Difference:                Rs ${(appSettlements - excelReimbursements).toLocaleString()}`);
console.log('');
console.log(`Excel Total Income implied: Rs ${(excelCashEnd + excelBankEnd + excelTotalExpense - excelCashOpening - excelBankOpening).toLocaleString()} (reverse calc)`);
console.log(`App Total Income:           Rs ${appTotalIncome.toLocaleString()}`);
console.log(`Difference:                 Rs ${(appTotalIncome - (excelCashEnd + excelBankEnd + excelTotalExpense - excelCashOpening - excelBankOpening)).toLocaleString()}`);
