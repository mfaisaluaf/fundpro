import { useState } from 'react'
import './PasswordConfirmModal.css'

function PasswordConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onConfirm(password)
      setPassword('')
      onClose()
    } catch (err) {
      setError(err.message || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setPassword('')
    setError('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="password-modal" onClick={e => e.stopPropagation()}>
        <div className="password-modal-header">
          <h3>{title || 'Confirm Action'}</h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="password-message">{message || 'Enter admin password to continue'}</p>
          {error && <div className="password-error">{error}</div>}
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
          />
          <div className="password-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="confirm-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PasswordConfirmModal
