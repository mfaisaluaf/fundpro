import { useState, useEffect } from 'react'
import './DetailModal.css'

// Format number as currency
const formatCurrency = (num) => {
  return 'Rs ' + (num || 0).toLocaleString()
}

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DetailModal({ isOpen, onClose, title, icon, transactions, total }) {
  if (!isOpen) return null

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="detail-modal-header">
          <div className="detail-modal-title">
            <span className="detail-icon">{icon}</span>
            <h2>{title}</h2>
          </div>
          <button className="detail-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Total */}
        <div className="detail-total">
          <span>Total:</span>
          <span className="total-value">{formatCurrency(total)}</span>
        </div>

        {/* Transactions List */}
        <div className="detail-transactions">
          {transactions && transactions.length > 0 ? (
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Person</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="date-cell">{formatDate(txn.date)}</td>
                    <td className="desc-cell">{txn.description}</td>
                    <td className="person-cell">{txn.person_name || '-'}</td>
                    <td className="amount-cell">{formatCurrency(txn.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-transactions">No transactions found</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DetailModal
