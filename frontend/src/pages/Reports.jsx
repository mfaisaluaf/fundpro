import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { getReport, getTransactions, getCategories } from '../services/api'
import { showToast } from '../components/toast'
import { ShareIcon, DownloadIcon, CheckIcon } from '../components/icons'
import './Reports.css'

const Rs = n => 'Rs ' + (Math.round(n) || 0).toLocaleString()
const fmtDate = d => {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
const pct = (a, b) => b === 0 ? null : Math.round((a - b) / b * 100)
const pctLabel = (a, b) => {
  const v = pct(a, b)
  if (v === null) return '—'
  return (v >= 0 ? '+' : '') + v + '%'
}

const PIE_COLORS = [
  '#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6',
  '#06B6D4','#EC4899','#84CC16','#F97316','#6366F1',
  '#14B8A6','#F43F5E','#A78BFA','#FB923C','#34D399'
]

const TABS = [
  { id: 'monthly-summary',    label: '📊 Monthly Summary' },
  { id: 'category-breakdown', label: '🥧 By Category' },
  { id: 'period-comparison',  label: '📈 Period Compare' },
  { id: 'transaction-export', label: '📋 Export' },
  { id: 'payable-aging',      label: '⚠️ Payable Aging' },
  { id: 'person-summary',     label: '👥 Person Summary' },
]

// ── Date helpers ─────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10) }
function firstOfCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastOfCurrentMonth() {
  const d = new Date()
  const y = d.getFullYear(), m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}
function getLastMonthRange() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  const y = d.getFullYear(), m = d.getMonth() + 1
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to:   `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  }
}

// ── Custom Tooltip ────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rpt-tooltip">
      <p className="rpt-tt-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {Rs(p.value)}</p>
      ))}
    </div>
  )
}

// ── Reports Page ─────────────────────────────────────────────────
function Reports() {
  const { workspace } = useOutletContext()

  const [tab, setTab]             = useState('monthly-summary')
  const [dateFrom, setDateFrom]   = useState(firstOfCurrentMonth)
  const [dateTo, setDateTo]       = useState(lastOfCurrentMonth)
  const [cmpFrom, setCmpFrom]     = useState(() => getLastMonthRange().from)
  const [cmpTo, setCmpTo]         = useState(() => getLastMonthRange().to)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [shared, setShared]       = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  // Transaction export filters
  const [txnType, setTxnType]     = useState('')
  const [txnCatId, setTxnCatId]   = useState('')
  const [categories, setCategories] = useState([])

  // Load categories for export filter
  useEffect(() => {
    getCategories({ workspace, flat: 'true' }).then(setCategories).catch(() => {})
  }, [workspace])

  // ── Run report ───────────────────────────────────────────────
  const runReport = useCallback(async (overrides = {}) => {
    const from = overrides.dateFrom ?? dateFrom
    const to   = overrides.dateTo   ?? dateTo
    const cf   = overrides.cmpFrom  ?? cmpFrom
    const ct   = overrides.cmpTo    ?? cmpTo
    const ws   = workspace

    setLoading(true)
    setError(null)
    setData(null)

    try {
      if (tab === 'transaction-export') {
        const params = { workspace: ws, limit: 500 }
        if (from)     params.date_from   = from
        if (to)       params.date_to     = to
        if (txnType)  params.type        = txnType
        if (txnCatId) params.category    = txnCatId
        const txns = await getTransactions(params)
        setData({ transactions: txns, dateRange: { from, to } })
      } else {
        const params = { type: tab, workspace: ws }
        if (tab !== 'payable-aging') {
          params.date_from = from
          params.date_to   = to
        }
        if (tab === 'period-comparison') {
          params.compare_from = cf
          params.compare_to   = ct
        }
        const result = await getReport(params)
        setData(result)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab, workspace, dateFrom, dateTo, cmpFrom, cmpTo, txnType, txnCatId])

  // Auto-run on tab/workspace change
  useEffect(() => { runReport() }, [tab, workspace]) // eslint-disable-line

  // ── Date shortcuts ────────────────────────────────────────────
  function applyShortcut(from, to) {
    setDateFrom(from)
    setDateTo(to)
    runReport({ dateFrom: from, dateTo: to })
  }
  function shortcutThisMonth()  { applyShortcut(firstOfCurrentMonth(), lastOfCurrentMonth()) }
  function shortcutLastMonth()  { const { from, to } = getLastMonthRange(); applyShortcut(from, to) }
  function shortcutThisYear()   { const y = new Date().getFullYear(); applyShortcut(`${y}-01-01`, `${y}-12-31`) }
  function shortcutAllTime()    { applyShortcut('2020-01-01', todayStr()) }

  // ── Share ─────────────────────────────────────────────────────
  function handleShare() {
    const text = buildShareText()
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => { showToast('✓ Report copied to clipboard'); setShared(true); setTimeout(() => setShared(false), 2500) })
      .catch(() => showToast('Could not copy — try again', 'error'))
  }

  // ── Download CSV ──────────────────────────────────────────────
  function handleDownload() {
    const { csv, filename } = buildCSV()
    if (!csv) return
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    showToast('✓ CSV downloaded')
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2500)
  }

  // ── Share text builders ───────────────────────────────────────
  function buildShareText() {
    if (!data) return ''
    const sep = '──────────────────────────'
    const ws  = workspace.charAt(0).toUpperCase() + workspace.slice(1)

    if (tab === 'monthly-summary') {
      const { totals, byCategory, dateRange } = data
      const lines = [
        `📊 Monthly Summary — FundPro (${ws})`,
        `Period: ${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`,
        sep,
        `Income:   ${Rs(totals.income)}`,
        `Expense:  ${Rs(totals.expense)}`,
        `Net:      ${Rs(totals.income - totals.expense)}`,
        sep,
        'By Category (Top 10):',
        ...byCategory.slice(0, 10).map(c =>
          `  ${c.category.padEnd(20)} Exp: ${Rs(c.expense)}  Inc: ${Rs(c.income)}`
        )
      ]
      return lines.join('\n')
    }

    if (tab === 'category-breakdown') {
      const { categories: cats, totalExpense, dateRange } = data
      const lines = [
        `🥧 Category Breakdown — FundPro (${ws})`,
        `Period: ${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`,
        `Total Expense: ${Rs(totalExpense)}`,
        sep,
        ...cats.map(c => `  ${c.category.padEnd(22)} ${Rs(c.total).padStart(12)}  ${String(c.pct + '%').padStart(4)}`)
      ]
      return lines.join('\n')
    }

    if (tab === 'period-comparison') {
      const { periodA, periodB } = data
      const lines = [
        `📈 Period Comparison — FundPro (${ws})`,
        `Period A: ${fmtDate(periodA.from)} – ${fmtDate(periodA.to)}`,
        `Period B: ${fmtDate(periodB.from)} – ${fmtDate(periodB.to)}`,
        sep,
        `${''.padEnd(20)} ${'Period A'.padStart(12)} ${'Period B'.padStart(12)} ${'Change'.padStart(8)}`,
        `${'Income'.padEnd(20)} ${Rs(periodA.totals.income).padStart(12)} ${Rs(periodB.totals.income).padStart(12)} ${pctLabel(periodA.totals.income, periodB.totals.income).padStart(8)}`,
        `${'Expense'.padEnd(20)} ${Rs(periodA.totals.expense).padStart(12)} ${Rs(periodB.totals.expense).padStart(12)} ${pctLabel(periodA.totals.expense, periodB.totals.expense).padStart(8)}`,
        `${'Net'.padEnd(20)} ${Rs(periodA.totals.income - periodA.totals.expense).padStart(12)} ${Rs(periodB.totals.income - periodB.totals.expense).padStart(12)}`,
      ]
      return lines.join('\n')
    }

    if (tab === 'payable-aging') {
      const { people, totalOutstanding } = data
      const lines = [
        `⚠️ Payable Aging — FundPro (${ws})`,
        `Total Outstanding: ${Rs(totalOutstanding)}`,
        sep,
        ...people.map(p =>
          `  ${p.person_name.padEnd(18)} ${Rs(p.outstanding).padStart(12)}  (${p.days} days)`
        )
      ]
      return lines.join('\n')
    }

    if (tab === 'person-summary') {
      const { people, dateRange } = data
      const lines = [
        `👥 Person Summary — FundPro (${ws})`,
        `Period: ${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`,
        sep,
        ...people.map(p =>
          `  ${p.person_name.padEnd(18)} Payable: ${Rs(p.payable).padStart(10)}  Settled: ${Rs(p.settled).padStart(10)}  Net: ${Rs(p.payable - p.settled).padStart(10)}`
        )
      ]
      return lines.join('\n')
    }

    if (tab === 'transaction-export') {
      const { transactions: txns, dateRange } = data
      const lines = [
        `📋 Transaction Export — FundPro (${ws})`,
        `Period: ${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`,
        `Total: ${txns.length} transactions`,
        sep,
        ...txns.slice(0, 30).map(t =>
          `${fmtDate(t.date)}  ${t.description}  ${Rs(t.amount)}`
        )
      ]
      return lines.join('\n')
    }

    return ''
  }

  // ── CSV builders ──────────────────────────────────────────────
  function buildCSV() {
    if (!data) return { csv: '', filename: 'report.csv' }
    const ws = workspace

    function row(cells) {
      return cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    }

    if (tab === 'monthly-summary') {
      const rows = [
        row(['Category', 'Income', 'Expense']),
        ...data.byCategory.map(c => row([c.category, c.income, c.expense])),
        row(['']),
        row(['Month', 'Income', 'Expense']),
        ...data.monthly.map(m => row([m.month, m.income, m.expense])),
      ]
      return { csv: rows.join('\n'), filename: `${ws}-monthly-summary.csv` }
    }

    if (tab === 'category-breakdown') {
      const rows = [
        row(['Category', 'Amount', 'Transactions', '%']),
        ...data.categories.map(c => row([c.category, c.total, c.txn_count, c.pct + '%']))
      ]
      return { csv: rows.join('\n'), filename: `${ws}-category-breakdown.csv` }
    }

    if (tab === 'period-comparison') {
      const { periodA, periodB } = data
      const allCats = [...new Set([
        ...periodA.byCategory.map(c => c.category),
        ...periodB.byCategory.map(c => c.category)
      ])]
      const getAmt = (cats, name, field) => {
        const found = cats.find(c => c.category === name)
        return found ? found[field] : 0
      }
      const rows = [
        row(['Category', 'Period A Income', 'Period A Expense', 'Period B Income', 'Period B Expense', 'Expense Change']),
        ...allCats.map(cat => {
          const ai = getAmt(periodA.byCategory, cat, 'income')
          const ae = getAmt(periodA.byCategory, cat, 'expense')
          const bi = getAmt(periodB.byCategory, cat, 'income')
          const be = getAmt(periodB.byCategory, cat, 'expense')
          return row([cat, ai, ae, bi, be, pctLabel(ae, be)])
        })
      ]
      return { csv: rows.join('\n'), filename: `${ws}-period-comparison.csv` }
    }

    if (tab === 'payable-aging') {
      const rows = [
        row(['Person', 'Total Payable', 'Total Settled', 'Outstanding', 'Oldest Date', 'Days']),
        ...data.people.map(p => row([p.person_name, p.total_payable, p.total_settled, p.outstanding, p.oldest_date, p.days]))
      ]
      return { csv: rows.join('\n'), filename: `${ws}-payable-aging.csv` }
    }

    if (tab === 'person-summary') {
      const rows = [
        row(['Person', 'Transactions', 'Payable', 'Settled', 'Receivable', 'Net Payable']),
        ...data.people.map(p => row([p.person_name, p.txn_count, p.payable, p.settled, p.receivable, p.payable - p.settled]))
      ]
      return { csv: rows.join('\n'), filename: `${ws}-person-summary.csv` }
    }

    if (tab === 'transaction-export') {
      const rows = [
        row(['Date', 'Type', 'Category', 'Description', 'Person', 'Payment Method', 'Amount']),
        ...data.transactions.map(t => row([
          t.date, t.type, t.category_name || '', t.description, t.person_name || '', t.payment_method || '', t.amount
        ]))
      ]
      return { csv: rows.join('\n'), filename: `${ws}-transactions.csv` }
    }

    return { csv: '', filename: 'report.csv' }
  }

  // ── Render helpers ────────────────────────────────────────────
  function renderMonthlySummary(d) {
    const net = d.totals.income - d.totals.expense
    return (
      <>
        <div className="rpt-stat-row">
          <div className="rpt-stat rpt-stat-income">
            <span className="rpt-stat-label">Total Income</span>
            <span className="rpt-stat-value">{Rs(d.totals.income)}</span>
          </div>
          <div className="rpt-stat rpt-stat-expense">
            <span className="rpt-stat-label">Total Expense</span>
            <span className="rpt-stat-value">{Rs(d.totals.expense)}</span>
          </div>
          <div className={`rpt-stat ${net >= 0 ? 'rpt-stat-net-pos' : 'rpt-stat-net-neg'}`}>
            <span className="rpt-stat-label">Net {net >= 0 ? 'Surplus' : 'Deficit'}</span>
            <span className="rpt-stat-value">{Rs(Math.abs(net))}</span>
          </div>
          {d.totals.settlement > 0 && (
            <div className="rpt-stat rpt-stat-settle">
              <span className="rpt-stat-label">Settlements Paid</span>
              <span className="rpt-stat-value">{Rs(d.totals.settlement)}</span>
            </div>
          )}
        </div>

        {d.monthly.length > 0 && (
          <div className="rpt-card">
            <h3 className="rpt-card-title">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.monthly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => 'Rs ' + (v/1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} width={70} />
                <Tooltip content={<BarTooltip />} />
                <Legend />
                <Bar dataKey="income"  name="Income"  fill="#10B981" radius={[3,3,0,0]} />
                <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="rpt-card">
          <h3 className="rpt-card-title">By Category</h3>
          <table className="rpt-table">
            <thead>
              <tr><th>Category</th><th className="num">Income</th><th className="num">Expense</th><th className="num">Net</th></tr>
            </thead>
            <tbody>
              {d.byCategory.map((c, i) => (
                <tr key={i}>
                  <td>{c.category}</td>
                  <td className="num income-cell">{c.income > 0 ? Rs(c.income) : '—'}</td>
                  <td className="num expense-cell">{c.expense > 0 ? Rs(c.expense) : '—'}</td>
                  <td className={`num ${c.income - c.expense >= 0 ? 'income-cell' : 'expense-cell'}`}>
                    {Rs(c.income - c.expense)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {d.byMethod.length > 0 && (
          <div className="rpt-card">
            <h3 className="rpt-card-title">By Payment Method</h3>
            <table className="rpt-table">
              <thead>
                <tr><th>Method</th><th className="num">Income</th><th className="num">Expense</th></tr>
              </thead>
              <tbody>
                {d.byMethod.map((m, i) => (
                  <tr key={i}>
                    <td>{m.payment_method}</td>
                    <td className="num income-cell">{m.income > 0 ? Rs(m.income) : '—'}</td>
                    <td className="num expense-cell">{m.expense > 0 ? Rs(m.expense) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  function renderCategoryBreakdown(d) {
    const top10 = d.categories.slice(0, 10)
    return (
      <>
        <div className="rpt-stat-row">
          <div className="rpt-stat rpt-stat-expense">
            <span className="rpt-stat-label">Total Expense</span>
            <span className="rpt-stat-value">{Rs(d.totalExpense)}</span>
          </div>
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">Categories</span>
            <span className="rpt-stat-value">{d.categories.length}</span>
          </div>
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">Transactions</span>
            <span className="rpt-stat-value">{d.categories.reduce((s, c) => s + c.txn_count, 0)}</span>
          </div>
        </div>

        <div className="rpt-two-col">
          <div className="rpt-card">
            <h3 className="rpt-card-title">Top 10 Categories</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={top10} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, pct: p }) => p >= 5 ? `${p}%` : ''}>
                  {top10.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => Rs(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rpt-card">
            <h3 className="rpt-card-title">Breakdown</h3>
            <table className="rpt-table">
              <thead>
                <tr><th>#</th><th>Category</th><th className="num">Amount</th><th className="num">%</th><th className="num">Txns</th></tr>
              </thead>
              <tbody>
                {d.categories.map((c, i) => (
                  <tr key={i}>
                    <td className="rank-cell">
                      <span className="rank-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </td>
                    <td>{c.category}</td>
                    <td className="num expense-cell">{Rs(c.total)}</td>
                    <td className="num">
                      <div className="pct-bar-wrap">
                        <div className="pct-bar" style={{ width: c.pct + '%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span>{c.pct}%</span>
                      </div>
                    </td>
                    <td className="num muted">{c.txn_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  function renderPeriodComparison(d) {
    const { periodA, periodB } = d
    const netA = periodA.totals.income - periodA.totals.expense
    const netB = periodB.totals.income - periodB.totals.expense

    // Build merged category list
    const allCats = [...new Set([
      ...periodA.byCategory.map(c => c.category),
      ...periodB.byCategory.map(c => c.category)
    ])]
    const getVal = (cats, name, field) => cats.find(c => c.category === name)?.[field] || 0

    const chartData = allCats.slice(0, 10).map(cat => ({
      category: cat,
      'Period A': getVal(periodA.byCategory, cat, 'expense'),
      'Period B': getVal(periodB.byCategory, cat, 'expense'),
    })).sort((a, b) => (b['Period A'] + b['Period B']) - (a['Period A'] + a['Period B']))

    return (
      <>
        <div className="rpt-stat-row">
          {[
            { label: 'Period A Income',  a: periodA.totals.income,  b: periodB.totals.income },
            { label: 'Period A Expense', a: periodA.totals.expense, b: periodB.totals.expense },
            { label: 'Period A Net',     a: netA,                   b: netB },
          ].map((s, i) => (
            <div key={i} className="rpt-stat rpt-stat-compare">
              <span className="rpt-stat-label">{s.label}</span>
              <span className="rpt-stat-value">{Rs(s.a)}</span>
              <span className="rpt-stat-sub">
                vs {Rs(s.b)} <span className={pct(s.a, s.b) > 0 ? 'pct-up' : pct(s.a, s.b) < 0 ? 'pct-down' : ''}>
                  {pctLabel(s.a, s.b)}
                </span>
              </span>
            </div>
          ))}
        </div>

        {chartData.length > 0 && (
          <div className="rpt-card">
            <h3 className="rpt-card-title">Expense by Category — Period A vs B</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 90, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tickFormatter={v => Rs(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={88} />
                <Tooltip content={<BarTooltip />} />
                <Legend />
                <Bar dataKey="Period A" fill="#10B981" radius={[0,3,3,0]} />
                <Bar dataKey="Period B" fill="#94a3b8" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="rpt-card">
          <h3 className="rpt-card-title">Category Detail</h3>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Period A Exp</th>
                <th className="num">Period B Exp</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {allCats.map((cat, i) => {
                const ae = getVal(periodA.byCategory, cat, 'expense')
                const be = getVal(periodB.byCategory, cat, 'expense')
                const diff = pct(ae, be)
                return (
                  <tr key={i}>
                    <td>{cat}</td>
                    <td className="num expense-cell">{ae > 0 ? Rs(ae) : '—'}</td>
                    <td className="num muted">{be > 0 ? Rs(be) : '—'}</td>
                    <td className={`num ${diff > 0 ? 'pct-up' : diff < 0 ? 'pct-down' : ''}`}>
                      {pctLabel(ae, be)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderTransactionExport(d) {
    const txns = d.transactions
    return (
      <>
        <div className="rpt-stat-row">
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">Total Transactions</span>
            <span className="rpt-stat-value">{txns.length}</span>
          </div>
          <div className="rpt-stat rpt-stat-income">
            <span className="rpt-stat-label">Total Income</span>
            <span className="rpt-stat-value">{Rs(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}</span>
          </div>
          <div className="rpt-stat rpt-stat-expense">
            <span className="rpt-stat-label">Total Expense</span>
            <span className="rpt-stat-value">{Rs(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</span>
          </div>
        </div>

        <div className="rpt-card">
          <div className="rpt-card-header">
            <h3 className="rpt-card-title">Transactions</h3>
            <span className="rpt-count">{txns.length} rows</span>
          </div>
          {txns.length === 0 ? (
            <div className="rpt-empty">No transactions found for this date range</div>
          ) : (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Person</th><th>Via</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {txns.map((t, i) => (
                    <tr key={i}>
                      <td className="date-cell">{fmtDate(t.date)}</td>
                      <td><span className={`txn-badge txn-${t.type}`}>{t.type}</span></td>
                      <td className="muted">{t.category_name || '—'}</td>
                      <td>{t.description}</td>
                      <td className="muted">{t.person_name || '—'}</td>
                      <td className="muted">{t.payment_method || '—'}</td>
                      <td className={`num ${t.type === 'income' ? 'income-cell' : 'expense-cell'}`}>{Rs(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    )
  }

  function renderPayableAging(d) {
    const agingClass = days => days > 90 ? 'aging-critical' : days > 30 ? 'aging-warn' : 'aging-ok'
    return (
      <>
        <div className="rpt-stat-row">
          <div className="rpt-stat rpt-stat-expense">
            <span className="rpt-stat-label">Total Outstanding</span>
            <span className="rpt-stat-value">{Rs(d.totalOutstanding)}</span>
          </div>
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">People with Payables</span>
            <span className="rpt-stat-value">{d.people.length}</span>
          </div>
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">Oldest Entry</span>
            <span className="rpt-stat-value">
              {d.people.length > 0 ? fmtDate(d.people.sort((a,b) => b.days - a.days)[0]?.oldest_date) : '—'}
            </span>
          </div>
        </div>

        <div className="rpt-info-note">
          ℹ️ Shows all outstanding payable balances (all time). Pay off oldest entries first.
        </div>

        <div className="rpt-card">
          <h3 className="rpt-card-title">Outstanding Payables by Person</h3>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Person</th>
                <th className="num">Total Payable</th>
                <th className="num">Total Settled</th>
                <th className="num">Outstanding</th>
                <th>Oldest Date</th>
                <th className="num">Age (days)</th>
              </tr>
            </thead>
            <tbody>
              {d.people.map((p, i) => (
                <tr key={i} className={agingClass(p.days)}>
                  <td className="fw-med">{p.person_name}</td>
                  <td className="num">{Rs(p.total_payable)}</td>
                  <td className="num income-cell">{Rs(p.total_settled)}</td>
                  <td className="num expense-cell fw-med">{Rs(p.outstanding)}</td>
                  <td className="muted">{fmtDate(p.oldest_date)}</td>
                  <td className={`num aging-days ${agingClass(p.days)}`}>{p.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="aging-legend">
            <span className="aging-ok-dot" /> &lt;30 days &nbsp;
            <span className="aging-warn-dot" /> 30–90 days &nbsp;
            <span className="aging-critical-dot" /> &gt;90 days
          </div>
        </div>
      </>
    )
  }

  function renderPersonSummary(d) {
    return (
      <>
        <div className="rpt-stat-row">
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">People</span>
            <span className="rpt-stat-value">{d.people.length}</span>
          </div>
          <div className="rpt-stat rpt-stat-expense">
            <span className="rpt-stat-label">Total Payable</span>
            <span className="rpt-stat-value">{Rs(d.people.reduce((s, p) => s + p.payable, 0))}</span>
          </div>
          <div className="rpt-stat rpt-stat-income">
            <span className="rpt-stat-label">Total Settled</span>
            <span className="rpt-stat-value">{Rs(d.people.reduce((s, p) => s + p.settled, 0))}</span>
          </div>
          <div className="rpt-stat rpt-stat-neutral">
            <span className="rpt-stat-label">Total Receivable</span>
            <span className="rpt-stat-value">{Rs(d.people.reduce((s, p) => s + p.receivable, 0))}</span>
          </div>
        </div>

        <div className="rpt-card">
          <h3 className="rpt-card-title">Person-wise Summary</h3>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Person</th>
                <th className="num">Payable</th>
                <th className="num">Settled</th>
                <th className="num">Net Payable</th>
                <th className="num">Receivable</th>
                <th className="num">Txns</th>
              </tr>
            </thead>
            <tbody>
              {d.people.map((p, i) => {
                const net = p.payable - p.settled
                return (
                  <tr key={i}>
                    <td className="fw-med">{p.person_name}</td>
                    <td className="num expense-cell">{p.payable > 0 ? Rs(p.payable) : '—'}</td>
                    <td className="num income-cell">{p.settled > 0 ? Rs(p.settled) : '—'}</td>
                    <td className={`num fw-med ${net > 0 ? 'expense-cell' : 'income-cell'}`}>
                      {net !== 0 ? Rs(Math.abs(net)) : '—'}
                    </td>
                    <td className="num">{p.receivable > 0 ? Rs(p.receivable) : '—'}</td>
                    <td className="num muted">{p.txn_count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderReport() {
    if (loading) return <div className="rpt-loading"><div className="rpt-spinner" />Loading report…</div>
    if (error)   return <div className="rpt-error">Error: {error}</div>
    if (!data)   return null

    if (tab === 'monthly-summary')    return renderMonthlySummary(data)
    if (tab === 'category-breakdown') return renderCategoryBreakdown(data)
    if (tab === 'period-comparison')  return renderPeriodComparison(data)
    if (tab === 'transaction-export') return renderTransactionExport(data)
    if (tab === 'payable-aging')      return renderPayableAging(data)
    if (tab === 'person-summary')     return renderPersonSummary(data)
    return null
  }

  // ── Workspace label ───────────────────────────────────────────
  const wsBadge = { office: '🏢 Office', personal: '👤 Personal', treat: '🎉 Treat' }[workspace]

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="rpt-header">
        <div className="rpt-header-left">
          <h1>Reports</h1>
          <span className="rpt-ws-badge">{wsBadge}</span>
        </div>
        <div className="rpt-header-actions">
          {data && (
            <>
              <button className={`rpt-action-btn ${shared ? 'done' : ''}`} onClick={handleShare} title="Copy report to clipboard">
                {shared ? <CheckIcon size={15} /> : <ShareIcon size={15} />}
                <span>Share</span>
              </button>
              <button className={`rpt-action-btn ${downloaded ? 'done' : ''}`} onClick={handleDownload} title="Download CSV">
                {downloaded ? <CheckIcon size={15} /> : <DownloadIcon size={15} />}
                <span>CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="rpt-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`rpt-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setData(null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date controls */}
      <div className="rpt-controls">
        {tab !== 'payable-aging' ? (
          <div className="rpt-date-row">
            <div className="rpt-date-inputs">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="rpt-shortcuts">
              <button onClick={shortcutThisMonth}>This Month</button>
              <button onClick={shortcutLastMonth}>Last Month</button>
              <button onClick={shortcutThisYear}>This Year</button>
              <button onClick={shortcutAllTime}>All Time</button>
            </div>
            {tab === 'period-comparison' && (
              <div className="rpt-compare-row">
                <label className="rpt-cmp-label">Compare to:</label>
                <input type="date" value={cmpFrom} onChange={e => setCmpFrom(e.target.value)} />
                <span>—</span>
                <input type="date" value={cmpTo}   onChange={e => setCmpTo(e.target.value)} />
              </div>
            )}
            {tab === 'transaction-export' && (
              <div className="rpt-export-filters">
                <select value={txnType} onChange={e => setTxnType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="settlement">Settlement</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select value={txnCatId} onChange={e => setTxnCatId(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="rpt-run-btn" onClick={() => runReport()}>Run Report</button>
          </div>
        ) : (
          <div className="rpt-date-row">
            <span className="rpt-info-text">All outstanding payables (all time)</span>
            <button className="rpt-run-btn" onClick={() => runReport()}>Refresh</button>
          </div>
        )}
      </div>

      {/* Report output */}
      <div className="rpt-output">
        {renderReport()}
      </div>
    </div>
  )
}

export default Reports
