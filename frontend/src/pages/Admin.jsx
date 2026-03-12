import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  getPeople, addPerson, updatePerson, deletePerson,
  getCategories, addCategory, updateCategory, deleteCategory,
  getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  getDashboardConfig, updateDashboardConfig,
  getFunds, addFund, updateFund, deleteFund,
  getQuantityUnits, addQuantityUnit, updateQuantityUnit, deleteQuantityUnit,
  getFundsWithLocations, createFundTransfer, createFundReallocation,
  getFundTransfers, getFundReallocations,
  getSettings, updateSetting, resetWorkspace
} from '../services/api'
import PasswordConfirmModal from '../components/PasswordConfirmModal'
import './Admin.css'

// Built-in system cards per workspace (all available cards per workspace)
const BUILTIN_CARDS = {
  office: [
    { key: 'totalBalance', label: 'Total Balance' },
    { key: 'thisMonthExpense', label: 'This Month Expense' },
    { key: 'payable', label: 'Payable' },
    { key: 'receivables', label: 'Receivables' },
    { key: 'cashOnHand', label: 'Cash on Hand' },
    { key: 'creditCard', label: 'Credit Card' }
  ],
  personal: [
    { key: 'totalBalance', label: 'Total Balance' },
    { key: 'thisMonthExpense', label: 'This Month Expense' },
    { key: 'savingsFunds', label: 'Savings Funds' },
    { key: 'receivables', label: 'Receivables (Loans + Owed)' },
    { key: 'creditCard', label: 'Credit Card' },
    { key: 'payable', label: 'Payable' },
    { key: 'cashOnHand', label: 'Cash on Hand' }
  ],
  treat: [
    { key: 'totalBalance', label: 'Total Balance' },
    { key: 'thisMonthExpense', label: 'This Month Expense' },
    { key: 'totalCollected', label: 'Total Collected' },
    { key: 'thisMonthSpent', label: 'This Month Spent' },
    { key: 'contributors', label: 'Contributors' },
    { key: 'payable', label: 'Payable' },
    { key: 'cashOnHand', label: 'Cash on Hand' }
  ]
}

// Tabs with workspace visibility
const ALL_TABS = [
  { key: 'categories', label: 'Categories', workspaces: ['office', 'personal', 'treat'] },
  { key: 'people', label: 'People', workspaces: ['office', 'personal', 'treat'] },
  { key: 'payment-methods', label: 'Payment Methods', workspaces: ['office', 'personal', 'treat'] },
  { key: 'savings-funds', label: 'Savings Funds', workspaces: ['personal'] },
  { key: 'quantity-units', label: 'Quantity Units', workspaces: ['personal', 'treat'] },
  { key: 'settings', label: 'Settings', workspaces: ['office', 'personal', 'treat'] }
]

function Admin() {
  const { workspace } = useOutletContext()
  const [activeTab, setActiveTab] = useState('categories')
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [savingsFunds, setSavingsFunds] = useState([])
  const [quantityUnits, setQuantityUnits] = useState([])
  const [dashboardConfig, setDashboardConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Search
  const [searchTerm, setSearchTerm] = useState('')

  // New person form
  const [newPerson, setNewPerson] = useState({ name: '', type: 'employee', phone: '', notes: '' })

  // New category form
  const workspaceId = workspace === 'office' ? 1 : workspace === 'personal' ? 2 : 3
  const [newCategory, setNewCategory] = useState({ name: '', type: 'expense', workspace_id: workspaceId, parent_id: '' })
  const [addMode, setAddMode] = useState('main') // 'main' or 'sub'

  // New payment method
  const [newMethod, setNewMethod] = useState('')

  // New savings fund
  const [newFund, setNewFund] = useState({ name: '', description: '' })

  // New quantity unit
  const [newUnit, setNewUnit] = useState({ name: '', abbreviation: '' })

  // Fund transfers & reallocations
  const [fundsWithLocations, setFundsWithLocations] = useState([])
  const [fundTransfers, setFundTransfers] = useState([])
  const [fundReallocations, setFundReallocations] = useState([])
  const [newTransfer, setNewTransfer] = useState({ from_fund_id: '', to_fund_id: '', amount: '', location: 'Bank', notes: '', date: new Date().toISOString().slice(0, 10) })
  const [newReallocation, setNewReallocation] = useState({ fund_id: '', from_location: '', to_location: '', amount: '', notes: '', date: new Date().toISOString().slice(0, 10) })
  const [fundSubTab, setFundSubTab] = useState('overview') // overview, transfer, reallocate, history

  // General settings
  const [generalSettings, setGeneralSettings] = useState({ currency: 'Rs', date_format: 'DD/MM/YYYY', admin_password: '' })
  const [showPassword, setShowPassword] = useState(false)

  // Edit states
  const [editingPerson, setEditingPerson] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingMethod, setEditingMethod] = useState(null)
  const [editingFund, setEditingFund] = useState(null)
  const [editingUnit, setEditingUnit] = useState(null)

  // Pending allowed_types changes (not yet saved)
  const [pendingCategoryTypes, setPendingCategoryTypes] = useState({}) // { [id]: 'income,expense,...' }
  const [pendingMethodTypes, setPendingMethodTypes] = useState({})     // { [id]: 'income,expense,...' }
  const [pendingDashboardConfig, setPendingDashboardConfig] = useState(null) // null = no changes
  const [pendingSettings, setPendingSettings] = useState({})           // { key: value }
  const [showResetModal, setShowResetModal] = useState(false)

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [activeTab, workspace])

  // Update newCategory workspace when workspace changes + reset tab if not available
  useEffect(() => {
    setNewCategory(prev => ({ ...prev, workspace_id: workspaceId }))
    const availableTabs = ALL_TABS.filter(t => t.workspaces.includes(workspace))
    if (!availableTabs.find(t => t.key === activeTab)) {
      setActiveTab('categories')
    }
  }, [workspaceId, workspace])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'people') {
        const data = await getPeople()
        setPeople(data)
      } else if (activeTab === 'categories') {
        const data = await getCategories({ workspace, flat: 'true' })
        setCategories(data)
      } else if (activeTab === 'payment-methods') {
        const data = await getPaymentMethods()
        setPaymentMethods(data)
      } else if (activeTab === 'savings-funds') {
        const data = await getFunds('personal')
        setSavingsFunds(data)
        const locData = await getFundsWithLocations('personal')
        setFundsWithLocations(locData)
        const transfers = await getFundTransfers()
        setFundTransfers(transfers)
        const reallocs = await getFundReallocations()
        setFundReallocations(reallocs)
      } else if (activeTab === 'quantity-units') {
        const data = await getQuantityUnits()
        setQuantityUnits(data)
      } else if (activeTab === 'settings') {
        const config = await getDashboardConfig()
        setDashboardConfig(config)
        const settings = await getSettings()
        setGeneralSettings({
          currency: settings.currency || 'Rs',
          date_format: settings.date_format || 'DD/MM/YYYY',
          admin_password: settings.admin_password || ''
        })
        // Load categories for card toggle section
        const cats = await getCategories({ workspace, flat: 'true' })
        setCategories(cats)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 2000)
  }

  // Format currency
  const formatCurrency = (num) => 'Rs ' + (num || 0).toLocaleString()

  // ---- PEOPLE HANDLERS ----
  async function handleAddPerson(e) {
    e.preventDefault()
    if (!newPerson.name.trim()) return
    try {
      await addPerson(newPerson)
      setNewPerson({ name: '', type: 'employee', phone: '', notes: '' })
      showSuccess('Person added')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleUpdatePerson(person) {
    try {
      await updatePerson(person.id, { name: person.name, type: person.type, phone: person.phone, notes: person.notes })
      setEditingPerson(null)
      showSuccess('Person updated')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleDeletePerson(id) {
    if (!confirm('Delete this person?')) return
    try {
      await deletePerson(id)
      showSuccess('Person deleted')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- CATEGORY HANDLERS ----
  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategory.name.trim()) return
    try {
      await addCategory({
        ...newCategory,
        parent_id: addMode === 'sub' ? (newCategory.parent_id || null) : null
      })
      setNewCategory({ name: '', type: 'expense', workspace_id: workspaceId, parent_id: '' })
      showSuccess('Category added')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleUpdateCategory(cat) {
    try {
      await updateCategory(cat.id, { name: cat.name, type: cat.type, icon: cat.icon, is_active: cat.is_active, parent_id: cat.parent_id })
      setEditingCategory(null)
      showSuccess('Category updated')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category?')) return
    try {
      await deleteCategory(id)
      showSuccess('Category deleted')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // Toggle a type for a category (marks as pending — requires Save)
  function handleToggleCategoryType(cat, type) {
    const currentTypes = pendingCategoryTypes[cat.id] !== undefined
      ? pendingCategoryTypes[cat.id]
      : (cat.allowed_types || '')
    const current = currentTypes.split(',').filter(Boolean)
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    setPendingCategoryTypes(prev => ({ ...prev, [cat.id]: updated.join(',') }))
  }

  // Save all pending category allowed_types changes
  async function handleSaveCategoryTypes() {
    const ids = Object.keys(pendingCategoryTypes)
    if (ids.length === 0) return
    try {
      for (const id of ids) {
        const cat = categories.find(c => c.id === parseInt(id))
        if (cat) {
          await updateCategory(cat.id, { name: cat.name, type: cat.type, icon: cat.icon, is_active: cat.is_active, parent_id: cat.parent_id, allowed_types: pendingCategoryTypes[id] })
        }
      }
      setPendingCategoryTypes({})
      showSuccess('Category types saved')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- PAYMENT METHOD HANDLERS ----
  async function handleAddMethod(e) {
    e.preventDefault()
    if (!newMethod.trim()) return
    try {
      await addPaymentMethod({ name: newMethod })
      setNewMethod('')
      showSuccess('Payment method added')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleUpdateMethod(method) {
    try {
      await updatePaymentMethod(method.id, { name: method.name, allowed_types: method.allowed_types })
      setEditingMethod(null)
      showSuccess('Payment method updated')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // Toggle a type for a payment method (marks as pending — requires Save)
  function handleToggleMethodType(method, type) {
    const currentTypes = pendingMethodTypes[method.id] !== undefined
      ? pendingMethodTypes[method.id]
      : (method.allowed_types || '')
    const current = currentTypes.split(',').filter(Boolean)
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    setPendingMethodTypes(prev => ({ ...prev, [method.id]: updated.join(',') }))
  }

  // Save all pending payment method allowed_types changes
  async function handleSaveMethodTypes() {
    const ids = Object.keys(pendingMethodTypes)
    if (ids.length === 0) return
    try {
      for (const id of ids) {
        const method = paymentMethods.find(m => m.id === parseInt(id))
        if (method) {
          await updatePaymentMethod(method.id, { name: method.name, allowed_types: pendingMethodTypes[id] })
        }
      }
      setPendingMethodTypes({})
      showSuccess('Payment method types saved')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleDeleteMethod(id) {
    if (!confirm('Delete this payment method?')) return
    try {
      await deletePaymentMethod(id)
      showSuccess('Payment method deleted')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- SAVINGS FUND HANDLERS ----
  async function handleAddFund(e) {
    e.preventDefault()
    if (!newFund.name.trim()) return
    try {
      await addFund({ name: newFund.name, description: newFund.description, workspace_id: 2 })
      setNewFund({ name: '', description: '' })
      showSuccess('Savings fund added')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleUpdateFund(fund) {
    try {
      await updateFund(fund.id, { name: fund.name, description: fund.description })
      setEditingFund(null)
      showSuccess('Fund updated')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleDeleteFund(id) {
    if (!confirm('Delete this savings fund? Only possible if no transactions use it.')) return
    try {
      await deleteFund(id)
      showSuccess('Fund deleted')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- FUND TRANSFER HANDLER ----
  async function handleFundTransfer(e) {
    e.preventDefault()
    if (!newTransfer.from_fund_id || !newTransfer.to_fund_id || !newTransfer.amount) return
    try {
      await createFundTransfer({
        ...newTransfer,
        amount: parseFloat(newTransfer.amount)
      })
      setNewTransfer({ from_fund_id: '', to_fund_id: '', amount: '', location: 'Bank', notes: '', date: new Date().toISOString().slice(0, 10) })
      showSuccess('Fund transfer completed')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- FUND REALLOCATION HANDLER ----
  async function handleFundReallocation(e) {
    e.preventDefault()
    if (!newReallocation.fund_id || !newReallocation.from_location || !newReallocation.to_location || !newReallocation.amount) return
    try {
      await createFundReallocation({
        ...newReallocation,
        amount: parseFloat(newReallocation.amount)
      })
      setNewReallocation({ fund_id: '', from_location: '', to_location: '', amount: '', notes: '', date: new Date().toISOString().slice(0, 10) })
      showSuccess('Fund reallocation completed')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- QUANTITY UNIT HANDLERS ----
  async function handleAddUnit(e) {
    e.preventDefault()
    if (!newUnit.name.trim() || !newUnit.abbreviation.trim()) return
    try {
      await addQuantityUnit(newUnit)
      setNewUnit({ name: '', abbreviation: '' })
      showSuccess('Unit added')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleUpdateUnit(unit) {
    try {
      await updateQuantityUnit(unit.id, { name: unit.name, abbreviation: unit.abbreviation })
      setEditingUnit(null)
      showSuccess('Unit updated')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  async function handleDeleteUnit(id) {
    if (!confirm('Delete this unit?')) return
    try {
      await deleteQuantityUnit(id)
      showSuccess('Unit deleted')
      fetchData()
    } catch (err) { setError(err.message) }
  }

  // ---- DASHBOARD CONFIG HANDLERS ----
  function handleToggleCard(cardKey) {
    const ws = workspace
    const baseConfig = pendingDashboardConfig || dashboardConfig
    const current = baseConfig[ws] || []
    const updated = current.includes(cardKey)
      ? current.filter(k => k !== cardKey)
      : [...current, cardKey]
    setPendingDashboardConfig({ ...baseConfig, [ws]: updated })
  }

  async function handleSaveDashboardConfig() {
    if (!pendingDashboardConfig) return
    try {
      await updateDashboardConfig(pendingDashboardConfig)
      setDashboardConfig(pendingDashboardConfig)
      setPendingDashboardConfig(null)
      showSuccess('Dashboard config saved')
    } catch (err) { setError(err.message) }
  }

  async function handleSaveGeneralSettings() {
    try {
      await updateSetting('currency', generalSettings.currency)
      await updateSetting('date_format', generalSettings.date_format)
      await updateSetting('admin_password', generalSettings.admin_password)
      setPendingSettings({})
      showSuccess('Settings saved')
    } catch (err) { setError(err.message) }
  }

  async function handleResetWorkspace(password) {
    await resetWorkspace(workspaceId, password)
    showSuccess(`${workspace.charAt(0).toUpperCase() + workspace.slice(1)} workspace data has been reset`)
  }

  // Filter people by search
  const filteredPeople = people.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get parent categories (categories without parent_id)
  const parentCategories = categories.filter(c => !c.parent_id)

  // Build hierarchical categories for display
  const hierarchicalCategories = parentCategories.map(parent => ({
    ...parent,
    children: categories.filter(c => c.parent_id === parent.id)
  })).filter(cat =>
    searchTerm === '' ||
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.children.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Admin Panel</h1>
          <p className="page-subtitle">
            Manage settings for {workspace === 'office' ? 'Office' : workspace === 'personal' ? 'Personal' : 'Treat'} workspace
          </p>
        </div>
      </div>

      {/* Tabs - filtered by workspace */}
      <div className="admin-tabs">
        {ALL_TABS.filter(tab => tab.workspaces.includes(workspace)).map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setSearchTerm('') }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="admin-error">{error}</div>}
      {successMsg && <div className="admin-success">{successMsg}</div>}

      {/* ==================== CATEGORIES TAB ==================== */}
      {activeTab === 'categories' && (
        <div className="admin-section">
          <h2>Manage Categories</h2>
          <p className="section-desc">
            Categories for {workspace === 'office' ? 'Office' : workspace === 'personal' ? 'Personal' : 'Treat'} workspace
          </p>

          {/* Search */}
          <div className="search-box">
            <input type="text" placeholder="Search categories..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          {/* Add Category Form */}
          <form className="add-form" onSubmit={handleAddCategory}>
            <div className="add-mode-toggle">
              <button type="button" className={`mode-btn ${addMode === 'main' ? 'active' : ''}`} onClick={() => setAddMode('main')}>
                + Main Category
              </button>
              <button type="button" className={`mode-btn ${addMode === 'sub' ? 'active' : ''}`} onClick={() => setAddMode('sub')}>
                + Sub Category
              </button>
            </div>
            <div className="form-row">
              <input
                type="text"
                placeholder={addMode === 'main' ? 'Main Category Name *' : 'Sub Category Name *'}
                value={newCategory.name}
                onChange={e => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <select value={newCategory.type} onChange={e => setNewCategory(prev => ({ ...prev, type: e.target.value }))}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="both">Both</option>
                <option value="transfer">Transfer</option>
              </select>
              {addMode === 'sub' && (
                <select
                  value={newCategory.parent_id}
                  onChange={e => setNewCategory(prev => ({ ...prev, parent_id: e.target.value }))}
                  required
                >
                  <option value="">Select Parent *</option>
                  {parentCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
              <button type="submit" className="add-btn">+ Add</button>
            </div>
          </form>

          {/* Categories List - Hierarchical */}
          <div className="data-table">
            {Object.keys(pendingCategoryTypes).length > 0 && (
              <div className="save-bar">
                <span>{Object.keys(pendingCategoryTypes).length} unsaved change(s)</span>
                <button className="save-btn" onClick={handleSaveCategoryTypes}>Save Changes</button>
                <button className="cancel-btn-sm" onClick={() => setPendingCategoryTypes({})}>Discard</button>
              </div>
            )}
            {loading ? (
              <div className="loading">Loading...</div>
            ) : hierarchicalCategories.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Income</th>
                    <th style={{ textAlign: 'center' }}>Expense</th>
                    <th style={{ textAlign: 'center' }}>Transfer</th>
                    <th style={{ textAlign: 'center' }}>Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hierarchicalCategories.map(parent => {
                    const parentTypes = (pendingCategoryTypes[parent.id] !== undefined
                      ? pendingCategoryTypes[parent.id]
                      : (parent.allowed_types || '')).split(',')
                    return (
                    <React.Fragment key={parent.id}>
                      <tr className="parent-category">
                        <td>
                          <strong>
                            {editingCategory?.id === parent.id ? (
                              <input type="text" value={editingCategory.name} onChange={e => setEditingCategory(prev => ({ ...prev, name: e.target.value }))} className="inline-edit" />
                            ) : parent.name}
                          </strong>
                          {parent.children.length > 0 && <span className="child-count">({parent.children.length} sub)</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={parentTypes.includes('income')} onChange={() => handleToggleCategoryType(parent, 'income')} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={parentTypes.includes('expense')} onChange={() => handleToggleCategoryType(parent, 'expense')} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={parentTypes.includes('transfer')} onChange={() => handleToggleCategoryType(parent, 'transfer')} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={parentTypes.includes('settlement')} onChange={() => handleToggleCategoryType(parent, 'settlement')} />
                        </td>
                        <td className="actions-cell">
                          {editingCategory?.id === parent.id ? (
                            <>
                              <button className="action-btn save" onClick={() => handleUpdateCategory(editingCategory)}>&#10003;</button>
                              <button className="action-btn cancel" onClick={() => setEditingCategory(null)}>&#10005;</button>
                            </>
                          ) : (
                            <>
                              <button className="action-btn edit" onClick={() => setEditingCategory({ ...parent })}>&#9998;</button>
                              <button className="action-btn delete" onClick={() => handleDeleteCategory(parent.id)}>&#128465;</button>
                            </>
                          )}
                        </td>
                      </tr>
                      {parent.children.map(child => {
                        const childTypes = (pendingCategoryTypes[child.id] !== undefined
                          ? pendingCategoryTypes[child.id]
                          : (child.allowed_types || '')).split(',')
                        return (
                        <tr key={child.id} className="sub-category">
                          <td>
                            <span className="indent">  &#8627; </span>
                            {editingCategory?.id === child.id ? (
                              <input type="text" value={editingCategory.name} onChange={e => setEditingCategory(prev => ({ ...prev, name: e.target.value }))} className="inline-edit" />
                            ) : child.name}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={childTypes.includes('income')} onChange={() => handleToggleCategoryType(child, 'income')} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={childTypes.includes('expense')} onChange={() => handleToggleCategoryType(child, 'expense')} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={childTypes.includes('transfer')} onChange={() => handleToggleCategoryType(child, 'transfer')} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={childTypes.includes('settlement')} onChange={() => handleToggleCategoryType(child, 'settlement')} />
                          </td>
                          <td className="actions-cell">
                            {editingCategory?.id === child.id ? (
                              <>
                                <button className="action-btn save" onClick={() => handleUpdateCategory(editingCategory)}>&#10003;</button>
                                <button className="action-btn cancel" onClick={() => setEditingCategory(null)}>&#10005;</button>
                              </>
                            ) : (
                              <>
                                <button className="action-btn edit" onClick={() => setEditingCategory({ ...child })}>&#9998;</button>
                                <button className="action-btn delete" onClick={() => handleDeleteCategory(child.id)}>&#128465;</button>
                              </>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="no-data">{searchTerm ? 'No categories found' : 'No categories for this workspace'}</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== PEOPLE TAB ==================== */}
      {activeTab === 'people' && (
        <div className="admin-section">
          <h2>Manage People</h2>
          <p className="section-desc">Add employees, vendors, and other people for expense tracking</p>

          <div className="search-box">
            <input type="text" placeholder="Search people..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <form className="add-form" onSubmit={handleAddPerson}>
            <div className="form-row">
              <input type="text" placeholder="Name *" value={newPerson.name} onChange={e => setNewPerson(prev => ({ ...prev, name: e.target.value }))} required />
              <select value={newPerson.type} onChange={e => setNewPerson(prev => ({ ...prev, type: e.target.value }))}>
                <option value="employee">Employee</option>
                <option value="vendor">Vendor</option>
                <option value="family">Family</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
              </select>
              <input type="text" placeholder="Phone" value={newPerson.phone} onChange={e => setNewPerson(prev => ({ ...prev, phone: e.target.value }))} />
              <button type="submit" className="add-btn">+ Add</button>
            </div>
          </form>

          <div className="data-table">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : filteredPeople.length > 0 ? (
              <table>
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Phone</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredPeople.map(person => (
                    <tr key={person.id}>
                      <td>
                        {editingPerson?.id === person.id ? (
                          <input type="text" value={editingPerson.name} onChange={e => setEditingPerson(prev => ({ ...prev, name: e.target.value }))} className="inline-edit" />
                        ) : person.name}
                      </td>
                      <td>
                        {editingPerson?.id === person.id ? (
                          <select value={editingPerson.type} onChange={e => setEditingPerson(prev => ({ ...prev, type: e.target.value }))} className="inline-edit">
                            <option value="employee">Employee</option>
                            <option value="vendor">Vendor</option>
                            <option value="family">Family</option>
                            <option value="friend">Friend</option>
                            <option value="other">Other</option>
                          </select>
                        ) : <span className={`type-badge ${person.type}`}>{person.type}</span>}
                      </td>
                      <td>
                        {editingPerson?.id === person.id ? (
                          <input type="text" value={editingPerson.phone || ''} onChange={e => setEditingPerson(prev => ({ ...prev, phone: e.target.value }))} className="inline-edit" />
                        ) : person.phone || '-'}
                      </td>
                      <td className="actions-cell">
                        {editingPerson?.id === person.id ? (
                          <>
                            <button className="action-btn save" onClick={() => handleUpdatePerson(editingPerson)}>&#10003;</button>
                            <button className="action-btn cancel" onClick={() => setEditingPerson(null)}>&#10005;</button>
                          </>
                        ) : (
                          <>
                            <button className="action-btn edit" onClick={() => setEditingPerson({ ...person })}>&#9998;</button>
                            <button className="action-btn delete" onClick={() => handleDeletePerson(person.id)}>&#128465;</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">{searchTerm ? 'No people found' : 'No people added yet'}</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== PAYMENT METHODS TAB ==================== */}
      {activeTab === 'payment-methods' && (
        <div className="admin-section">
          <h2>Payment Methods</h2>
          <p className="section-desc">Manage payment methods available in transaction forms (Cash, Bank Transfer, Credit Cards, etc.)</p>

          <form className="add-form" onSubmit={handleAddMethod}>
            <div className="form-row">
              <input
                type="text"
                placeholder="Payment method name (e.g. HBL Credit Card) *"
                value={newMethod}
                onChange={e => setNewMethod(e.target.value)}
                required
                style={{ flex: 2 }}
              />
              <button type="submit" className="add-btn">+ Add</button>
            </div>
          </form>

          <div className="data-table">
            {Object.keys(pendingMethodTypes).length > 0 && (
              <div className="save-bar">
                <span>{Object.keys(pendingMethodTypes).length} unsaved change(s)</span>
                <button className="save-btn" onClick={handleSaveMethodTypes}>Save Changes</button>
                <button className="cancel-btn-sm" onClick={() => setPendingMethodTypes({})}>Discard</button>
              </div>
            )}
            {loading ? (
              <div className="loading">Loading...</div>
            ) : paymentMethods.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th style={{ textAlign: 'center' }}>Income</th>
                    <th style={{ textAlign: 'center' }}>Expense</th>
                    <th style={{ textAlign: 'center' }}>Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.map(method => {
                    const types = (pendingMethodTypes[method.id] !== undefined
                      ? pendingMethodTypes[method.id]
                      : (method.allowed_types || '')).split(',')
                    return (
                      <tr key={method.id}>
                        <td>
                          {editingMethod?.id === method.id ? (
                            <input type="text" value={editingMethod.name} onChange={e => setEditingMethod(prev => ({ ...prev, name: e.target.value }))} className="inline-edit" />
                          ) : method.name}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={types.includes('income')}
                            onChange={() => handleToggleMethodType(method, 'income')}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={types.includes('expense')}
                            onChange={() => handleToggleMethodType(method, 'expense')}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={types.includes('settlement')}
                            onChange={() => handleToggleMethodType(method, 'settlement')}
                          />
                        </td>
                        <td className="actions-cell">
                          {editingMethod?.id === method.id ? (
                            <>
                              <button className="action-btn save" onClick={() => handleUpdateMethod(editingMethod)}>&#10003;</button>
                              <button className="action-btn cancel" onClick={() => setEditingMethod(null)}>&#10005;</button>
                            </>
                          ) : (
                            <>
                              <button className="action-btn edit" onClick={() => setEditingMethod({ ...method })}>&#9998;</button>
                              <button className="action-btn delete" onClick={() => handleDeleteMethod(method.id)}>&#128465;</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="no-data">No payment methods found</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SAVINGS FUNDS TAB ==================== */}
      {activeTab === 'savings-funds' && (
        <div className="admin-section">
          <h2>Savings Funds</h2>
          <p className="section-desc">
            Manage savings fund sources. Track where each fund's money sits (Cash, Bank, etc.).
          </p>

          {/* Sub-tabs */}
          <div className="admin-tabs" style={{ marginBottom: 16 }}>
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'history', label: 'Transfer History' }
            ].map(tab => (
              <button
                key={tab.key}
                className={`tab-btn ${fundSubTab === tab.key ? 'active' : ''}`}
                onClick={() => setFundSubTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ---- OVERVIEW SUB-TAB ---- */}
          {fundSubTab === 'overview' && (
            <>
              <form className="add-form" onSubmit={handleAddFund}>
                <div className="form-row">
                  <input type="text" placeholder="Fund name *" value={newFund.name}
                    onChange={e => setNewFund(prev => ({ ...prev, name: e.target.value }))} required style={{ flex: 2 }} />
                  <input type="text" placeholder="Description (optional)" value={newFund.description}
                    onChange={e => setNewFund(prev => ({ ...prev, description: e.target.value }))} style={{ flex: 2 }} />
                  <button type="submit" className="add-btn">+ Add Fund</button>
                </div>
              </form>

              <div className="data-table">
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : fundsWithLocations.length > 0 ? (
                  <table>
                    <thead>
                      <tr><th>Fund Name</th><th>Total Balance</th><th>Location Breakdown</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {fundsWithLocations.map(fund => (
                        <tr key={fund.id}>
                          <td>
                            {editingFund?.id === fund.id ? (
                              <input type="text" value={editingFund.name} onChange={e => setEditingFund(prev => ({ ...prev, name: e.target.value }))} className="inline-edit" />
                            ) : <strong>{fund.name}</strong>}
                            {editingFund?.id === fund.id && (
                              <input type="text" value={editingFund.description || ''} onChange={e => setEditingFund(prev => ({ ...prev, description: e.target.value }))} className="inline-edit" placeholder="Description" style={{ marginTop: 4, fontSize: '0.8rem' }} />
                            )}
                            {editingFund?.id !== fund.id && fund.description && (
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{fund.description}</div>
                            )}
                          </td>
                          <td className={fund.current_balance >= 0 ? 'amount-positive' : 'amount-negative'}>
                            <strong>{formatCurrency(fund.current_balance)}</strong>
                          </td>
                          <td>
                            {fund.locations.length > 0 ? (
                              <div className="fund-location-breakdown">
                                {fund.locations.map((loc, i) => (
                                  <div key={i} className="fund-loc-item">
                                    <span className="fund-loc-name">{loc.name}</span>
                                    <span className={`fund-loc-amount ${loc.amount >= 0 ? 'positive' : 'negative'}`}>
                                      {formatCurrency(loc.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No transactions yet</span>
                            )}
                          </td>
                          <td className="actions-cell">
                            {editingFund?.id === fund.id ? (
                              <>
                                <button className="action-btn save" onClick={() => handleUpdateFund(editingFund)}>&#10003;</button>
                                <button className="action-btn cancel" onClick={() => setEditingFund(null)}>&#10005;</button>
                              </>
                            ) : (
                              <>
                                <button className="action-btn edit" onClick={() => setEditingFund({ ...fund })}>&#9998;</button>
                                <button className="action-btn delete" onClick={() => handleDeleteFund(fund.id)}>&#128465;</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No savings funds configured</div>
                )}
              </div>
            </>
          )}

          {/* ---- HISTORY SUB-TAB ---- */}
          {fundSubTab === 'history' && (
            <>
              <div className="settings-section">
                <h3>All Fund Activity</h3>
                <p className="section-desc">Combined history of transfers and reallocations</p>
              </div>

              <div className="data-table">
                {(() => {
                  const allActivity = [
                    ...fundTransfers.map(t => ({
                      type: 'transfer', date: t.date, description: `${t.from_fund_name} → ${t.to_fund_name}`,
                      amount: t.amount, detail: t.location, notes: t.notes, created_at: t.created_at
                    })),
                    ...fundReallocations.map(r => ({
                      type: 'reallocation', date: r.date, description: `${r.fund_name}: ${r.from_location} → ${r.to_location}`,
                      amount: r.amount, detail: 'Internal', notes: r.notes, created_at: r.created_at
                    }))
                  ].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))

                  return allActivity.length > 0 ? (
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Notes</th></tr>
                      </thead>
                      <tbody>
                        {allActivity.slice(0, 50).map((a, i) => (
                          <tr key={i}>
                            <td>{a.date}</td>
                            <td><span className={`type-badge ${a.type}`}>{a.type}</span></td>
                            <td>{a.description}</td>
                            <td><strong>{formatCurrency(a.amount)}</strong></td>
                            <td>{a.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No fund activity yet</div>
                  )
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== QUANTITY UNITS TAB ==================== */}
      {activeTab === 'quantity-units' && (
        <div className="admin-section">
          <h2>Quantity Units</h2>
          <p className="section-desc">Manage measurement units for grocery/item tracking (pcs, kg, dozen, etc.)</p>

          <form className="add-form" onSubmit={handleAddUnit}>
            <div className="form-row">
              <input
                type="text"
                placeholder="Unit name (e.g. Kilogram) *"
                value={newUnit.name}
                onChange={e => setNewUnit(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Abbreviation (e.g. kg) *"
                value={newUnit.abbreviation}
                onChange={e => setNewUnit(prev => ({ ...prev, abbreviation: e.target.value }))}
                required
                style={{ maxWidth: 150 }}
              />
              <button type="submit" className="add-btn">+ Add</button>
            </div>
          </form>

          <div className="data-table">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : quantityUnits.length > 0 ? (
              <table>
                <thead>
                  <tr><th>Unit Name</th><th>Abbreviation</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {quantityUnits.map(unit => (
                    <tr key={unit.id}>
                      <td>
                        {editingUnit?.id === unit.id ? (
                          <input type="text" value={editingUnit.name} onChange={e => setEditingUnit(prev => ({ ...prev, name: e.target.value }))} className="inline-edit" />
                        ) : unit.name}
                      </td>
                      <td>
                        {editingUnit?.id === unit.id ? (
                          <input type="text" value={editingUnit.abbreviation} onChange={e => setEditingUnit(prev => ({ ...prev, abbreviation: e.target.value }))} className="inline-edit" style={{ maxWidth: 100 }} />
                        ) : <code>{unit.abbreviation}</code>}
                      </td>
                      <td className="actions-cell">
                        {editingUnit?.id === unit.id ? (
                          <>
                            <button className="action-btn save" onClick={() => handleUpdateUnit(editingUnit)}>&#10003;</button>
                            <button className="action-btn cancel" onClick={() => setEditingUnit(null)}>&#10005;</button>
                          </>
                        ) : (
                          <>
                            <button className="action-btn edit" onClick={() => setEditingUnit({ ...unit })}>&#9998;</button>
                            <button className="action-btn delete" onClick={() => handleDeleteUnit(unit.id)}>&#128465;</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">No quantity units configured</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SETTINGS TAB ==================== */}
      {activeTab === 'settings' && (
        <div className="admin-section">
          <h2>Settings</h2>

          {/* Dashboard Cards Config */}
          <div className="settings-section">
            <h3>Dashboard Cards - {workspace === 'office' ? 'Office' : workspace === 'personal' ? 'Personal' : 'Treat'}</h3>
            <p className="section-desc">Select which cards to show on the dashboard. System cards and your categories are both available.</p>

            {(pendingDashboardConfig !== null) && (
              <div className="save-bar">
                <span>Unsaved dashboard changes</span>
                <button className="save-btn" onClick={handleSaveDashboardConfig}>Save Changes</button>
                <button className="cancel-btn-sm" onClick={() => setPendingDashboardConfig(null)}>Discard</button>
              </div>
            )}

            <h4 style={{ fontSize: '0.85rem', color: '#64748b', margin: '12px 0 8px', fontWeight: 500 }}>System Cards</h4>
            <div className="card-toggles">
              {(BUILTIN_CARDS[workspace] || []).map(card => {
                const enabled = ((pendingDashboardConfig || dashboardConfig)[workspace] || []).includes(card.key)
                return (
                  <label key={card.key} className="card-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleCard(card.key)}
                    />
                    <span>{card.label}</span>
                  </label>
                )
              })}
            </div>

            <h4 style={{ fontSize: '0.85rem', color: '#64748b', margin: '16px 0 8px', fontWeight: 500 }}>Category Cards</h4>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 8px' }}>Add any category as a dashboard card showing its total</p>
            <div className="card-toggles">
              {parentCategories.map(cat => {
                const cardKey = `cat:${cat.name}`
                const enabled = ((pendingDashboardConfig || dashboardConfig)[workspace] || []).includes(cardKey)
                return (
                  <label key={cardKey} className="card-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleCard(cardKey)}
                    />
                    <span>{cat.name}</span>
                  </label>
                )
              })}
              {parentCategories.length === 0 && (
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No categories found for this workspace</span>
              )}
            </div>
          </div>

          {/* General Settings */}
          <div className="settings-section">
            <h3>General</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <label>Currency Symbol</label>
                <input
                  type="text"
                  value={generalSettings.currency}
                  onChange={e => setGeneralSettings(prev => ({ ...prev, currency: e.target.value }))}
                />
              </div>
              <div className="setting-item">
                <label>Date Format</label>
                <select
                  value={generalSettings.date_format}
                  onChange={e => setGeneralSettings(prev => ({ ...prev, date_format: e.target.value }))}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Admin Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={generalSettings.admin_password}
                    onChange={e => setGeneralSettings(prev => ({ ...prev, admin_password: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="action-btn edit"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="save-btn" onClick={handleSaveGeneralSettings}>Save Settings</button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="settings-section" style={{ borderColor: '#dc3545', marginTop: 24 }}>
            <h3 style={{ color: '#dc3545' }}>Danger Zone</h3>
            <p style={{ color: '#666', marginBottom: 12, fontSize: 14 }}>
              Reset all transaction data for the <strong>{workspace.charAt(0).toUpperCase() + workspace.slice(1)}</strong> workspace.
              This will permanently delete all transactions, fund transfers, and fund balances for this workspace.
              Categories, people, payment methods, and settings will be kept.
            </p>
            <button
              className="delete-btn"
              onClick={() => setShowResetModal(true)}
            >
              Reset {workspace.charAt(0).toUpperCase() + workspace.slice(1)} Workspace Data
            </button>
          </div>
        </div>
      )}

      <PasswordConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetWorkspace}
        title="Reset Workspace Data"
        message={`Enter admin password to reset all ${workspace} workspace data. This cannot be undone.`}
      />
    </div>
  )
}

export default Admin
