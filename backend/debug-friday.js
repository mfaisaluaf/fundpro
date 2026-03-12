const db = require('./db');
const WEEKLY_BUDGET = 8000;

function countFridaysInMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(year, month - 1, d).getDay() === 5) count++;
  }
  return count;
}

function addOneMonth(yearMonth) {
  let [y, m] = yearMonth.split('-').map(Number);
  m++;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

const fridayRows = db.prepare(`
  SELECT strftime('%Y-%m', t.date) as month, COALESCE(SUM(t.amount), 0) as spent
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE c.name = 'Friday Lunch' AND t.type = 'expense' AND t.workspace_id = 1
  GROUP BY month ORDER BY month
`).all();

const firstRow = db.prepare(`
  SELECT MIN(strftime('%Y-%m', date)) as first_month
  FROM transactions t JOIN categories c ON t.category_id = c.id
  WHERE c.name = 'Friday Lunch' AND t.type = 'expense' AND t.workspace_id = 1
`).get();

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const spendByMonth = {};
fridayRows.forEach(r => { spendByMonth[r.month] = r.spent; });

console.log('=== FRIDAY LUNCH BUDGET — MONTH BY MONTH ===');
console.log('Month       | Fridays | Budget   | Spent    | Surplus  | Cumulative');
console.log('------------+---------+----------+----------+----------+-----------');

let carryForward = 0;
if (firstRow?.first_month) {
  let m = firstRow.first_month;
  while (m <= currentMonth) {
    const [y, mo] = m.split('-').map(Number);
    const fridays = countFridaysInMonth(y, mo);
    const budget = fridays * WEEKLY_BUDGET;
    const spent = spendByMonth[m] || 0;
    const surplus = budget - spent;
    const isCurrent = m === currentMonth;
    if (!isCurrent) carryForward += surplus;
    const cumulative = isCurrent ? carryForward + surplus : carryForward;
    console.log(`${m}   |    ${fridays}    | ${budget.toLocaleString().padStart(8)} | ${spent.toLocaleString().padStart(8)} | ${(surplus>=0?'+':'')}${surplus.toLocaleString().padStart(8)} | ${(cumulative>=0?'+':'')}${cumulative.toLocaleString()} ${isCurrent ? '<-- CURRENT' : ''}`);
    m = addOneMonth(m);
  }
}

const [cy, cm] = currentMonth.split('-').map(Number);
const currentFridays = countFridaysInMonth(cy, cm);
console.log(`\nNet Balance shown on card: ${carryForward >= 0 ? '+' : ''}Rs ${carryForward.toLocaleString()} (carry) + Rs ${(currentFridays * WEEKLY_BUDGET - (spendByMonth[currentMonth]||0)).toLocaleString()} (this month remaining) = Rs ${(carryForward + currentFridays * WEEKLY_BUDGET - (spendByMonth[currentMonth]||0)).toLocaleString()}`);
