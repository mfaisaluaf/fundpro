/**
 * FundPro Backend API Server
 */

const express = require('express')
const cors = require('cors')
const db = require('./db')

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// ============================================
// DASHBOARD APIs
// ============================================

// Helper function to get workspace ID
function getWorkspaceId(workspace) {
  const map = { office: 1, personal: 2, treat: 3 }
  return map[workspace] || 1
}

// Get dashboard summary for a workspace
app.get('/api/dashboard/:workspace', (req, res) => {
  const { workspace } = req.params
  const workspaceId = getWorkspaceId(workspace)

  try {
    // Get workspace info
    const workspaceInfo = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId)

    // Calculate balance from transactions by payment method
    // Logic:
    // - ALL expenses reduce total balance (including Payable - expense happened, just owed to employee)
    // - Settlements do NOT reduce total (just paying off existing Payable liability)
    // - Credit card expenses create liability, don't reduce Cash/Bank
    // - Payable expenses don't reduce Cash/Bank (employee paid, company owes)
    const balanceByMethod = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
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
        COALESCE(SUM(CASE
          WHEN (payment_method LIKE '%Credit Card%') AND type = 'expense' THEN amount
          ELSE 0
        END), 0) as credit_used
      FROM transactions WHERE workspace_id = ?
    `).get(workspaceId)

    // Calculate transfer adjustments based on category name
    // Bank to Cash / ATM Withdrawal: cash+, bank-
    // Cash to Bank: cash-, bank+
    const transferAdjustments = db.prepare(`
      SELECT
        COALESCE(SUM(CASE
          WHEN c.name IN ('ATM Withdrawal', 'Bank to Cash') OR c.name LIKE 'Bank to Cash%' THEN t.amount
          WHEN c.name = 'Cash to Bank' THEN -t.amount
          ELSE 0
        END), 0) as cash_adj,
        COALESCE(SUM(CASE
          WHEN c.name IN ('ATM Withdrawal', 'Bank to Cash') OR c.name LIKE 'Bank to Cash%' THEN -t.amount
          WHEN c.name = 'Cash to Bank' THEN t.amount
          ELSE 0
        END), 0) as bank_adj
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'transfer' AND t.workspace_id = ?
    `).get(workspaceId)

    // Calculate payables: expenses marked as Payable minus settlements
    const payables = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'Payable' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'settlement' THEN amount ELSE 0 END), 0) as total_payable
      FROM transactions WHERE workspace_id = ?
    `).get(workspaceId)

    // Final balances with transfer adjustments
    // Total Balance = Cash + Bank (actual available liquid money)
    // Credit cards, receivables, loans are tracked as separate items on dashboard
    const cashBalance = (balanceByMethod?.cash_balance || 0) + (transferAdjustments?.cash_adj || 0)
    const bankBalance = (balanceByMethod?.bank_balance || 0) + (transferAdjustments?.bank_adj || 0)
    const totalBalance = cashBalance + bankBalance

    // Get this month's expenses
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const monthlyExpense = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense'
      AND workspace_id = ?
      AND date LIKE ?
    `).get(workspaceId, currentMonth + '%')

    // Get funds for this workspace
    const funds = db.prepare(`
      SELECT * FROM funds WHERE workspace_id = ? AND is_active = 1
    `).all(workspaceId)

    // Get recent transactions
    const recentTransactions = db.prepare(`
      SELECT t.*, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.workspace_id = ?
      ORDER BY t.date DESC, t.id DESC
      LIMIT 10
    `).all(workspaceId)

    // Get expense by category this month
    const categoryExpenses = db.prepare(`
      SELECT c.name, SUM(t.amount) as value
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense'
      AND t.workspace_id = ?
      GROUP BY c.name
      ORDER BY value DESC
      LIMIT 5
    `).all(workspaceId)

    // Monthly expense trend — last 6 months
    const monthlyTrendRows = db.prepare(`
      SELECT strftime('%Y-%m', date) as month_key,
             SUM(amount) as amount
      FROM transactions
      WHERE type = 'expense' AND workspace_id = ?
        AND date >= date('now', 'start of month', '-5 months')
      GROUP BY month_key
      ORDER BY month_key
    `).all(workspaceId)

    // Build a full 6-month array (fill 0 for months with no data)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-GB', { month: 'short' })
      const row = monthlyTrendRows.find(r => r.month_key === key)
      monthlyTrend.push({ month: label, amount: row?.amount || 0 })
    }

    // Credit card usage breakdown by card name (all workspaces)
    const creditByCard = db.prepare(`
      SELECT t.payment_method as card_name, COALESCE(SUM(t.amount), 0) as used
      FROM transactions t
      WHERE t.payment_method LIKE '%Credit Card%' AND t.type = 'expense' AND t.workspace_id = ?
      GROUP BY t.payment_method
    `).all(workspaceId)

    const creditPayments = db.prepare(`
      SELECT c.name as card_name, COALESCE(SUM(t.amount), 0) as paid
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE (c.parent_id IN (
        SELECT id FROM categories WHERE name = 'Credit Card Payments' AND workspace_id = ?
      ) OR c.name = 'Credit Card Payments') AND t.workspace_id = ?
      GROUP BY c.name
    `).all(workspaceId, workspaceId)

    const totalCreditUsed = creditByCard.reduce((sum, c) => sum + c.used, 0)
    const totalCreditPaid = creditPayments.reduce((sum, c) => sum + c.paid, 0)

    let creditCardData = {
      totalUsed: totalCreditUsed,
      totalPaid: totalCreditPaid,
      outstanding: totalCreditUsed - totalCreditPaid,
      byCard: creditByCard.map(card => {
        const shortName = card.card_name.replace(' Credit Card', '')
        const payment = creditPayments.find(p => p.card_name === shortName)
        return {
          name: card.card_name,
          used: card.used,
          paid: payment?.paid || 0,
          outstanding: card.used - (payment?.paid || 0)
        }
      })
    }

    // Receivables: expenses paid with 'Receivable' payment method (all workspaces)
    const receivablesByPerson = db.prepare(`
      SELECT p.name as person_name, COALESCE(SUM(t.amount), 0) as amount
      FROM transactions t
      LEFT JOIN people p ON t.person_id = p.id
      WHERE t.payment_method = 'Receivable' AND t.type = 'expense' AND t.workspace_id = ?
      GROUP BY t.person_id
    `).all(workspaceId)

    const totalReceivable = receivablesByPerson.reduce((sum, r) => sum + r.amount, 0)

    let receivablesData = {
      total: totalReceivable,
      byPerson: receivablesByPerson.map(r => ({
        name: r.person_name || 'Unknown',
        amount: r.amount
      }))
    }

    // Calculate loans, savings, pocket money for Personal workspace
    let loansData = {}
    let savingsData = {}
    let pocketMoneyData = {}
    if (workspaceId === 2) {
      // Loans given (includes sub-categories like Mehreen, Office, Other)
      const loansGiven = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE (c.name = 'Loan Given' OR c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Loan Given' AND workspace_id = ?
        )) AND t.workspace_id = ?
      `).get(workspaceId, workspaceId)

      // Loans recovered (includes sub-categories)
      const loansRecovered = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE (c.name = 'Loan Recovery' OR c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Loan Recovery' AND workspace_id = ?
        )) AND t.workspace_id = ?
      `).get(workspaceId, workspaceId)

      // Loan details by person
      const loansByPerson = db.prepare(`
        SELECT p.name as person_name,
          COALESCE(SUM(CASE WHEN c.name = 'Loan Given' OR c.parent_id IN (
            SELECT id FROM categories WHERE name = 'Loan Given' AND workspace_id = ?
          ) THEN t.amount ELSE 0 END), 0) as given,
          COALESCE(SUM(CASE WHEN c.name = 'Loan Recovery' OR c.parent_id IN (
            SELECT id FROM categories WHERE name = 'Loan Recovery' AND workspace_id = ?
          ) THEN t.amount ELSE 0 END), 0) as recovered
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE (c.name IN ('Loan Given', 'Loan Recovery') OR c.parent_id IN (
          SELECT id FROM categories WHERE name IN ('Loan Given', 'Loan Recovery') AND workspace_id = ?
        )) AND t.workspace_id = ?
        GROUP BY t.person_id
      `).all(workspaceId, workspaceId, workspaceId, workspaceId)

      loansData = {
        given: loansGiven?.total || 0,
        recovered: loansRecovered?.total || 0,
        outstanding: (loansGiven?.total || 0) - (loansRecovered?.total || 0),
        byPerson: loansByPerson.map(p => ({
          name: p.person_name || 'Unknown',
          given: p.given,
          recovered: p.recovered,
          outstanding: p.given - p.recovered
        })).filter(p => p.outstanding !== 0)
      }

      // ---- COMPREHENSIVE SAVINGS ----
      // Savings deposited (includes sub-categories)
      const savingsDeposit = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE (c.name = 'Savings Deposit' OR c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Savings Deposit' AND workspace_id = ?
        )) AND t.workspace_id = ?
      `).get(workspaceId, workspaceId)

      // Savings withdrawn (includes sub-categories)
      const savingsWithdrawn = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE (c.name = 'Savings Withdrawal' OR c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Savings Withdrawal' AND workspace_id = ?
        )) AND t.workspace_id = ?
      `).get(workspaceId, workspaceId)

      // Bank profit total (includes sub-categories like Alfalah Profit, Askari Profit)
      const bankProfit = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE (c.name = 'Bank Profit' OR c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Bank Profit' AND workspace_id = ?
        )) AND t.workspace_id = ?
      `).get(workspaceId, workspaceId)

      // Bank profit by bank (sub-categories)
      const bankProfitByBank = db.prepare(`
        SELECT c.name as bank_name, COALESCE(SUM(t.amount), 0) as amount
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Bank Profit' AND workspace_id = ?
        ) AND t.workspace_id = ?
        GROUP BY c.name
      `).all(workspaceId, workspaceId)

      // Also include transactions directly under Bank Profit parent
      const bankProfitDirect = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as amount
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.name = 'Bank Profit' AND c.parent_id IS NULL AND t.workspace_id = ?
      `).get(workspaceId)

      // Annual Expense Provision total
      const annualProvision = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE (c.name = 'Annual Expense Provision' OR c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Annual Expense Provision' AND workspace_id = ?
        )) AND t.workspace_id = ?
      `).get(workspaceId, workspaceId)

      const savingsBalance = (savingsDeposit?.total || 0) - (savingsWithdrawn?.total || 0)

      savingsData = {
        deposited: savingsDeposit?.total || 0,
        withdrawn: savingsWithdrawn?.total || 0,
        balance: savingsBalance,
        bankProfit: bankProfit?.total || 0,
        bankProfitByBank: [
          ...(bankProfitDirect?.amount > 0 ? [{ name: 'Unspecified', amount: bankProfitDirect.amount }] : []),
          ...bankProfitByBank.map(b => ({ name: b.bank_name.replace(' Profit', ''), amount: b.amount }))
        ],
        annualProvision: annualProvision?.total || 0,
        // Grand total of all savings-type items
        grandTotal: savingsBalance + (bankProfit?.total || 0)
      }

      // Pocket money by person (sub-categories like Mehreen, Kids, Ami)
      const pocketMoneyByPerson = db.prepare(`
        SELECT c.name as person_name, COALESCE(SUM(t.amount), 0) as amount
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.parent_id IN (
          SELECT id FROM categories WHERE name = 'Monthly Pocket Money' AND workspace_id = ?
        ) AND t.workspace_id = ?
        GROUP BY c.name
      `).all(workspaceId, workspaceId)

      // Also include direct pocket money transactions
      const pocketMoneyDirect = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.name = 'Monthly Pocket Money' AND c.parent_id IS NULL AND t.workspace_id = ?
      `).get(workspaceId)

      const totalPocketMoney = (pocketMoneyDirect?.total || 0) + pocketMoneyByPerson.reduce((sum, p) => sum + p.amount, 0)

      pocketMoneyData = {
        total: totalPocketMoney,
        byPerson: pocketMoneyByPerson.map(p => ({
          name: p.person_name,
          amount: p.amount
        }))
      }
    }

    // All-time totals for every parent category (for dynamic dashboard cards)
    const parentCategoryTotals = db.prepare(`
      SELECT c.name,
        COALESCE(SUM(t.amount), 0) as total,
        c.type as category_type
      FROM categories c
      LEFT JOIN transactions t ON (
        t.category_id = c.id
        OR t.category_id IN (SELECT id FROM categories WHERE parent_id = c.id)
      ) AND t.workspace_id = ?
      WHERE c.workspace_id = ? AND c.parent_id IS NULL AND c.is_active = 1
      GROUP BY c.id, c.name
    `).all(workspaceId, workspaceId)

    const categoryTotals = {}
    for (const row of parentCategoryTotals) {
      categoryTotals[row.name] = { total: row.total, type: row.category_type }
    }

    // ---- FRIDAY LUNCH BUDGET (office only) ----
    const countFridaysInMonth = (year, month) => {
      const lastDay = new Date(year, month, 0).getDate()
      let count = 0
      for (let d = 1; d <= lastDay; d++) {
        if (new Date(year, month - 1, d).getDay() === 5) count++
      }
      return count
    }
    const addOneMonth = (yearMonth) => {
      let [y, m] = yearMonth.split('-').map(Number)
      m++
      if (m > 12) { m = 1; y++ }
      return `${y}-${String(m).padStart(2, '0')}`
    }
    let fridayBudgetData = null
    if (workspaceId === 1) {
      const WEEKLY_BUDGET = 8000

      // Get Friday Lunch spending per month
      const fridayRows = db.prepare(`
        SELECT strftime('%Y-%m', t.date) as month, COALESCE(SUM(t.amount), 0) as spent
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.name = 'Friday Lunch' AND t.type = 'expense' AND t.workspace_id = ?
        GROUP BY month ORDER BY month
      `).all(workspaceId)

      // Get earliest Friday Lunch month
      const firstRow = db.prepare(`
        SELECT MIN(strftime('%Y-%m', date)) as first_month
        FROM transactions t JOIN categories c ON t.category_id = c.id
        WHERE c.name = 'Friday Lunch' AND t.type = 'expense' AND t.workspace_id = ?
      `).get(workspaceId)

      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const spendByMonth = {}
      fridayRows.forEach(r => { spendByMonth[r.month] = r.spent })

      // First month uses only 1 Friday (budget started last week of that month)
      const FIRST_MONTH_FRIDAYS = 1

      // Accumulate carry-forward from all months before current
      let carryForward = 0
      if (firstRow?.first_month) {
        let m = firstRow.first_month
        let isFirstMonth = true
        while (m < currentMonth) {
          const [y, mo] = m.split('-').map(Number)
          const fridays = isFirstMonth ? FIRST_MONTH_FRIDAYS : countFridaysInMonth(y, mo)
          const budget = fridays * WEEKLY_BUDGET
          const spent = spendByMonth[m] || 0
          carryForward += budget - spent
          m = addOneMonth(m)
          isFirstMonth = false
        }
      }

      // Current month
      const [cy, cm] = currentMonth.split('-').map(Number)
      const isCurrentAlsoFirst = firstRow?.first_month === currentMonth
      const currentFridays = isCurrentAlsoFirst ? FIRST_MONTH_FRIDAYS : countFridaysInMonth(cy, cm)
      const currentBudget = currentFridays * WEEKLY_BUDGET
      const currentSpent = spendByMonth[currentMonth] || 0
      const currentRemaining = currentBudget - currentSpent

      // Build month-by-month history for modal
      const monthHistory = []
      if (firstRow?.first_month) {
        let mh = firstRow.first_month
        let runningTotal = 0
        let isFirstMh = true
        while (mh <= currentMonth) {
          const [hy, hmo] = mh.split('-').map(Number)
          const hFridays = isFirstMh ? FIRST_MONTH_FRIDAYS : countFridaysInMonth(hy, hmo)
          const hBudget = hFridays * WEEKLY_BUDGET
          const hSpent = spendByMonth[mh] || 0
          const hSurplus = hBudget - hSpent
          runningTotal += hSurplus
          monthHistory.push({
            month: mh,
            fridays: hFridays,
            budget: hBudget,
            spent: hSpent,
            surplus: hSurplus,
            cumulative: runningTotal,
            isCurrent: mh === currentMonth
          })
          mh = addOneMonth(mh)
          isFirstMh = false
        }
      }

      fridayBudgetData = {
        weeklyBudget: WEEKLY_BUDGET,
        currentMonth,
        currentFridays,
        currentBudget,
        currentSpent,
        currentRemaining,
        carryForward,
        netBalance: carryForward + currentRemaining,
        monthHistory
      }
    }

    res.json({
      workspace: workspaceInfo,
      balance: {
        total: totalBalance,
        cash: cashBalance,
        bank: bankBalance,
        payable: payables?.total_payable || 0,
        creditUsed: balanceByMethod?.credit_used || 0
      },
      thisMonthExpense: monthlyExpense?.total || 0,
      funds,
      recentTransactions,
      categoryExpenses,
      categoryTotals,
      loansData,
      savingsData,
      creditCardData,
      receivablesData,
      pocketMoneyData,
      fridayBudgetData,
      monthlyTrend
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// TRANSACTIONS APIs
// ============================================

// Get all transactions (with filters)
app.get('/api/transactions', (req, res) => {
  const { workspace, type, category, limit = 50, offset = 0 } = req.query

  try {
    let query = `
      SELECT t.*, c.name as category_name, p.name as person_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN people p ON t.person_id = p.id
      WHERE 1=1
    `
    const params = []

    if (workspace) {
      query += ' AND t.workspace_id = ?'
      params.push(getWorkspaceId(workspace))
    }
    if (type) {
      query += ' AND t.type = ?'
      params.push(type)
    }
    if (category) {
      query += ' AND t.category_id = ?'
      params.push(category)
    }

    query += ' ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const transactions = db.prepare(query).all(...params)
    res.json(transactions)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add new transaction
app.post('/api/transactions', (req, res) => {
  const {
    date, type, workspace_id, fund_id, category_id, description,
    amount, payment_method, bank_account_id, credit_card_id,
    purchase_mode, person_id, reference_number, notes, quantity, quantity_unit
  } = req.body

  try {
    // Credit card / Receivable payments should NOT debit any fund
    const effectiveFundId = (payment_method && (payment_method.includes('Credit Card') || payment_method === 'Receivable'))
      ? null : (fund_id || null)

    const stmt = db.prepare(`
      INSERT INTO transactions (
        date, type, workspace_id, fund_id, category_id, description,
        amount, payment_method, bank_account_id, credit_card_id,
        purchase_mode, person_id, reference_number, notes, quantity, quantity_unit, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    const result = stmt.run(
      date || new Date().toISOString().slice(0, 10),
      type, workspace_id, effectiveFundId, category_id, description,
      amount, payment_method, bank_account_id, credit_card_id,
      purchase_mode, person_id, reference_number, notes, quantity || null, quantity_unit || null
    )

    // Update fund balance if applicable (Personal workspace savings tracking)
    // Income: credits the fund (increases balance)
    // Expense: debits the fund (decreases balance)
    if (effectiveFundId) {
      if (type === 'income') {
        db.prepare('UPDATE funds SET current_balance = current_balance + ? WHERE id = ?')
          .run(amount, effectiveFundId)
      } else if (type === 'expense') {
        db.prepare('UPDATE funds SET current_balance = current_balance - ? WHERE id = ?')
          .run(amount, effectiveFundId)
      }
    }

    res.json({ id: result.lastInsertRowid, message: 'Transaction added successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get transactions by category name (for detail modals) - includes sub-categories
// Also handles special names: __this_month__, __payable__, __cash__, __receivable__, __treat_income__, __treat_expense__
app.get('/api/transactions/by-category/:categoryName', (req, res) => {
  const { categoryName } = req.params
  const { workspace } = req.query
  const workspaceId = workspace ? getWorkspaceId(workspace) : null

  try {
    let query, params

    // Handle special category names for dashboard card detail views
    if (categoryName === '__this_month__') {
      const currentMonth = new Date().toISOString().slice(0, 7)
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE t.type = 'expense' AND t.date LIKE ? AND t.workspace_id = ?
        ORDER BY t.date DESC, t.id DESC LIMIT 100
      `
      params = [currentMonth + '%', workspaceId]
    } else if (categoryName === '__payable__') {
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE t.payment_method = 'Payable' AND t.workspace_id = ?
        ORDER BY t.date DESC, t.id DESC LIMIT 100
      `
      params = [workspaceId]
    } else if (categoryName === '__cash__') {
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE t.payment_method = 'Cash' AND t.workspace_id = ?
        ORDER BY t.date DESC, t.id DESC LIMIT 100
      `
      params = [workspaceId]
    } else if (categoryName === '__receivable__') {
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE t.payment_method = 'Receivable' AND t.workspace_id = ?
        ORDER BY t.date DESC, t.id DESC LIMIT 100
      `
      params = [workspaceId]
    } else if (categoryName === '__treat_income__') {
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE t.type = 'income' AND t.workspace_id = ?
        ORDER BY t.date DESC, t.id DESC LIMIT 100
      `
      params = [workspaceId]
    } else if (categoryName === '__treat_expense__') {
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE t.type = 'expense' AND t.workspace_id = ?
        ORDER BY t.date DESC, t.id DESC LIMIT 100
      `
      params = [workspaceId]
    } else {
      // Normal category name - includes sub-categories
      query = `
        SELECT t.*, c.name as category_name, p.name as person_name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN people p ON t.person_id = p.id
        WHERE (c.name = ? OR c.parent_id IN (
          SELECT id FROM categories WHERE name = ?
        ))
      `
      params = [categoryName, categoryName]

      if (workspaceId) {
        query += ' AND t.workspace_id = ?'
        params.push(workspaceId)
      }

      query += ' ORDER BY t.date DESC, t.id DESC LIMIT 100'
    }

    const transactions = db.prepare(query).all(...params)
    res.json(transactions)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single transaction
app.get('/api/transactions/:id', (req, res) => {
  const { id } = req.params
  try {
    const transaction = db.prepare(`
      SELECT t.*, c.name as category_name, p.name as person_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN people p ON t.person_id = p.id
      WHERE t.id = ?
    `).get(id)

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }
    res.json(transaction)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Helper: Verify admin password
function verifyPassword(password) {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password')
  return setting && setting.value === password
}

// Update transaction (requires password)
app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params
  const {
    password, date, type, category_id, description,
    amount, payment_method, person_id, notes, quantity, quantity_unit, fund_id
  } = req.body

  try {
    // Verify password
    if (!verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Get existing transaction
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    // Reverse old fund balance if the old transaction had a fund
    if (existing.fund_id) {
      if (existing.type === 'income') {
        db.prepare('UPDATE funds SET current_balance = current_balance - ? WHERE id = ?')
          .run(existing.amount, existing.fund_id)
      } else if (existing.type === 'expense') {
        db.prepare('UPDATE funds SET current_balance = current_balance + ? WHERE id = ?')
          .run(existing.amount, existing.fund_id)
      }
    }

    const newPaymentMethod = payment_method !== undefined ? payment_method : existing.payment_method
    // Credit card / Receivable payments should NOT have a fund
    const isCreditOrReceivable = newPaymentMethod && (newPaymentMethod.includes('Credit Card') || newPaymentMethod === 'Receivable')
    const newFundId = isCreditOrReceivable ? null : (fund_id !== undefined ? fund_id : existing.fund_id)
    const newAmount = amount || existing.amount
    const newType = type || existing.type

    // Update transaction
    db.prepare(`
      UPDATE transactions SET
        date = ?, type = ?, category_id = ?, description = ?,
        amount = ?, payment_method = ?, person_id = ?, notes = ?,
        quantity = ?, quantity_unit = ?, fund_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      date || existing.date,
      newType,
      category_id || existing.category_id,
      description || existing.description,
      newAmount,
      payment_method,
      person_id,
      notes,
      quantity || null,
      quantity_unit || null,
      newFundId || null,
      id
    )

    // Apply new fund balance
    if (newFundId) {
      if (newType === 'income') {
        db.prepare('UPDATE funds SET current_balance = current_balance + ? WHERE id = ?')
          .run(newAmount, newFundId)
      } else if (newType === 'expense') {
        db.prepare('UPDATE funds SET current_balance = current_balance - ? WHERE id = ?')
          .run(newAmount, newFundId)
      }
    }

    res.json({ message: 'Transaction updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete transaction (requires password)
app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params
  const { password } = req.body

  try {
    // Verify password
    if (!verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Check if transaction exists
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    // Reverse fund balance before deleting
    if (existing.fund_id) {
      if (existing.type === 'income') {
        db.prepare('UPDATE funds SET current_balance = current_balance - ? WHERE id = ?')
          .run(existing.amount, existing.fund_id)
      } else if (existing.type === 'expense') {
        db.prepare('UPDATE funds SET current_balance = current_balance + ? WHERE id = ?')
          .run(existing.amount, existing.fund_id)
      }
    }

    // Delete transaction
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)

    res.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// CATEGORIES APIs
// ============================================

// Get categories (with workspace filter and hierarchical structure)
app.get('/api/categories', (req, res) => {
  const { workspace, type, flat, txn_type } = req.query

  try {
    let query = 'SELECT * FROM categories WHERE is_active = 1'
    const params = []

    if (workspace) {
      query += ' AND workspace_id = ?'
      params.push(getWorkspaceId(workspace))
    }
    if (type) {
      query += ' AND type = ?'
      params.push(type)
    }

    query += ' ORDER BY name'
    let allCategories = db.prepare(query).all(...params)

    // Filter by allowed transaction type (e.g. ?txn_type=income)
    if (txn_type) {
      allCategories = allCategories.filter(c => {
        if (!c.allowed_types) return true
        return c.allowed_types.split(',').includes(txn_type)
      })
    }

    // If flat=true, return flat list (for simple dropdowns)
    if (flat === 'true') {
      return res.json(allCategories)
    }

    // Build hierarchical structure
    const mainCategories = allCategories.filter(c => !c.parent_id)
    const subCategories = allCategories.filter(c => c.parent_id)

    const hierarchical = mainCategories.map(main => ({
      ...main,
      children: subCategories.filter(sub => sub.parent_id === main.id)
    }))

    res.json(hierarchical)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add category
app.post('/api/categories', (req, res) => {
  const { name, type, workspace_id, parent_id, icon, allowed_types } = req.body
  // Default allowed_types from type if not provided
  const types = allowed_types || (type === 'both' ? 'income,expense' : type || 'expense')
  try {
    const result = db.prepare(`
      INSERT INTO categories (name, type, workspace_id, parent_id, icon, allowed_types, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(name, type, workspace_id, parent_id || null, icon, types)
    res.json({ id: result.lastInsertRowid, message: 'Category added' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update category
app.put('/api/categories/:id', (req, res) => {
  const { id } = req.params
  const { name, type, icon, is_active, parent_id, allowed_types } = req.body
  try {
    if (allowed_types !== undefined) {
      db.prepare(`
        UPDATE categories
        SET name = ?, type = ?, icon = ?, is_active = ?, parent_id = ?, allowed_types = ?
        WHERE id = ?
      `).run(name, type, icon, is_active, parent_id, allowed_types, id)
    } else {
      db.prepare(`
        UPDATE categories
        SET name = ?, type = ?, icon = ?, is_active = ?, parent_id = ?
        WHERE id = ?
      `).run(name, type, icon, is_active, parent_id, id)
    }
    res.json({ message: 'Category updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete category (soft delete)
app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params
  try {
    db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id)
    res.json({ message: 'Category deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// FUNDS APIs
// ============================================

// Get all funds
app.get('/api/funds', (req, res) => {
  const { workspace } = req.query
  try {
    let query = 'SELECT * FROM funds WHERE is_active = 1'
    const params = []

    if (workspace) {
      query += ' AND workspace_id = ?'
      params.push(getWorkspaceId(workspace))
    }

    query += ' ORDER BY name'
    const funds = db.prepare(query).all(...params)
    res.json(funds)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create fund
app.post('/api/funds', (req, res) => {
  const { name, description, workspace_id, opening_balance } = req.body
  try {
    const balance = opening_balance || 0
    const result = db.prepare(
      'INSERT INTO funds (workspace_id, name, description, opening_balance, current_balance, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(workspace_id || 2, name, description || null, balance, balance)
    res.json({ id: result.lastInsertRowid, message: 'Fund created' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update fund
app.put('/api/funds/:id', (req, res) => {
  const { id } = req.params
  const { name, description } = req.body
  try {
    db.prepare('UPDATE funds SET name = ?, description = ? WHERE id = ?')
      .run(name, description || null, id)
    res.json({ message: 'Fund updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete fund (soft delete)
app.delete('/api/funds/:id', (req, res) => {
  const { id } = req.params
  try {
    // Check if fund has transactions
    const used = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE fund_id = ?').get(id)
    if (used.count > 0) {
      return res.status(400).json({ error: 'Cannot delete fund with existing transactions. Remove transactions first.' })
    }
    db.prepare('UPDATE funds SET is_active = 0 WHERE id = ?').run(id)
    res.json({ message: 'Fund deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add fund contribution
app.post('/api/funds/:id/contribute', (req, res) => {
  const { id } = req.params
  const { amount, person_id, reason, notes, date } = req.body

  try {
    // Add contribution record
    db.prepare(`
      INSERT INTO fund_contributions (fund_id, date, amount, person_id, reason, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, date || new Date().toISOString().slice(0, 10), amount, person_id, reason, notes)

    // Update fund balance
    db.prepare('UPDATE funds SET current_balance = current_balance + ? WHERE id = ?')
      .run(amount, id)

    res.json({ message: 'Contribution added successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get fund location breakdown (WHERE each fund's money sits)
// Derived from: transactions (by payment_method) + reallocations + transfers
app.get('/api/funds/:id/locations', (req, res) => {
  const { id } = req.params
  try {
    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(id)
    if (!fund) return res.status(404).json({ error: 'Fund not found' })

    // 1. Get net by payment_method from transactions (normalize all bank-type methods to 'Bank')
    const txnLocations = db.prepare(`
      SELECT
        CASE
          WHEN payment_method = 'Cash' THEN 'Cash'
          WHEN payment_method LIKE '%Credit Card%' THEN NULL
          WHEN payment_method = 'Receivable' THEN NULL
          WHEN payment_method = 'Payable' THEN NULL
          ELSE 'Bank'
        END as location,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM transactions
      WHERE fund_id = ?
      GROUP BY location
    `).all(id)

    const locations = {}
    for (const row of txnLocations) {
      if (!row.location) continue
      locations[row.location] = (locations[row.location] || 0) + row.income - row.expense
    }

    // 2. Apply reallocations (internal moves within this fund)
    const reallocs = db.prepare('SELECT * FROM fund_reallocations WHERE fund_id = ?').all(id)
    for (const r of reallocs) {
      locations[r.from_location] = (locations[r.from_location] || 0) - r.amount
      locations[r.to_location] = (locations[r.to_location] || 0) + r.amount
    }

    // 3. Apply fund transfers (money coming in/out from other funds)
    const transfersOut = db.prepare('SELECT * FROM fund_transfers WHERE from_fund_id = ?').all(id)
    for (const t of transfersOut) {
      locations[t.location] = (locations[t.location] || 0) - t.amount
    }
    const transfersIn = db.prepare('SELECT * FROM fund_transfers WHERE to_fund_id = ?').all(id)
    for (const t of transfersIn) {
      locations[t.location] = (locations[t.location] || 0) + t.amount
    }

    // Build response array
    const locationArray = Object.entries(locations)
      .filter(([, amount]) => amount !== 0)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    res.json({
      fund_id: fund.id,
      fund_name: fund.name,
      total: fund.current_balance,
      locations: locationArray
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get ALL funds with location breakdowns (for dashboard)
app.get('/api/funds-with-locations', (req, res) => {
  const { workspace } = req.query
  try {
    const workspaceId = workspace ? getWorkspaceId(workspace) : 2
    const funds = db.prepare('SELECT * FROM funds WHERE workspace_id = ? AND is_active = 1 ORDER BY name').all(workspaceId)

    const result = funds.map(fund => {
      const locations = {}

      // Transactions by payment_method (normalize all bank-type methods to 'Bank')
      const txnLocations = db.prepare(`
        SELECT
          CASE
            WHEN payment_method = 'Cash' THEN 'Cash'
            WHEN payment_method LIKE '%Credit Card%' THEN NULL
            WHEN payment_method = 'Receivable' THEN NULL
            WHEN payment_method = 'Payable' THEN NULL
            ELSE 'Bank'
          END as location,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
        FROM transactions
        WHERE fund_id = ?
        GROUP BY location
      `).all(fund.id)

      for (const row of txnLocations) {
        if (!row.location) continue
        locations[row.location] = (locations[row.location] || 0) + row.income - row.expense
      }

      // Reallocations
      const reallocs = db.prepare('SELECT * FROM fund_reallocations WHERE fund_id = ?').all(fund.id)
      for (const r of reallocs) {
        locations[r.from_location] = (locations[r.from_location] || 0) - r.amount
        locations[r.to_location] = (locations[r.to_location] || 0) + r.amount
      }

      // Transfers
      const transfersOut = db.prepare('SELECT * FROM fund_transfers WHERE from_fund_id = ?').all(fund.id)
      for (const t of transfersOut) {
        locations[t.location] = (locations[t.location] || 0) - t.amount
      }
      const transfersIn = db.prepare('SELECT * FROM fund_transfers WHERE to_fund_id = ?').all(fund.id)
      for (const t of transfersIn) {
        locations[t.location] = (locations[t.location] || 0) + t.amount
      }

      const locationArray = Object.entries(locations)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)

      return {
        ...fund,
        locations: locationArray
      }
    })

    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Fund-to-fund transfer (move money between funds)
app.post('/api/fund-transfers', (req, res) => {
  const { from_fund_id, to_fund_id, amount, location, notes, date } = req.body

  if (!from_fund_id || !to_fund_id || !amount) {
    return res.status(400).json({ error: 'from_fund_id, to_fund_id, and amount are required' })
  }
  if (from_fund_id === to_fund_id) {
    return res.status(400).json({ error: 'Cannot transfer to same fund. Use reallocation instead.' })
  }

  try {
    db.prepare(`
      INSERT INTO fund_transfers (date, from_fund_id, to_fund_id, amount, location, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date || new Date().toISOString().slice(0, 10), from_fund_id, to_fund_id, amount, location || 'Bank', notes || null)

    // Update fund balances
    db.prepare('UPDATE funds SET current_balance = current_balance - ? WHERE id = ?').run(amount, from_fund_id)
    db.prepare('UPDATE funds SET current_balance = current_balance + ? WHERE id = ?').run(amount, to_fund_id)

    res.json({ message: 'Fund transfer successful' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get fund transfers history
app.get('/api/fund-transfers', (req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT ft.*,
        ff.name as from_fund_name,
        tf.name as to_fund_name
      FROM fund_transfers ft
      JOIN funds ff ON ft.from_fund_id = ff.id
      JOIN funds tf ON ft.to_fund_id = tf.id
      ORDER BY ft.date DESC, ft.created_at DESC
    `).all()
    res.json(transfers)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Fund reallocation (move money within same fund between locations)
app.post('/api/fund-reallocations', (req, res) => {
  const { fund_id, from_location, to_location, amount, notes, date } = req.body

  if (!fund_id || !from_location || !to_location || !amount) {
    return res.status(400).json({ error: 'fund_id, from_location, to_location, and amount are required' })
  }
  if (from_location === to_location) {
    return res.status(400).json({ error: 'Source and destination locations must be different' })
  }

  try {
    db.prepare(`
      INSERT INTO fund_reallocations (date, fund_id, from_location, to_location, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date || new Date().toISOString().slice(0, 10), fund_id, from_location, to_location, amount, notes || null)

    res.json({ message: 'Fund reallocation successful' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get fund reallocations history
app.get('/api/fund-reallocations', (req, res) => {
  const { fund_id } = req.query
  try {
    let query = `
      SELECT fr.*, f.name as fund_name
      FROM fund_reallocations fr
      JOIN funds f ON fr.fund_id = f.id
    `
    const params = []
    if (fund_id) {
      query += ' WHERE fr.fund_id = ?'
      params.push(fund_id)
    }
    query += ' ORDER BY fr.date DESC, fr.created_at DESC'
    const reallocations = db.prepare(query).all(...params)
    res.json(reallocations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// PEOPLE APIs
// ============================================

// Get all people
app.get('/api/people', (req, res) => {
  try {
    const people = db.prepare('SELECT * FROM people WHERE is_active = 1 ORDER BY name').all()
    res.json(people)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add person
app.post('/api/people', (req, res) => {
  const { name, type, phone, notes } = req.body
  try {
    const result = db.prepare('INSERT INTO people (name, type, phone, notes) VALUES (?, ?, ?, ?)')
      .run(name, type, phone, notes)
    res.json({ id: result.lastInsertRowid, message: 'Person added' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update person
app.put('/api/people/:id', (req, res) => {
  const { id } = req.params
  const { name, type, phone, notes } = req.body
  try {
    db.prepare('UPDATE people SET name = ?, type = ?, phone = ?, notes = ? WHERE id = ?')
      .run(name, type, phone, notes, id)
    res.json({ message: 'Person updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete person (soft delete)
app.delete('/api/people/:id', (req, res) => {
  const { id } = req.params
  try {
    db.prepare('UPDATE people SET is_active = 0 WHERE id = ?').run(id)
    res.json({ message: 'Person deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// BANK ACCOUNTS APIs
// ============================================

// Get all bank accounts
app.get('/api/bank-accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM bank_accounts WHERE is_active = 1').all()
    res.json(accounts)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// CREDIT CARDS APIs
// ============================================

// Get all credit cards
app.get('/api/credit-cards', (req, res) => {
  try {
    const cards = db.prepare('SELECT * FROM credit_cards WHERE is_active = 1').all()
    res.json(cards)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// SETTINGS APIs
// ============================================

// Get all settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all()
    const settingsObj = {}
    settings.forEach(s => { settingsObj[s.key] = s.value })
    res.json(settingsObj)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update setting
app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params
  const { value } = req.body
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))')
      .run(key, value)
    res.json({ message: 'Setting updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// PAYMENT METHODS APIs
// ============================================

// Get all payment methods (optionally filter by transaction type)
app.get('/api/payment-methods', (req, res) => {
  const { type } = req.query // e.g. type=income or type=expense
  try {
    const methods = db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY name').all()
    if (type) {
      // Filter to methods that include this transaction type in allowed_types
      const filtered = methods.filter(m => {
        if (!m.allowed_types) return true // no restriction = show all
        return m.allowed_types.split(',').includes(type)
      })
      return res.json(filtered)
    }
    res.json(methods)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add payment method
app.post('/api/payment-methods', (req, res) => {
  const { name, allowed_types } = req.body
  try {
    const types = allowed_types || 'income,expense,settlement'
    const result = db.prepare('INSERT INTO payment_methods (name, allowed_types, is_active) VALUES (?, ?, 1)').run(name, types)
    res.json({ id: result.lastInsertRowid, message: 'Payment method added' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update payment method
app.put('/api/payment-methods/:id', (req, res) => {
  const { id } = req.params
  const { name, allowed_types } = req.body
  try {
    if (allowed_types !== undefined) {
      db.prepare('UPDATE payment_methods SET name = ?, allowed_types = ? WHERE id = ?').run(name, allowed_types, id)
    } else {
      db.prepare('UPDATE payment_methods SET name = ? WHERE id = ?').run(name, id)
    }
    res.json({ message: 'Payment method updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete payment method (soft delete)
app.delete('/api/payment-methods/:id', (req, res) => {
  const { id } = req.params
  try {
    db.prepare('UPDATE payment_methods SET is_active = 0 WHERE id = ?').run(id)
    res.json({ message: 'Payment method deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// DASHBOARD CONFIG APIs
// ============================================

// Get dashboard card config
app.get('/api/dashboard-config', (req, res) => {
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'dashboard_cards'").get()
    res.json(setting ? JSON.parse(setting.value) : {})
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update dashboard card config
app.put('/api/dashboard-config', (req, res) => {
  const { config } = req.body
  try {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'dashboard_cards'").run(JSON.stringify(config))
    res.json({ message: 'Dashboard config updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// QUANTITY UNITS APIs
// ============================================

// Get all quantity units
app.get('/api/quantity-units', (req, res) => {
  try {
    const units = db.prepare('SELECT * FROM quantity_units WHERE is_active = 1 ORDER BY sort_order, name').all()
    res.json(units)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add quantity unit
app.post('/api/quantity-units', (req, res) => {
  const { name, abbreviation } = req.body
  try {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM quantity_units').get()
    const result = db.prepare('INSERT INTO quantity_units (name, abbreviation, sort_order) VALUES (?, ?, ?)')
      .run(name, abbreviation, (maxOrder.max_order || 0) + 1)
    res.json({ id: result.lastInsertRowid, message: 'Unit added' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update quantity unit
app.put('/api/quantity-units/:id', (req, res) => {
  const { id } = req.params
  const { name, abbreviation } = req.body
  try {
    db.prepare('UPDATE quantity_units SET name = ?, abbreviation = ? WHERE id = ?')
      .run(name, abbreviation, id)
    res.json({ message: 'Unit updated' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete quantity unit (soft delete)
app.delete('/api/quantity-units/:id', (req, res) => {
  const { id } = req.params
  try {
    db.prepare('UPDATE quantity_units SET is_active = 0 WHERE id = ?').run(id)
    res.json({ message: 'Unit deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// WORKSPACES APIs
// ============================================

// Get all workspaces
app.get('/api/workspaces', (req, res) => {
  try {
    const workspaces = db.prepare('SELECT * FROM workspaces ORDER BY id').all()
    res.json(workspaces)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// RESET WORKSPACE
// ============================================

app.post('/api/reset-workspace', (req, res) => {
  const { workspace_id, password } = req.body
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id is required' })

  // Verify admin password
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password')
  if (!setting || setting.value !== password) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  try {
    // Delete all transactions for this workspace
    db.prepare('DELETE FROM transactions WHERE workspace_id = ?').run(workspace_id)

    // Delete fund transfers linked to funds in this workspace
    db.prepare(`
      DELETE FROM fund_transfers
      WHERE from_fund_id IN (SELECT id FROM funds WHERE workspace_id = ?)
         OR to_fund_id   IN (SELECT id FROM funds WHERE workspace_id = ?)
    `).run(workspace_id, workspace_id)

    // Delete fund reallocations linked to funds in this workspace
    db.prepare(`
      DELETE FROM fund_reallocations
      WHERE fund_id IN (SELECT id FROM funds WHERE workspace_id = ?)
    `).run(workspace_id)

    // Reset fund balances to 0
    db.prepare('UPDATE funds SET current_balance = 0 WHERE workspace_id = ?').run(workspace_id)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(``)
  console.log(`  ✓ FundPro API Server running`)
  console.log(`  → http://localhost:${PORT}`)
  console.log(``)
})
