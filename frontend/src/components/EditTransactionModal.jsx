import { useState, useEffect } from 'react'
import { updateTransaction, getCategories, getPeople, getPaymentMethods, getFunds, getQuantityUnits } from '../services/api'
import './AddTransactionModal.css'

// Helper to get workspace ID
function getWorkspaceId(workspace) {
  const map = { office: 1, personal: 2, treat: 3 }
  return map[workspace] || 1
}

// Format date for display (DD/MM/YYYY)
function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function EditTransactionModal({ isOpen, onClose, workspace, onSuccess, transaction }) {
  // Form state
  const [formData, setFormData] = useState({
    date: '',
    type: 'expense',
    main_category_id: '',
    category_id: '',
    description: '',
    amount: '',
    payment_method: '',
    person_id: '',
    notes: ''
  })

  // Password for modification
  const [password, setPassword] = useState('')

  // Dropdown options
  const [categories, setCategories] = useState([])
  const [people, setPeople] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [funds, setFunds] = useState([])
  const [quantityUnits, setQuantityUnits] = useState([])

  const isPersonal = workspace === 'personal'

  // Loading & error states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch dropdown data and populate form when modal opens
  useEffect(() => {
    if (isOpen && transaction) {
      fetchDropdownData()
      setPassword('')
      setError(null)
    }
  }, [isOpen, transaction, workspace])

  async function fetchDropdownData() {
    try {
      const fetches = [
        getCategories({ workspace }),
        getPeople(),
        getPaymentMethods(),
        getQuantityUnits()
      ]
      if (isPersonal) {
        fetches.push(getFunds('personal'))
      }

      const [cats, ppl, methods, units, fundsData] = await Promise.all(fetches)
      setCategories(cats)
      setPeople(ppl)
      setPaymentMethods(methods)
      setQuantityUnits(units || [])
      if (isPersonal && fundsData) setFunds(fundsData)

      // Populate form after categories are loaded
      if (transaction) {
        // Find if the transaction's category is a sub-category
        let mainCatId = transaction.category_id?.toString() || ''
        let subCatId = ''

        // Check all parent categories to see if transaction.category_id is a child
        for (const cat of cats) {
          if (cat.children) {
            const child = cat.children.find(c => c.id === transaction.category_id)
            if (child) {
              mainCatId = cat.id.toString()
              subCatId = child.id.toString()
              break
            }
          }
        }

        setFormData({
          date: transaction.date || '',
          type: transaction.type || 'expense',
          main_category_id: mainCatId,
          category_id: subCatId,
          description: transaction.description || '',
          amount: transaction.amount?.toString() || '',
          payment_method: transaction.payment_method || '',
          person_id: transaction.person_id?.toString() || '',
          quantity: transaction.quantity || '',
          quantity_unit: transaction.quantity_unit || 'pcs',
          fund_id: transaction.fund_id?.toString() || '',
          notes: transaction.notes || ''
        })
      }
    } catch (err) {
      console.error('Failed to load form data:', err)
    }
  }

  // Handle input change
  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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

  // Handle form submit
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate password
      if (!password.trim()) {
        throw new Error('Password is required to modify transactions')
      }

      // Validate required fields
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
        password,
        date: formData.date,
        type: formData.type,
        description: formData.description,
        amount: parseFloat(formData.amount),
        workspace_id: getWorkspaceId(workspace),
        category_id: parseInt(finalCategoryId),
        payment_method: formData.payment_method || null,
        person_id: formData.person_id ? parseInt(formData.person_id) : null,
        quantity: formData.quantity || null,
        quantity_unit: formData.quantity_unit || 'pcs',
        fund_id: formData.fund_id ? parseInt(formData.fund_id) : null,
        notes: formData.notes || null
      }

      await updateTransaction(transaction.id, data)

      // Success - close modal and refresh
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter categories by type
  const filteredCategories = categories.filter(c =>
    c.type === formData.type || c.type === 'both'
  )

  // Get sub-categories for selected main category
  const selectedMainCategory = filteredCategories.find(
    c => c.id === parseInt(formData.main_category_id)
  )
  const subCategories = selectedMainCategory?.children || []

  // Check if selected category is loan-related (needs person tracking)
  const isLoanCategory = selectedMainCategory?.name === 'Loan Given' ||
    selectedMainCategory?.name === 'Loans' ||
    selectedMainCategory?.name === 'Loan Recovery'

  // Check if grocery (show quantity field)
  const isGroceryCategory = selectedMainCategory?.name === 'Grocery' ||
    selectedMainCategory?.name === 'Dairy Products' ||
    selectedMainCategory?.name === 'Fruits' ||
    selectedMainCategory?.name === 'Vegetables'

  // Check if pocket money (show person field)
  const isPocketMoney = selectedMainCategory?.name === 'Monthly Pocket Money'

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Edit Transaction</h2>
          <span className="workspace-indicator">
            {workspace === 'office' ? '🏢 Office' : workspace === 'treat' ? '🎉 Treat' : '👤 Personal'}
          </span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Error Message */}
          {error && <div className="form-error">{error}</div>}

          {/* Password Field */}
          <div className="form-group full-width password-field">
            <label>Admin Password *</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password to modify"
              required
            />
          </div>

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
                  onClick={() => setFormData(prev => ({ ...prev, type: 'transfer', main_category_id: '', category_id: '' }))}
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
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Row 2: Main Category & Sub Category */}
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

          {/* Fund dropdown for personal workspace income/expense (NOT for credit card or receivable) */}
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

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Update Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTransactionModal
