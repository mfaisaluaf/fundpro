const db = require('./db');

const incomeList = db.prepare(`
  SELECT t.date, t.amount, t.payment_method, c.name as category, t.description
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.workspace_id = 1 AND t.type = 'income'
  ORDER BY t.date
`).all();
console.log('=== ALL INCOME TRANSACTIONS ===');
incomeList.forEach(r => console.log(r.date, '|', r.payment_method, '| Rs', r.amount.toLocaleString(), '|', r.description || ''));
console.log('Total Cash Income:', incomeList.filter(i=>i.payment_method==='Cash').reduce((s,r)=>s+r.amount,0).toLocaleString());
console.log('Total Bank Income:', incomeList.filter(i=>i.payment_method==='Bank Transfer').reduce((s,r)=>s+r.amount,0).toLocaleString());

const atmList = db.prepare(`
  SELECT t.date, t.amount, t.description, c.name as category
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE t.workspace_id = 1 AND t.type = 'transfer'
  ORDER BY t.date
`).all();
console.log('\n=== ALL ATM/TRANSFER TRANSACTIONS ===');
atmList.forEach(r => console.log(r.date, '| Rs', r.amount.toLocaleString(), '|', r.description || ''));
console.log('Total ATM (Bank->Cash):', atmList.reduce((s,r)=>s+r.amount,0).toLocaleString());

// Excel comparison
const excelCash = 2325;
const excelBank = 297455;
const excelTotal = excelCash + excelBank;

const totalCashIncome = incomeList.filter(i=>i.payment_method==='Cash').reduce((s,r)=>s+r.amount,0);
const totalBankIncome = incomeList.filter(i=>i.payment_method==='Bank Transfer').reduce((s,r)=>s+r.amount,0);
const totalATM = atmList.reduce((s,r)=>s+r.amount,0);

const cashExp = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE workspace_id=1 AND type='expense' AND payment_method='Cash'`).get().t;
const bankExp = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE workspace_id=1 AND type='expense' AND payment_method IN ('Bank Transfer','Debit Card')`).get().t;
const settlements = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE workspace_id=1 AND type='settlement'`).get().t;

const appCash = totalCashIncome - cashExp - settlements + totalATM;
const appBank = totalBankIncome - bankExp - totalATM;
const appTotal = appCash + appBank;

console.log('\n=== COMPARISON: APP vs EXCEL ===');
console.log('              APP          EXCEL       DIFF');
console.log(`Cash:         ${appCash.toLocaleString().padStart(10)}   ${excelCash.toLocaleString().padStart(10)}   ${(appCash-excelCash).toLocaleString()}`);
console.log(`Bank:         ${appBank.toLocaleString().padStart(10)}   ${excelBank.toLocaleString().padStart(10)}   ${(appBank-excelBank).toLocaleString()}`);
console.log(`Total:        ${appTotal.toLocaleString().padStart(10)}   ${excelTotal.toLocaleString().padStart(10)}   ${(appTotal-excelTotal).toLocaleString()}`);
