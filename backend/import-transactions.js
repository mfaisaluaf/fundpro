/**
 * Bulk import: Office transactions Oct 2025 – Mar 2026
 * Mapping:
 *   Expense      → type='expense'
 *   Reimbursement→ type='settlement', cat=54 (Employee Reimbursement), person=Faisal
 *   Reload (ATM) → type='transfer', cat=196 (Bank to Cash ATM Withdrawl)
 *   Reload (Cash/Bank) → type='transfer', cat=53 (Petty Cash Reload)
 *   Paid by Faisal → payment_method='Payable', person_id=1
 *   CEO Personal Expense (cat 52) used for "Usman Personal Expense"
 */

const db = require('./db')

const insert = db.prepare(`
  INSERT INTO transactions (date, type, workspace_id, category_id, description, amount, payment_method, person_id)
  VALUES (?, ?, 1, ?, ?, ?, ?, ?)
`)

// [date, type, cat_id, description, amount, payment_method, person_id]
const rows = [
  // ─── OCT 2025 ───
  ['2025-10-24', 'expense',    40,  'Friday Lunch (Alberuti)',              5340,  'Cash',      null],
  ['2025-10-24', 'expense',    40,  'Friday Lunch (Alberuti)',              3970,  'Payable',   1],
  ['2025-10-31', 'expense',    40,  'Friday Lunch (Alamat Fish)',           8000,  'Payable',   1],
  ['2025-10-31', 'transfer',   53,  'Petty Cash Top-up - Usman',           5000,  null,        null],
  ['2025-10-31', 'expense',    46,  'Fruit for Punjani Father',             1100,  'Payable',   1],

  // ─── NOV 2025 ───
  ['2025-11-03', 'settlement', 54,  'Payback to Faisal',                   5000,  'Cash',      1],
  ['2025-11-04', 'expense',    175, 'Water Supply',                         1170,  'Payable',   1],
  ['2025-11-07', 'transfer',   53,  'Petty Cash Top-up - Usman',           6600,  null,        null],
  ['2025-11-07', 'expense',    40,  'Friday Lunch (White Castle)',          6660,  'Cash',      null],
  ['2025-11-10', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   80000,  null,        null],
  ['2025-11-10', 'expense',    174, 'Electricity Bill',                   55430,  'Cash',      null],
  ['2025-11-10', 'settlement', 54,  'Payback to Faisal',                   9370,  'Cash',      1],
  ['2025-11-11', 'expense',    46,  'Icecream Pilot Celebration',           2080,  'Debit Card',null],
  ['2025-11-12', 'expense',    43,  'Coffee (Dial)',                       10290,  'Payable',   1],
  ['2025-11-14', 'expense',    40,  'Friday Lunch (Bunjija)',              10170,  'Debit Card',null],
  ['2025-11-14', 'expense',    40,  'Friday Lunch (Bunjija)',                560,  'Payable',   1],
  ['2025-11-18', 'expense',    52,  'Splitwise Settlement',                 1910,  'Payable',   1],
  ['2025-11-19', 'expense',    44,  'Tissues',                              5790,  'Payable',   1],
  ['2025-11-19', 'expense',    43,  'Disposable Items',                     1550,  'Payable',   1],
  ['2025-11-19', 'expense',    52,  'Plot Treat (Shirwaan IID)',            20510,  'Payable',   1],
  ['2025-11-19', 'expense',    52,  'Tour Expense (Patriata)',             21500,  'Payable',   1],
  ['2025-11-21', 'expense',    40,  'Friday Lunch (Ranchers)',              5030,  'Payable',   1],
  ['2025-11-24', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   90000,  null,        null],
  ['2025-11-24', 'settlement', 54,  'Payback to Faisal',                  67030,  'Cash',      1],
  ['2025-11-28', 'expense',    40,  'Friday Lunch (White Castle)',          6400,  'Cash',      null],
  ['2025-11-28', 'expense',    52,  'Shoes Usman sb',                        800,  'Cash',      null],
  ['2025-11-28', 'expense',    52,  'Cash Withdrawal for Personal Use',   30000,  'Cash',      null],

  // ─── DEC 2025 ───
  ['2025-12-05', 'expense',    40,  'Friday Lunch (Jalandar)',              8400,  'Payable',   1],
  ['2025-12-08', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   50000,  null,        null],
  ['2025-12-08', 'expense',    174, 'Electricity Bill',                   29980,  'Cash',      null],
  ['2025-12-08', 'settlement', 54,  'Payback to Faisal',                   8420,  'Cash',      1],
  ['2025-12-09', 'expense',    175, 'Water Supply',                         1050,  'Payable',   1],
  ['2025-12-11', 'expense',    52,  'Splitwise Settlement',                 5780,  'Cash',      null],
  ['2025-12-12', 'expense',    40,  'Friday Lunch (Baba Tikka)',            9800,  'Cash',      null],
  ['2025-12-19', 'expense',    46,  'Cricket Match Lunch',                  6140,  'Payable',   1],
  ['2025-12-19', 'expense',    48,  'Subhan Bday',                          1000,  'Payable',   1],
  ['2025-12-19', 'expense',    40,  'Friday Lunch (Salt N Pepper)',         9610,  'Payable',   1],
  ['2025-12-19', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   25000,  null,        null],
  ['2025-12-19', 'settlement', 54,  'Payback to Faisal',                  19800,  'Cash',      1],
  ['2025-12-19', 'expense',    52,  'Food for Home (FP)',                     440,  'Payable',   1],
  ['2025-12-23', 'expense',    52,  'Food for Home (FP)',                   1910,  'Payable',   1],
  ['2025-12-24', 'expense',    40,  'Friday Lunch (14th Street)',           5200,  'Payable',   1],
  ['2025-12-24', 'expense',    40,  'Friday Lunch (14th Street)',             820,  'Payable',   1],
  ['2025-12-25', 'expense',    47,  'Server Deployment Lunch/Dinner',       4380,  'Payable',   1],
  ['2025-12-31', 'expense',    41,  'Tallaphone Set',                       3200,  'Payable',   1],

  // ─── JAN 2026 ───
  ['2026-01-01', 'expense',    47,  'New Year Cake',                        2100,  'Payable',   1],
  ['2026-01-02', 'expense',    40,  'Friday Lunch (Alberuti)',              8110,  'Payable',   1],
  ['2026-01-02', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   25000,  null,        null],
  ['2026-01-02', 'settlement', 54,  'Payback to Faisal',                  20760,  'Cash',      1],
  ['2026-01-05', 'expense',    175, 'Water Supply',                         1000,  'Payable',   1],
  ['2026-01-09', 'expense',    40,  'Qulium',                              10000,  'Cash',      null],
  ['2026-01-09', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   15000,  null,        null],
  ['2026-01-09', 'expense',    52,  'Qulium (Junad UK)',                    9780,  'Cash',      null],
  ['2026-01-10', 'expense',    52,  'Ami Birthday (White Castle)',         19650,  'Debit Card',null],
  ['2026-01-10', 'expense',    174, 'Electricity Bill',                   31870,  'Cash',      null],
  ['2026-01-12', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   40000,  null,        null],
  ['2026-01-12', 'transfer',   53,  'Petty Cash Top-up - Usman (Bank Transfer)', 100000, null, null],
  ['2026-01-16', 'expense',    47,  'Ranveer Thug Partner Broken',          2500,  'Cash',      null],
  ['2026-01-18', 'expense',    40,  'Twist',                                9750,  'Debit Card',null],
  ['2026-01-23', 'expense',    40,  'Bannya',                               9810,  'Debit Card',null],
  ['2026-01-23', 'expense',    44,  'Vet Tissues',                            500,  'Cash',      null],
  ['2026-01-28', 'expense',    51,  'EFI for AC Pipe',                        200,  'Cash',      null],
  ['2026-01-30', 'transfer',   53,  'Petty Cash Top-up - Usman',           8000,  null,        null],
  ['2026-01-30', 'expense',    40,  'Pat Fish',                             8000,  'Cash',      null],
  ['2026-01-30', 'expense',    48,  'Shahzaib Cake',                        3000,  'Payable',   1],

  // ─── FEB 2026 ───
  ['2026-02-04', 'expense',    175, 'Water Supply',                           900,  'Payable',   1],
  ['2026-02-06', 'expense',    52,  'Diaz Payment',                           200,  'Payable',   1],
  ['2026-02-06', 'expense',    52,  'Splitwise Payment',                     4480,  'Payable',   1],
  ['2026-02-06', 'expense',    43,  'Milk Pack (Half M)',                     1200,  'Payable',   1],
  ['2026-02-06', 'expense',    40,  'Kabab Jees',                            6070,  'Payable',   1],
  ['2026-02-06', 'transfer',   53,  'Petty Cash Top-up - Usman',           10000,  null,        null],
  ['2026-02-08', 'expense',    174, 'Electricity Bill',                    48620,  'Payable',   1],
  ['2026-02-09', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   30000,  null,        null],
  ['2026-02-09', 'expense',    52,  'Kabab Jees (Ajay)',                    1415,  'Payable',   1],
  ['2026-02-10', 'expense',    40,  'Ahmad Sagi',                             500,  'Cash',      null],
  ['2026-02-14', 'expense',    52,  'Cigarette',                              500,  'Cash',      null],
  ['2026-02-14', 'expense',    46,  'Annual Ceremony Family Packs',          5000,  'Cash',      null],
  ['2026-02-16', 'settlement', 54,  'Payback to Faisal',                   75295,  'Cash',      1],
  ['2026-02-17', 'expense',    46,  'Lunch to Malik Hayat',                  8800,  'Debit Card',null],
  ['2026-02-18', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   90000,  null,        null],
  ['2026-02-19', 'expense',    40,  'Baba Tikka',                           9000,  'Payable',   1],
  ['2026-02-24', 'expense',    46,  'Annual Ceremony Quize Gifts',           2700,  'Cash',      null],
  ['2026-02-25', 'expense',    46,  'Annual Ceremony (Remaining Payment)',  25870,  'Debit Card',null],
  ['2026-02-25', 'expense',    46,  'Annual Ceremony (Suleman Sawati)',     29500,  'Cash',      null],
  ['2026-02-26', 'transfer',   53,  'Petty Cash Top-up - Faisal (Coffee Used Line)', 1700, null, null],
  ['2026-02-28', 'expense',    46,  'Annual Ceremony (Aftari Advance)',      1000,  'Cash',      null],
  ['2026-02-28', 'transfer',   196, 'Petty Cash Top-up - Faisal (ATM)',   20000,  null,        null],

  // ─── MAR 2026 ───
  ['2026-03-03', 'expense',    44,  'Tissues',                              8100,  'Cash',      null],
  ['2026-03-03', 'expense',    52,  'Tissues (Hows)',                       6000,  'Cash',      null],
  ['2026-03-03', 'expense',    52,  'Food Panda',                           3675,  'Debit Card',null],
]

const insertAll = db.transaction(() => {
  let count = 0
  for (const [date, type, cat_id, desc, amount, pm, pid] of rows) {
    insert.run(date, type, cat_id, desc, amount, pm, pid)
    count++
  }
  return count
})

const inserted = insertAll()
console.log(`✅ Inserted ${inserted} transactions successfully.`)
