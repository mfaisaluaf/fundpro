import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getTransactions, deleteTransaction } from '../services/api'
import AddTransactionModal from '../components/AddTransactionModal'
import EditTransactionModal from '../components/EditTransactionModal'
import PasswordConfirmModal from '../components/PasswordConfirmModal'
import { buildReceiptText } from '../components/DetailModal'
import { ShareIcon, CheckIcon } from '../components/icons'
import { showToast } from '../components/toast'
import './Transactions.css'

// Format currency
const formatCurrency = (num) => {
  return 'Rs ' + (num || 0).toLocaleString()
}

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Transactions() {
  const { workspace } = useOutletContext()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, expense, income
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 50
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [sharedTxn, setSharedTxn] = useState(null)

  // Fetch transactions when workspace changes
  async function fetchTransactions() {
    setLoading(true)
    setError(null)
    try {
      const data = await getTransactions({ workspace, limit: 10000 })
      setTransactions(data)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
    setPage(1)
  }, [workspace])

  useEffect(() => {
    setPage(1)
  }, [filter])

  // Filter transactions by type
  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter(t => t.type === filter)

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = filteredTransactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  // Calculate totals
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  // Handle successful transaction add
  const handleSuccess = () => {
    setShowModal(false)
    fetchTransactions()
  }

  // Handle share click
  const handleShareClick = (txn) => {
    const text = buildReceiptText(txn)
    navigator.clipboard.writeText(text)
      .then(() => showToast('✓ Receipt copied to clipboard'))
      .catch(() => showToast('Could not copy — try again', 'error'))
    setSharedTxn(txn.id)
    setTimeout(() => setSharedTxn(null), 2000)
  }

  // Handle edit click
  const handleEditClick = (txn) => {
    setSelectedTransaction(txn)
    setShowEditModal(true)
  }

  // Handle delete click
  const handleDeleteClick = (txn) => {
    setSelectedTransaction(txn)
    setShowDeleteModal(true)
  }

  // Handle delete confirm
  const handleDeleteConfirm = async (password) => {
    await deleteTransaction(selectedTransaction.id, password)
    setShowDeleteModal(false)
    setSelectedTransaction(null)
    fetchTransactions()
  }

  // Handle edit success
  const handleEditSuccess = () => {
    setShowEditModal(false)
    setSelectedTransaction(null)
    fetchTransactions()
  }

  // Loading state
  if (loading) {
    return (
      <div className="transactions-page">
        <div className="loading-state">Loading transactions...</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="transactions-page">
        <div className="error-state">
          <p>Failed to load transactions</p>
          <small>{error}</small>
        </div>
      </div>
    )
  }

  return (
    <div className="transactions-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="page-subtitle">View and manage all your transactions</p>
        </div>
        <button className="add-btn" onClick={() => setShowModal(true)}>+ Add Transaction</button>
      </div>

      {/* Summary Cards */}
      <div className="summary-row">
        <div className="summary-item income">
          <span className="summary-label">Total Income</span>
          <span className="summary-value">{formatCurrency(totalIncome)}</span>
        </div>
        <div className="summary-item expense">
          <span className="summary-label">Total Expense</span>
          <span className="summary-value">{formatCurrency(totalExpense)}</span>
        </div>
        <div className="summary-item net">
          <span className="summary-label">Net</span>
          <span className="summary-value">{formatCurrency(totalIncome - totalExpense)}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({transactions.length})
        </button>
        <button
          className={`filter-tab ${filter === 'expense' ? 'active' : ''}`}
          onClick={() => setFilter('expense')}
        >
          Expenses ({transactions.filter(t => t.type === 'expense').length})
        </button>
        <button
          className={`filter-tab ${filter === 'income' ? 'active' : ''}`}
          onClick={() => setFilter('income')}
        >
          Income ({transactions.filter(t => t.type === 'income').length})
        </button>
      </div>

      {/* Transactions Table */}
      <div className="table-container">
        {filteredTransactions.length > 0 ? (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="date-cell">{formatDate(txn.date)}</td>
                  <td>
                    <span className="category-badge">{txn.category_name || 'Uncategorized'}</span>
                  </td>
                  <td className="desc-cell">{txn.description}</td>
                  <td className="fund-cell">{txn.payment_method || '—'}</td>
                  <td className={`amount-cell ${txn.type}`}>
                    {txn.type === 'income' ? '+' : '-'} {formatCurrency(txn.amount)}
                  </td>
                  <td>
                    <span className={`type-badge ${txn.type}`}>
                      {txn.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className={`action-btn share-btn ${sharedTxn === txn.id ? 'shared' : ''}`}
                      onClick={() => handleShareClick(txn)}
                      title="Share receipt"
                    >
                      {sharedTxn === txn.id ? <CheckIcon size={13} /> : <ShareIcon size={13} />}
                    </button>
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEditClick(txn)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteClick(txn)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">No transactions found for this workspace</div>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span className="pagination-info">
          Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length} transactions
        </span>
        {totalPages > 1 && (
          <div className="pagination-controls">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="page-btn">← Prev</button>
            <span className="page-indicator">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="page-btn">Next →</button>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        workspace={workspace}
        onSuccess={handleSuccess}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedTransaction(null)
        }}
        workspace={workspace}
        onSuccess={handleEditSuccess}
        transaction={selectedTransaction}
      />

      {/* Delete Confirmation Modal */}
      <PasswordConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedTransaction(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Transaction"
        message={`Enter admin password to delete: "${selectedTransaction?.description}"`}
      />
    </div>
  )
}

export default Transactions
