import { useState, useEffect, useRef } from 'react'
import { addTransaction, getCategories, getPeople, getPaymentMethods, getFunds, getQuantityUnits, createFundTransfer, createFundReallocation } from '../services/api'
import './AddTransactionModal.css'

// Helper to get workspace ID
function getWorkspaceId(workspace) {
  const map = { office: 1, personal: 2, treat: 3 }
  return map[workspace] || 1
}

// Get today's date in local timezone (YYYY-MM-DD format for input)
function getLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format date for display (DD/MM/YYYY)
function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

// Transfer sub-types for personal workspace
const TRANSFER_TYPES = [
  { key: 'fund_transfer', label: 'Fund Transfer', desc: 'Move between funds' },
  { key: 'atm_withdrawal', label: 'ATM Withdrawal', desc: 'Bank to Cash' },
  { key: 'cash_to_bank', label: 'Cash to Bank', desc: 'Cash to Bank' },
  { key: 'other', label: 'Any Other', desc: 'Custom location move' }
]

function AddTransactionModal({ isOpen, onClose, workspace, onSuccess }) {
  // Form state
  const [formData, setFormData] = useState({
    date: getLocalDate(),
    type: 'expense',
    main_category_id: '',
    category_id: '',
    description: '',
    amount: '',
    payment_method: '',
    person_id: '',
    quantity: '',
    quantity_unit: 'pcs',
    fund_id: '',
    notes: ''
  })

  // Transfer-specific state
  const [transferType, setTransferType] = useState('')
  const [transferData, setTransferData] = useState({
    from_fund_id: '',
    to_fund_id: '',
    fund_id: '',
    from_location: '',
    to_location: '',
    location: 'Bank',
    amount: '',
    notes: '',
    date: getLocalDate()
  })

  // Dropdown options
  const [categories, setCategories] = useState([])
  const [people, setPeople] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [funds, setFunds] = useState([])
  const [quantityUnits, setQuantityUnits] = useState([])

  // Loading & error states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  const isPersonal = workspace === 'personal'

  // Drag event listeners
  useEffect(() => {
    function handleMouseMove(e) {
      if (!isDragging.current) return
      setDragOffset({
        x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
        y: dragStart.current.offsetY + (e.clientY - dragStart.current.y)
      })
    }
    function handleMouseUp() {
      isDragging.current = false
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Fetch dropdown data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDropdownData()
      setDragOffset({ x: 0, y: 0 })
      // Reset form with today's date
      setFormData({
        date: getLocalDate(),
        type: 'expense',
        main_category_id: '',
        category_id: '',
        description: '',
        amount: '',
        payment_method: '',
        person_id: '',
        quantity: '',
        quantity_unit: 'pcs',
        fund_id: '',
        notes: ''
      })
      setTransferType('')
      setTransferData({
        from_fund_id: '',
        to_fund_id: '',
        fund_id: '',
        from_location: '',
        to_location: '',
        location: 'Bank',
        amount: '',
        notes: '',
        date: getLocalDate()
      })
      setError(null)
    }
  }, [isOpen, workspace])

  async function fetchDropdownData() {
    try {
      const promises = [
        getCategories({ workspace }),
        getPeople(),
        getPaymentMethods(),
        getQuantityUnits()
      ]
      // Only fetch funds for personal workspace
      if (workspace === 'personal') {
        promises.push(getFunds('personal'))
      }

      const results = await Promise.all(promises)
      setCategories(results[0])
      setPeople(results[1])
      setPaymentMethods(results[2])
      setQuantityUnits(results[3])
      if (results[4]) {
        setFunds(results[4])
        // Set default fund to "Salary" if available
        const salaryFund = results[4].find(f => f.name === 'Salary')
        if (salaryFund) {
          setFormData(prev => ({ ...prev, fund_id: salaryFund.id.toString() }))
        }
      }
    } catch (err) {
      console.error('Failed to load form data:', err)
    }
  }

  // Handle input change
  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      // Clear payment method and category when type changes (previous selection may not be valid)
      if (name === 'type') {
        updated.payment_method = ''
        updated.main_category_id = ''
        updated.category_id = ''
      }
      return updated
    })
  }

  // Handle transfer data change
  function handleTransferChange(e) {
    const { name, value } = e.target
    setTransferData(prev => ({ ...prev, [name]: value }))
  }

  // Start dragging from header
  function handleDragStart(e) {
    isDragging.current = true
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y
    }
    e.preventDefault()
  }

  // Handle main category change
  function handleMainCategoryChange(e) {
    const value = e.target.value
    setFormData(prev => ({
      ...prev,
      main_category_id: value,
      category_id: '' // Reset sub-category when main changes
    }))
  }

  // Handle transfer type selection
  function handleTransferTypeSelect(key) {
    setTransferType(key)
    // Pre-fill location fields based on type
    if (key === 'atm_withdrawal') {
      setTransferData(prev => ({ ...prev, from_location: 'Bank', to_location: 'Cash' }))
    } else if (key === 'cash_to_bank') {
      setTransferData(prev => ({ ...prev, from_location: 'Cash', to_location: 'Bank' }))
    } else {
      setTransferData(prev => ({ ...prev, from_location: '', to_location: '' }))
    }
  }

  // Handle form submit
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Personal workspace transfer → fund operations
      if (formData.type === 'transfer' && isPersonal && transferType) {
        const amt = parseFloat(transferData.amount)
        if (!amt || amt <= 0) throw new Error('Valid amount is required')

        if (transferType === 'fund_transfer') {
          if (!transferData.from_fund_id || !transferData.to_fund_id) throw new Error('Select both funds')
          await createFundTransfer({
            from_fund_id: parseInt(transferData.from_fund_id),
            to_fund_id: parseInt(transferData.to_fund_id),
            amount: amt,
            location: transferData.location || 'Bank',
            date: transferData.date || getLocalDate(),
            notes: transferData.notes || null
          })
        } else {
          // ATM, Cash to Bank, Other → fund reallocation
          if (!transferData.fund_id) throw new Error('Select a fund')
          if (!transferData.from_location || !transferData.to_location) throw new Error('From and To locations are required')
          await createFundReallocation({
            fund_id: parseInt(transferData.fund_id),
            from_location: transferData.from_location,
            to_location: transferData.to_location,
            amount: amt,
            date: transferData.date || getLocalDate(),
            notes: transferData.notes || null
          })
        }

        onSuccess?.()
        onClose()
        return
      }

      // Regular transaction flow
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error('Valid amount is required')
      }

      // Get the actual category ID to save
      const finalCategoryId = formData.category_id || formData.main_category_id
      if (!finalCategoryId) {
        throw new Error('Category is required')
      }

      // Person is required when payment method is Payable/Receivable or for settlements
      if ((formData.payment_method === 'Payable' || formData.payment_method === 'Receivable' || formData.type === 'settlement') && !formData.person_id) {
        throw new Error('Person is required for Payable/Receivable expenses and Reimbursements')
      }

      // Prepare data
      const data = {
        date: formData.date,
        type: formData.type,
        description: formData.description,
        amount: parseFloat(formData.amount),
        workspace_id: getWorkspaceId(workspace),
        category_id: parseInt(finalCategoryId),
        payment_method: formData.payment_method || null,
        person_id: formData.person_id ? parseInt(formData.person_id) : null,
        quantity: formData.quantity || null,
        quantity_unit: formData.quantity ? (formData.quantity_unit || 'pcs') : null,
        fund_id: formData.fund_id ? parseInt(formData.fund_id) : null,
        notes: formData.notes || null
      }

      await addTransaction(data)

      // Success - close modal and refresh
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter categories by allowed_types (falls back to old type column only if allowed_types is null/undefined)
  const filteredCategories = categories.filter(c => {
    if (c.allowed_types !== null && c.allowed_types !== undefined) {
      return c.allowed_types.split(',').filter(Boolean).includes(formData.type)
    }
    return c.type === formData.type || c.type === 'both'
  })

  // Get sub-categories for selected main category
  const selectedMainCategory = filteredCategories.find(
    c => c.id === parseInt(formData.main_category_id)
  )
  const subCategories = (selectedMainCategory?.children || []).filter(sub => {
    if (sub.allowed_types !== null && sub.allowed_types !== undefined) {
      return sub.allowed_types.split(',').filter(Boolean).includes(formData.type)
    }
    return true
  })

  // Check if selected category is loan-related (needs person tracking)
  const isLoanCategory = selectedMainCategory?.name === 'Loan Given' ||
    selectedMainCategory?.name === 'Loans' ||
    selectedMainCategory?.name === 'Loan Recovery'

  // Check if selected category is grocery (show quantity field)
  const isGroceryCategory = selectedMainCategory?.name === 'Grocery' ||
    selectedMainCategory?.name === 'Dairy Products' ||
    selectedMainCategory?.name === 'Fruits' ||
    selectedMainCategory?.name === 'Vegetables'

  // Check if pocket money (show person field for tracking who)
  const isPocketMoney = selectedMainCategory?.name === 'Monthly Pocket Money'

  // Is this a personal transfer? (shows fund transfer UI instead of regular category form)
  const isPersonalTransfer = formData.type === 'transfer' && isPersonal && funds.length > 0

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        {/* Header — drag handle */}
        <div className="modal-header" onMouseDown={handleDragStart} style={{ cursor: 'grab' }}>
          <h2>Add Transaction</h2>
          <span className="workspace-indicator">
            {workspace === 'office' ? '🏢 Office' : workspace === 'treat' ? '🎉 Treat' : '👤 Personal'}
          </span>
          <button className="close-btn" onMouseDown={e => e.stopPropagation()} onClick={onClose}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Error Message */}
          {error && <div className="form-error">{error}</div>}

          {/* Row 1: Type & Date */}
          <div className="form-row">
            <div className="form-group">
              <label>Type *</label>
              <div className="type-toggle">
                <button
                  type="button"
                  className={`type-btn expense ${formData.type === 'expense' ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, type: 'expense', main_category_id: '', category_id: '' }))}
                >
                  Expense
                </button>
                <button
                  type="button"
                  className={`type-btn income ${formData.type === 'income' ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, type: 'income', main_category_id: '', category_id: '' }))}
                >
                  Income
                </button>
                {workspace === 'office' && (
                  <button
                    type="button"
                    className={`type-btn settlement ${formData.type === 'settlement' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, type: 'settlement', main_category_id: '', category_id: '' }))}
                  >
                    Reimburse
                  </button>
                )}
                <button
                  type="button"
                  className={`type-btn transfer ${formData.type === 'transfer' ? 'active' : ''}`}
                  onClick={() => { setFormData(prev => ({ ...prev, type: 'transfer', main_category_id: '', category_id: '' })); setTransferType('') }}
                >
                  Transfer
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Date * <span className="date-display">({formatDateDisplay(formData.date)})</span></label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={(e) => { handleChange(e); setTransferData(prev => ({ ...prev, date: e.target.value })) }}
                required
              />
            </div>
          </div>

          {/* ====== PERSONAL TRANSFER: Fund Operations ====== */}
          {isPersonalTransfer && (
            <>
              {/* Transfer Type Selection */}
              <div className="form-group full-width">
                <label>Transfer Type *</label>
                <div className="transfer-type-grid">
                  {TRANSFER_TYPES.map(tt => (
                    <button
                      key={tt.key}
                      type="button"
                      className={`transfer-type-btn ${transferType === tt.key ? 'active' : ''}`}
                      onClick={() => handleTransferTypeSelect(tt.key)}
                    >
                      <span className="tt-label">{tt.label}</span>
                      <span className="tt-desc">{tt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fund Transfer: From Fund → To Fund */}
              {transferType === 'fund_transfer' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>From Fund *</label>
                      <select name="from_fund_id" value={transferData.from_fund_id} onChange={handleTransferChange} required>
                        <option value="">Select source fund</option>
                        {funds.map(f => (
                          <option key={f.id} value={f.id}>{f.name} (Rs {(f.current_balance || 0).toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>To Fund *</label>
                      <select name="to_fund_id" value={transferData.to_fund_id} onChange={handleTransferChange} required>
                        <option value="">Select destination fund</option>
                        {funds.filter(f => String(f.id) !== transferData.from_fund_id).map(f => (
                          <option key={f.id} value={f.id}>{f.name} (Rs {(f.current_balance || 0).toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Amount (Rs) *</label>
                      <input type="number" name="amount" value={transferData.amount} onChange={handleTransferChange} placeholder="0" min="1" required />
                    </div>
                    <div className="form-group">
                      <label>Via (Location) *</label>
                      <select name="location" value={transferData.location || 'Bank'} onChange={handleTransferChange} required>
                        <option value="Bank">Bank</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <input type="text" name="notes" value={transferData.notes} onChange={handleTransferChange} placeholder="Optional notes" />
                  </div>
                </>
              )}

              {/* ATM Withdrawal / Cash to Bank: Select Fund */}
              {(transferType === 'atm_withdrawal' || transferType === 'cash_to_bank') && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Fund *</label>
                      <select name="fund_id" value={transferData.fund_id} onChange={handleTransferChange} required>
                        <option value="">Select fund</option>
                        {funds.map(f => (
                          <option key={f.id} value={f.id}>{f.name} (Rs {(f.current_balance || 0).toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Amount (Rs) *</label>
                      <input type="number" name="amount" value={transferData.amount} onChange={handleTransferChange} placeholder="0" min="1" required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>From</label>
                      <input type="text" value={transferData.from_location} disabled className="disabled-input" />
                    </div>
                    <div className="form-group">
                      <label>To</label>
                      <input type="text" value={transferData.to_location} disabled className="disabled-input" />
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <input type="text" name="notes" value={transferData.notes} onChange={handleTransferChange} placeholder="Optional notes" />
                  </div>
                </>
              )}

              {/* Any Other: Custom from/to locations */}
              {transferType === 'other' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Fund *</label>
                      <select name="fund_id" value={transferData.fund_id} onChange={handleTransferChange} required>
                        <option value="">Select fund</option>
                        {funds.map(f => (
                          <option key={f.id} value={f.id}>{f.name} (Rs {(f.current_balance || 0).toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Amount (Rs) *</label>
                      <input type="number" name="amount" value={transferData.amount} onChange={handleTransferChange} placeholder="0" min="1" required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>From Location *</label>
                      <input type="text" name="from_location" value={transferData.from_location} onChange={handleTransferChange} placeholder="e.g. Bank, Cash" required />
                    </div>
                    <div className="form-group">
                      <label>To Location *</label>
                      <input type="text" name="to_location" value={transferData.to_location} onChange={handleTransferChange} placeholder="e.g. BAHL Savings" required />
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <input type="text" name="notes" value={transferData.notes} onChange={handleTransferChange} placeholder="Optional notes" />
                  </div>
                </>
              )}
            </>
          )}

          {/* ====== REGULAR TRANSACTION FORM (non-personal-transfer) ====== */}
          {!isPersonalTransfer && (
            <>
              {/* Row 2: Main Category & Sub Category (for all workspaces) */}
              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="main_category_id"
                    value={formData.main_category_id}
                    onChange={handleMainCategoryChange}
                    required
                  >
                    <option value="">Select category</option>
                    {filteredCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {subCategories.length > 0 ? (
                  <div className="form-group">
                    <label>Sub Category *</label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select sub-category</option>
                      {subCategories.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Amount (Rs) *</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      step="1"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Row 3: Amount (when sub-categories exist) */}
              {subCategories.length > 0 && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Amount (Rs) *</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      step="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    {/* Placeholder for layout */}
                  </div>
                </div>
              )}

              {/* Row 4: Description */}
              <div className="form-group full-width">
                <label>Description</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="What was this transaction for?"
                />
              </div>

              {/* Row 5: Payment Method (for all workspaces, not for Transfer) */}
              {formData.type !== 'transfer' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Method</label>
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleChange}
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods
                        .filter(method => {
                          // Filter by allowed_types based on selected transaction type
                          if (method.allowed_types) {
                            const allowed = method.allowed_types.split(',')
                            if (!allowed.includes(formData.type)) return false
                          }
                          // Hide Payable for personal workspace
                          if (workspace === 'personal' && method.name === 'Payable') return false
                          return true
                        })
                        .map(method => (
                          <option key={method.id} value={method.name}>{method.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Person field - required for Payable, Receivable, Settlement, Treat contributions, Loans, or Pocket Money */}
                  {(formData.payment_method === 'Payable' || formData.payment_method === 'Receivable' || formData.type === 'settlement' || (workspace === 'treat' && formData.type === 'income') || isLoanCategory || isPocketMoney) && (
                    <div className="form-group">
                      <label>Person {isLoanCategory ? '(Who?)' : ''} *</label>
                      <select
                        name="person_id"
                        value={formData.person_id}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select person</option>
                        {people.map(person => (
                          <option key={person.id} value={person.id}>{person.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Row: Savings Fund (Personal workspace only, for income/expense, NOT for credit card or receivable) */}
              {isPersonal && (formData.type === 'income' || formData.type === 'expense') && funds.length > 0 && !formData.payment_method?.includes('Credit Card') && formData.payment_method !== 'Receivable' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{formData.type === 'income' ? 'Credit to Fund' : 'Debit from Fund'} *</label>
                    <select
                      name="fund_id"
                      value={formData.fund_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select fund source</option>
                      {funds.map(fund => (
                        <option key={fund.id} value={fund.id}>{fund.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" />
                </div>
              )}

              {/* Row: Quantity (for grocery/food categories - optional) */}
              {isGroceryCategory && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity (optional)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleChange}
                        placeholder="0"
                        min="0"
                        step="0.1"
                        style={{ flex: 1 }}
                      />
                      <select
                        name="quantity_unit"
                        value={formData.quantity_unit}
                        onChange={handleChange}
                        style={{ flex: 1 }}
                      >
                        {quantityUnits.map(unit => (
                          <option key={unit.id} value={unit.abbreviation}>{unit.abbreviation}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" />
                </div>
              )}

              {/* Row: Notes */}
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Additional notes (optional)"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading || (isPersonalTransfer && !transferType)}>
              {loading ? 'Saving...' : isPersonalTransfer ? 'Transfer' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddTransactionModal
