import { useOutletContext, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { getDashboard, getTransactionsByCategory, getDashboardConfig, updateDashboardConfig, getFundsWithLocations } from '../services/api'
import AddTransactionModal from '../components/AddTransactionModal'
import DetailModal from '../components/DetailModal'
import './Dashboard.css'

// Chart colors
const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#6B7280']

// Format number as currency
const formatCurrency = (num) => {
  return 'Rs ' + (num || 0).toLocaleString()
}

// Format payment method as short label
const formatVia = (method) => {
  if (!method) return '—'
  if (method === 'Cash') return '💵 Cash'
  if (method.includes('Credit Card')) return '💳 ' + method.replace(' Credit Card', '')
  if (method === 'Receivable') return '📤 Receivable'
  if (method === 'Payable') return '📋 Payable'
  return '🏦 Bank'
}

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Dashboard() {
  const { workspace } = useOutletContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [detailModal, setDetailModal] = useState({ isOpen: false, title: '', icon: '', transactions: [], total: 0 })
  const [fridayHistoryOpen, setFridayHistoryOpen] = useState(false)
  const [visibleCards, setVisibleCards] = useState(null) // null = show all (config not loaded yet)
  const [fundsLocations, setFundsLocations] = useState([])

  const navigate = useNavigate()
  const isOffice = workspace === 'office'
  const isTreat = workspace === 'treat'
  const isPersonal = workspace === 'personal'

  // Keyboard shortcut: N = open Add Transaction modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'n' || e.key === 'N') {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        setShowModal(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Drag & drop state
  const [draggedCard, setDraggedCard] = useState(null)
  const [dragOverCard, setDragOverCard] = useState(null)
  const [dragOverSide, setDragOverSide] = useState(null) // 'before' | 'after'
  const [cardMenuOpen, setCardMenuOpen] = useState(null)
  const [cardCustom, setCardCustom] = useState({}) // { [cardKey]: { title, color } }
  const [cardSettingsKey, setCardSettingsKey] = useState(null) // which card is being customized
  const [tempTitle, setTempTitle] = useState('')
  const [tempColor, setTempColor] = useState('')
  const menuRef = useRef(null)

  const ACCENT_COLORS = ['green', 'blue', 'purple', 'orange', 'teal', 'red']

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setCardMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Save card order + customizations to config
  const saveCardConfig = useCallback(async (newOrder, newCustom) => {
    try {
      const config = await getDashboardConfig()
      config[workspace] = { cards: newOrder, custom: newCustom ?? cardCustom }
      await updateDashboardConfig(config)
      setVisibleCards(newOrder)
      if (newCustom !== undefined) setCardCustom(newCustom)
    } catch (err) {
      console.error('Failed to save card config:', err)
    }
  }, [workspace, cardCustom])

  // Drag handlers — side-aware insertion
  function handleDragStart(cardKey) {
    setDraggedCard(cardKey)
  }
  function handleDragOver(e, cardKey) {
    e.preventDefault()
    if (cardKey === draggedCard) return
    const rect = e.currentTarget.getBoundingClientRect()
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    setDragOverCard(cardKey)
    setDragOverSide(side)
  }
  function handleDragLeave(e) {
    // Only clear if we actually left the card-wrapper (not just moving within it)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCard(null)
      setDragOverSide(null)
    }
  }
  function handleDragEnd() {
    if (draggedCard && dragOverCard && visibleCards && draggedCard !== dragOverCard) {
      const newOrder = [...visibleCards]
      const fromIdx = newOrder.indexOf(draggedCard)
      const toIdx = newOrder.indexOf(dragOverCard)
      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1)
        // Recalculate toIdx after removal, then adjust for side
        const newToIdx = newOrder.indexOf(dragOverCard)
        const insertAt = dragOverSide === 'after' ? newToIdx + 1 : newToIdx
        newOrder.splice(insertAt, 0, draggedCard)
        saveCardConfig(newOrder)
      }
    }
    setDraggedCard(null)
    setDragOverCard(null)
    setDragOverSide(null)
  }

  // Card menu actions
  function handleHideCard(cardKey) {
    if (!visibleCards) return
    saveCardConfig(visibleCards.filter(k => k !== cardKey))
    setCardMenuOpen(null)
  }
  function handleMoveCard(cardKey, direction) {
    if (!visibleCards) return
    const newOrder = [...visibleCards]
    const idx = newOrder.indexOf(cardKey)
    if (idx === -1) return
    const newIdx = direction === 'left' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= newOrder.length) return
    ;[newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]]
    saveCardConfig(newOrder)
    setCardMenuOpen(null)
  }
  function openCardSettings(cardKey) {
    const custom = cardCustom[cardKey] || {}
    setTempTitle(custom.title || '')
    setTempColor(custom.color || '')
    setCardSettingsKey(cardKey)
    setCardMenuOpen(null)
  }
  function saveCardSettings() {
    const newCustom = { ...cardCustom }
    if (tempTitle || tempColor) {
      newCustom[cardSettingsKey] = { title: tempTitle || undefined, color: tempColor || undefined }
    } else {
      delete newCustom[cardSettingsKey]
    }
    saveCardConfig(visibleCards, newCustom)
    setCardSettingsKey(null)
  }
  function resetCardSettings() {
    const newCustom = { ...cardCustom }
    delete newCustom[cardSettingsKey]
    saveCardConfig(visibleCards, newCustom)
    setCardSettingsKey(null)
  }

  // Wrap a card with drag & 3-dots menu
  function CardWrapper({ cardKey, children }) {
    const isDragging = draggedCard === cardKey
    const isOver = dragOverCard === cardKey
    const overClass = isOver ? (dragOverSide === 'before' ? 'drag-over-before' : 'drag-over-after') : ''
    return (
      <div
        className={`card-wrapper ${isDragging ? 'dragging' : ''} ${overClass}`}
        draggable
        onDragStart={() => handleDragStart(cardKey)}
        onDragOver={(e) => handleDragOver(e, cardKey)}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
      >
        <div className="card-menu-container">
          <button
            className="card-menu-btn"
            onClick={(e) => { e.stopPropagation(); setCardMenuOpen(cardMenuOpen === cardKey ? null : cardKey) }}
            title="Card options"
          >
            &#8942;
          </button>
          {cardMenuOpen === cardKey && (
            <div className="card-menu-dropdown" ref={menuRef}>
              <button onClick={() => openCardSettings(cardKey)}>⚙ Customize</button>
              <div className="menu-divider" />
              <button onClick={() => handleMoveCard(cardKey, 'left')}>← Move Left</button>
              <button onClick={() => handleMoveCard(cardKey, 'right')}>→ Move Right</button>
              <div className="menu-divider" />
              <button onClick={() => handleHideCard(cardKey)} className="danger">✕ Hide Card</button>
            </div>
          )}
        </div>
        {children}
      </div>
    )
  }

  // Fetch dashboard data (and fundsLocations for personal)
  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const result = await getDashboard(workspace)
      setData(result)
      if (workspace === 'personal') {
        getFundsWithLocations('personal').then(setFundsLocations).catch(() => {})
      }
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch dashboard data and config when workspace changes
  useEffect(() => {
    fetchData()
    getDashboardConfig().then(config => {
      const raw = config[workspace]
      if (!raw) { setVisibleCards(null); return }
      // Support both old format (array) and new format ({ cards, custom })
      const saved = Array.isArray(raw) ? raw : (raw.cards || [])
      const custom = Array.isArray(raw) ? {} : (raw.custom || {})
      const systemCards = {
        office: ['totalBalance', 'thisMonthExpense', 'payable', 'cashOnHand', 'fridayBudget'],
        personal: ['totalBalance', 'thisMonthExpense', 'savingsFunds', 'receivables', 'creditCard'],
        treat: ['totalBalance', 'thisMonthExpense', 'totalCollected', 'thisMonthSpent', 'contributors']
      }
      const newCards = (systemCards[workspace] || []).filter(k => !saved.includes(k) && !k.startsWith('cat:'))
      setVisibleCards([...saved, ...newCards])
      setCardCustom(custom)
    }).catch(() => {})
  }, [workspace])

  // Open detail modal for a category (includes sub-categories)
  async function openDetailModal(categoryName, title, icon, total) {
    try {
      const transactions = await getTransactionsByCategory(categoryName, workspace)
      setDetailModal({
        isOpen: true,
        title,
        icon,
        transactions,
        total
      })
    } catch (err) {
      console.error('Failed to fetch category details:', err)
    }
  }

  // Close detail modal
  function closeDetailModal() {
    setDetailModal({ isOpen: false, title: '', icon: '', transactions: [], total: 0 })
  }

  // Show loading state
  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-state">Loading dashboard...</div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard">
        <div className="error-state">
          <p>Failed to load dashboard</p>
          <small>{error}</small>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const categoryData = (data?.categoryExpenses || []).map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length]
  }))

  const monthlyTrend = data?.monthlyTrend || []


  return (
    <div className="dashboard">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            {isOffice ? 'Office financial overview' : isTreat ? 'Team treat fund overview' : 'Personal financial overview'} • {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className="add-expense-btn" onClick={() => setShowModal(true)}>+ Add Transaction</button>
      </div>

      {/* Summary Cards - Ordered by config, draggable */}
      <div className="summary-cards">
        {(() => {
          // Define all card renderers — each accepts custom = { title, color }
          const cardRenderers = {
            totalBalance: (c = {}) => {
              if (isPersonal) {
                const primaryFund = fundsLocations.find(f => f.is_primary === 1) ||
                                    fundsLocations.find(f => f.name === 'Salary') ||
                                    data?.funds?.find(f => f.is_primary === 1) ||
                                    data?.funds?.find(f => f.name === 'Salary')
                const locations = (primaryFund && fundsLocations.find(f => f.id === primaryFund.id))?.locations || primaryFund?.locations || []
                const total = primaryFund?.current_balance ?? 0
                return (
                  <div className="card balance-card">
                    <div className="card-header">
                      <span className="card-icon green">💰</span>
                      <span className="card-title">{c.title || 'Salary Bucket'}</span>
                    </div>
                    <div className="card-value-large">{formatCurrency(total)}</div>
                    <div className="balance-breakdown">
                      {locations.length > 0 ? locations.map((loc, i) => (
                        <div key={i} className="breakdown-item">
                          <span className="breakdown-label">{loc.name === 'Bank Transfer' ? 'Bank' : loc.name}</span>
                          <span className="breakdown-value">{formatCurrency(loc.amount)}</span>
                        </div>
                      )) : (
                        <>
                          <div className="breakdown-item">
                            <span className="breakdown-label">Cash</span>
                            <span className="breakdown-value">{formatCurrency(data?.balance?.cash)}</span>
                          </div>
                          <div className="breakdown-item">
                            <span className="breakdown-label">Bank</span>
                            <span className="breakdown-value">{formatCurrency(data?.balance?.bank)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              }
              return (
                <div className="card balance-card">
                  <div className="card-header">
                    <span className="card-icon green">💰</span>
                    <span className="card-title">{c.title || 'Total Balance'}</span>
                  </div>
                  <div className="card-value-large">{formatCurrency(data?.balance?.total)}</div>
                  <div className="balance-breakdown">
                    <div className="breakdown-item">
                      <span className="breakdown-label">Cash</span>
                      <span className="breakdown-value">{formatCurrency(data?.balance?.cash)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Bank</span>
                      <span className="breakdown-value">{formatCurrency(data?.balance?.bank)}</span>
                    </div>
                  </div>
                </div>
              )
            },
            thisMonthExpense: (c = {}) => (
              <div className="card clickable"
                onClick={() => openDetailModal('__this_month__', 'This Month Expenses', '📅', data?.thisMonthExpense)}
              >
                <div className="card-header">
                  <span className={`card-icon ${c.color || 'blue'}`}>📅</span>
                  <span className="card-title">{c.title || 'This Month Expense'}</span>
                </div>
                <div className="card-value">{formatCurrency(data?.thisMonthExpense)}</div>
                <div className="card-trend negative">Current month total</div>
              </div>
            ),
            payable: (c = {}) => (
              <div className="card payable-card clickable"
                onClick={() => openDetailModal('__payable__', 'Payable Transactions', '📋', data?.balance?.payable)}
              >
                <div className="card-header">
                  <span className={`card-icon ${c.color || 'red'}`}>📋</span>
                  <span className="card-title">{c.title || 'Payable'}</span>
                </div>
                <div className="card-value payable">{formatCurrency(data?.balance?.payable)}</div>
                <div className="card-subtitle">{data?.balance?.payable > 0 ? 'Outstanding' : 'All settled'}</div>
              </div>
            ),
            cashOnHand: (c = {}) => (
              <div className="card clickable"
                onClick={() => openDetailModal('__cash__', 'Cash Transactions', '💵', data?.balance?.cash)}
              >
                <div className="card-header">
                  <span className={`card-icon ${c.color || 'purple'}`}>💵</span>
                  <span className="card-title">{c.title || 'Cash on Hand'}</span>
                </div>
                <div className="card-value">{formatCurrency(data?.balance?.cash)}</div>
                <div className="card-subtitle">Available balance</div>
              </div>
            ),
            savingsFunds: (c = {}) => {
              if (!isPersonal) return null
              const allFunds = fundsLocations.length > 0 ? fundsLocations : (data?.funds || [])
              const savingsOnly = allFunds.filter(f => !f.is_primary && f.name !== 'Salary')
              if (!savingsOnly.length) return null
              const savingsTotal = savingsOnly.reduce((sum, f) => sum + (f.current_balance || 0), 0)
              return (
                <div className="card fund-card">
                  <div className="card-header">
                    <span className={`card-icon ${c.color || 'purple'}`}>🏦</span>
                    <span className="card-title">{c.title || 'Savings Funds'}</span>
                  </div>
                  <div className="card-value">{formatCurrency(savingsTotal)}</div>
                  <div className="card-breakdown">
                    {savingsOnly.map((fund) => (
                      <div key={fund.id} className="fund-detail-item">
                        <div className="breakdown-item fund-name-row">
                          <span className="breakdown-label"><strong>{fund.name}</strong></span>
                          <span className={`breakdown-value ${fund.current_balance >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(fund.current_balance)}
                          </span>
                        </div>
                        {fund.locations?.length > 0 && (
                          <div className="fund-locations">
                            {fund.locations.map((loc, i) => (
                              <div key={i} className="fund-loc-row">
                                <span className="fund-loc-label">{loc.name === 'Bank Transfer' ? 'Bank' : loc.name}</span>
                                <span className={`fund-loc-val ${loc.amount >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(loc.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            },
            receivables: (c = {}) => (
              <div className="card clickable"
                onClick={() => openDetailModal('__receivable__', 'Money Owed to You', '📤', (data?.loansData?.outstanding || 0) + (data?.receivablesData?.total || 0))}
              >
                <div className="card-header">
                  <span className={`card-icon ${c.color || 'orange'}`}>📤</span>
                  <span className="card-title">{c.title || 'Receivables'}</span>
                </div>
                <div className="card-value">{formatCurrency((data?.loansData?.outstanding || 0) + (data?.receivablesData?.total || 0))}</div>
                {(data?.loansData?.byPerson?.length > 0 || data?.receivablesData?.byPerson?.length > 0) ? (
                  <div className="card-breakdown">
                    {(data?.loansData?.byPerson || []).filter(p => p.outstanding !== 0).map((p, i) => (
                      <div key={`loan-${i}`} className="breakdown-item">
                        <span className="breakdown-label">{p.name} (Loan)</span>
                        <span className="breakdown-value">{formatCurrency(p.outstanding)}</span>
                      </div>
                    ))}
                    {(data?.receivablesData?.byPerson || []).map((p, i) => (
                      <div key={`recv-${i}`} className="breakdown-item">
                        <span className="breakdown-label">{p.name} (Owed)</span>
                        <span className="breakdown-value">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card-subtitle">Loans & money owed to you</div>
                )}
              </div>
            ),
            creditCard: (c = {}) => (
              <div className="card clickable"
                onClick={() => openDetailModal('Credit Card Payments', 'Credit Card', '💳', data?.creditCardData?.outstanding)}
              >
                <div className="card-header">
                  <span className={`card-icon ${c.color || 'teal'}`}>💳</span>
                  <span className="card-title">{c.title || 'Credit Card'}</span>
                </div>
                <div className="card-value">{formatCurrency(data?.creditCardData?.outstanding)}</div>
                {data?.creditCardData?.byCard?.length > 0 ? (
                  <div className="card-breakdown">
                    {data.creditCardData.byCard.map((card, i) => (
                      <div key={i} className="breakdown-item">
                        <span className="breakdown-label">{card.name.replace(' Credit Card', '')}</span>
                        <span className="breakdown-value">{formatCurrency(card.outstanding)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card-subtitle">Outstanding liability</div>
                )}
              </div>
            ),
            fridayBudget: (c = {}) => {
              if (!isOffice) return null
              const fb = data?.fridayBudgetData
              if (!fb) return null
              const net = fb.netBalance
              const isPositive = net >= 0
              return (
                <div className="card clickable" onClick={() => setFridayHistoryOpen(true)}>
                  <div className="card-header">
                    <span className={`card-icon ${c.color || 'orange'}`}>🍽️</span>
                    <span className="card-title">{c.title || 'Friday Lunch'}</span>
                  </div>
                  <div className={`card-value ${isPositive ? 'positive-value' : 'payable'}`}>
                    {isPositive ? '+' : ''}{formatCurrency(net)}
                  </div>
                  <div className="card-breakdown">
                    <div className="breakdown-item">
                      <span className="breakdown-label">Budget ({fb.currentFridays} Fri × 8k)</span>
                      <span className="breakdown-value">{formatCurrency(fb.currentBudget)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Spent this month</span>
                      <span className="breakdown-value" style={{ color: fb.currentRemaining < 0 ? '#ef4444' : '#1e293b' }}>
                        {formatCurrency(fb.currentSpent)}
                      </span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Carry-forward</span>
                      <span className="breakdown-value" style={{ color: fb.carryForward < 0 ? '#ef4444' : '#10b981' }}>
                        {fb.carryForward >= 0 ? '+' : ''}{formatCurrency(fb.carryForward)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            },
            totalCollected: (c = {}) => {
              if (!isTreat) return null
              return (
                <div className="card clickable"
                  onClick={() => openDetailModal('__treat_income__', 'All Contributions', '💰', data?.balance?.total)}
                >
                  <div className="card-header">
                    <span className={`card-icon ${c.color || 'purple'}`}>💰</span>
                    <span className="card-title">{c.title || 'Total Collected'}</span>
                  </div>
                  <div className="card-value">{formatCurrency(data?.balance?.total || 0)}</div>
                  <div className="card-subtitle">All contributions</div>
                </div>
              )
            },
            thisMonthSpent: (c = {}) => {
              if (!isTreat) return null
              return (
                <div className="card clickable"
                  onClick={() => openDetailModal('__treat_expense__', 'All Treats', '🎂', data?.thisMonthExpense)}
                >
                  <div className="card-header">
                    <span className={`card-icon ${c.color || 'orange'}`}>🎂</span>
                    <span className="card-title">{c.title || 'This Month Spent'}</span>
                  </div>
                  <div className="card-value">{formatCurrency(data?.thisMonthExpense)}</div>
                  <div className="card-subtitle">Treats & celebrations</div>
                </div>
              )
            },
            contributors: (c = {}) => {
              if (!isTreat) return null
              return (
                <div className="card">
                  <div className="card-header">
                    <span className={`card-icon ${c.color || 'teal'}`}>👥</span>
                    <span className="card-title">{c.title || 'Contributors'}</span>
                  </div>
                  <div className="card-value">0</div>
                  <div className="card-subtitle">Team members</div>
                </div>
              )
            }
          }

          // Category card renderer
          function renderCategoryCard(key, c = {}) {
            const categoryName = key.replace('cat:', '')
            const catData = data?.categoryTotals?.[categoryName]
            if (!catData) return null
            return (
              <div className="card clickable"
                onClick={() => openDetailModal(categoryName, categoryName, '📊', catData.total)}
              >
                <div className="card-header">
                  <span className={`card-icon ${c.color || 'blue'}`}>📊</span>
                  <span className="card-title">{c.title || categoryName}</span>
                </div>
                <div className="card-value">{formatCurrency(catData.total)}</div>
                <div className="card-subtitle">
                  {catData.type === 'income' ? 'Total received' : catData.type === 'both' ? 'Total transactions' : 'Total spent'}
                </div>
              </div>
            )
          }

          // Determine card order
          const defaultCards = {
            office: ['totalBalance', 'thisMonthExpense', 'payable', 'cashOnHand', 'fridayBudget'],
            personal: ['totalBalance', 'thisMonthExpense', 'savingsFunds', 'receivables', 'creditCard'],
            treat: ['totalBalance', 'thisMonthExpense', 'totalCollected', 'thisMonthSpent', 'contributors']
          }
          const cardOrder = visibleCards || defaultCards[workspace] || defaultCards.office

          return cardOrder.map(key => {
            const custom = cardCustom[key] || {}
            const isCat = key.startsWith('cat:')
            const renderer = isCat ? () => renderCategoryCard(key, custom) : cardRenderers[key]
            if (!renderer) return null
            const content = isCat ? renderer() : renderer(custom)
            if (!content) return null
            return (
              <CardWrapper key={key} cardKey={key}>
                {content}
              </CardWrapper>
            )
          })
        })()}
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Monthly Expense Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyTrend} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip
                formatter={(value) => [formatCurrency(value), 'Amount']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="amount" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Expense by Category (All Time)</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {categoryData.map((item, index) => (
                  <div key={index} className="legend-item">
                    <span className="legend-color" style={{ background: item.color }}></span>
                    <span className="legend-label">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-data">No expense data for this month</div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="transactions-section">
        <div className="section-header">
          <h3>Recent Transactions</h3>
          <button className="view-all-btn" onClick={() => navigate('transactions')}>View All →</button>
        </div>
        {data?.recentTransactions?.length > 0 ? (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Via</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="date-cell">{formatDate(txn.date)}</td>
                  <td className="desc-cell">{txn.description}</td>
                  <td><span className="category-badge">{txn.category_name || 'Uncategorized'}</span></td>
                  <td className="via-cell">{formatVia(txn.payment_method)}</td>
                  <td className="amount-cell">{formatCurrency(txn.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">No transactions yet</div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        workspace={workspace}
        onSuccess={fetchData}
      />

      {/* Detail Modal */}
      <DetailModal
        isOpen={detailModal.isOpen}
        onClose={closeDetailModal}
        title={detailModal.title}
        icon={detailModal.icon}
        transactions={detailModal.transactions}
        total={detailModal.total}
      />

      {/* Card Customize Panel */}
      {cardSettingsKey && (
        <div className="modal-overlay" onClick={() => setCardSettingsKey(null)}>
          <div className="card-settings-panel" onClick={e => e.stopPropagation()}>
            <div className="cs-header">
              <span>⚙ Customize Card</span>
              <button className="friday-modal-close" onClick={() => setCardSettingsKey(null)}>✕</button>
            </div>
            <div className="cs-body">
              <div className="cs-field">
                <label className="cs-label">Title</label>
                <input
                  className="cs-input"
                  type="text"
                  placeholder="Use default title"
                  value={tempTitle}
                  onChange={e => setTempTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="cs-field">
                <label className="cs-label">Icon Color</label>
                <div className="cs-swatches">
                  {ACCENT_COLORS.map(col => (
                    <button
                      key={col}
                      className={`cs-swatch cs-swatch-${col} ${tempColor === col ? 'active' : ''}`}
                      onClick={() => setTempColor(tempColor === col ? '' : col)}
                      title={col}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="cs-footer">
              <button className="cs-btn-reset" onClick={resetCardSettings}>Reset to default</button>
              <button className="cs-btn-save" onClick={saveCardSettings}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Friday Budget History Modal */}
      {fridayHistoryOpen && data?.fridayBudgetData && (
        <div className="modal-overlay" onClick={() => setFridayHistoryOpen(false)}>
          <div className="friday-history-modal" onClick={e => e.stopPropagation()}>
            <div className="friday-modal-header">
              <span>🍽️ Friday Lunch — Month by Month</span>
              <button className="friday-modal-close" onClick={() => setFridayHistoryOpen(false)}>✕</button>
            </div>
            <div className="friday-modal-body">
              <table className="friday-history-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Fridays</th>
                    <th>Budget</th>
                    <th>Spent</th>
                    <th>+/−</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.fridayBudgetData.monthHistory || []).map((row) => (
                    <tr key={row.month} className={row.isCurrent ? 'current-month-row' : row.surplus >= 0 ? 'surplus-row' : 'deficit-row'}>
                      <td className="month-col">{row.month}{row.isCurrent ? ' ◀' : ''}</td>
                      <td className="center-col">{row.fridays}</td>
                      <td className="num-col">{formatCurrency(row.budget)}</td>
                      <td className="num-col">{formatCurrency(row.spent)}</td>
                      <td className={`num-col ${row.surplus >= 0 ? 'green-val' : 'red-val'}`}>
                        {row.surplus >= 0 ? '+' : ''}{formatCurrency(row.surplus)}
                      </td>
                      <td className={`num-col bold-col ${row.cumulative >= 0 ? 'green-val' : 'red-val'}`}>
                        {row.cumulative >= 0 ? '+' : ''}{formatCurrency(row.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="friday-modal-footer">
              Net Balance: <strong className={data.fridayBudgetData.netBalance >= 0 ? 'green-val' : 'red-val'}>
                {data.fridayBudgetData.netBalance >= 0 ? '+' : ''}{formatCurrency(data.fridayBudgetData.netBalance)}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
