import { useState, useRef, useEffect } from 'react'
import { ShareIcon, DownloadIcon, CheckIcon } from './icons'
import { showToast } from './toast'
import './DetailModal.css'

const formatCurrency = (num) => 'Rs ' + (num || 0).toLocaleString()

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function doShare(text, label = 'Copied to clipboard') {
  navigator.clipboard.writeText(text)
    .then(() => showToast(`✓ ${label}`))
    .catch(() => showToast('Could not copy — try again', 'error'))
}

export function buildReceiptText(txn) {
  return [
    '📋 Transaction Receipt — FundPro',
    '──────────────────────────',
    `Date:        ${formatDate(txn.date)}`,
    `Description: ${txn.description}`,
    txn.category_name ? `Category:    ${txn.category_name}` : null,
    txn.person_name   ? `Person:      ${txn.person_name}` : null,
    txn.payment_method ? `Via:         ${txn.payment_method}` : null,
    `Amount:      ${formatCurrency(txn.amount)}`,
    '──────────────────────────',
  ].filter(Boolean).join('\n')
}

function DetailModal({ isOpen, onClose, title, icon, transactions, total }) {
  const [position, setPosition] = useState(null)
  const [size, setSize]         = useState({ width: 700, height: null })
  const [copiedTxn, setCopiedTxn]       = useState(null)
  const [headerShared, setHeaderShared] = useState(false)
  const [downloaded, setDownloaded]     = useState(false)

  const dragRef  = useRef({ dragging: false, resizing: false, resizeDir: 'se', startX: 0, startY: 0, origX: 0, origY: 0, origW: 0, origH: 0 })
  const modalRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setPosition(null)
      setSize({ width: 700, height: null })
    }
  }, [isOpen])

  useEffect(() => {
    function onMouseMove(e) {
      const d = dragRef.current
      if (d.dragging) {
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        setPosition({ x: d.origX + dx, y: d.origY + dy })
      } else if (d.resizing) {
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        const dir = d.resizeDir

        // Width & X
        let newW, newX
        if (dir === 'se' || dir === 'ne') {
          newW = Math.max(380, d.origW + dx)
          newX = d.origX
        } else {
          newW = Math.max(380, d.origW - dx)
          newX = d.origX + d.origW - newW
        }

        // Height & Y
        let newH, newY
        if (dir === 'se' || dir === 'sw') {
          newH = Math.max(280, d.origH + dy)
          newY = d.origY
        } else {
          newH = Math.max(280, d.origH - dy)
          newY = d.origY + d.origH - newH
        }

        setSize({ width: newW, height: newH })
        setPosition({ x: newX, y: newY })
      }
    }
    function onMouseUp() {
      dragRef.current.dragging = false
      dragRef.current.resizing = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleHeaderMouseDown(e) {
    if (e.button !== 0) return
    const rect = modalRef.current.getBoundingClientRect()
    dragRef.current = { dragging: true, resizing: false, resizeDir: 'se', startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, origW: rect.width, origH: rect.height }
    setPosition({ x: rect.left, y: rect.top })
    e.preventDefault()
  }

  function handleResizeMouseDown(dir, e) {
    if (e.button !== 0) return
    const rect = modalRef.current.getBoundingClientRect()
    dragRef.current = { dragging: false, resizing: true, resizeDir: dir, startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, origW: rect.width, origH: rect.height }
    setPosition({ x: rect.left, y: rect.top })
    e.preventDefault()
    e.stopPropagation()
  }

  function handleShareAll() {
    const lines = [
      `${icon} ${title} — FundPro`,
      `Total: ${formatCurrency(total)}`,
      '─────────────────────────',
    ]
    transactions.forEach(txn => {
      const person = txn.person_name ? `  (${txn.person_name})` : ''
      lines.push(`${formatDate(txn.date)}  ${txn.description}${person}  ${formatCurrency(txn.amount)}`)
    })
    doShare(lines.join('\n'), `${transactions.length} transactions copied`)
    setHeaderShared(true)
    setTimeout(() => setHeaderShared(false), 2000)
  }

  function handleDownloadCSV() {
    const rows = [['Date', 'Category', 'Description', 'Person', 'Amount']]
    transactions.forEach(txn => {
      rows.push([formatDate(txn.date), txn.category_name || '', txn.description, txn.person_name || '', txn.amount])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${title.replace(/\s+/g, '-')}-transactions.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`✓ CSV downloaded — ${transactions.length} rows`)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  function handleShareTransaction(txn) {
    doShare(buildReceiptText(txn), 'Receipt copied to clipboard')
    setCopiedTxn(txn.id)
    setTimeout(() => setCopiedTxn(null), 2000)
  }

  if (!isOpen) return null

  const modalStyle = {
    ...(position ? { position: 'fixed', left: position.x, top: position.y, transform: 'none', margin: 0 } : {}),
    width: size.width,
    ...(size.height ? { height: size.height, maxHeight: 'none' } : {}),
  }

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal-content" ref={modalRef} style={modalStyle}>

        {/* NW corner */}
        <div className="detail-resize-handle detail-resize-nw" onMouseDown={e => handleResizeMouseDown('nw', e)} />
        {/* NE corner */}
        <div className="detail-resize-handle detail-resize-ne" onMouseDown={e => handleResizeMouseDown('ne', e)} />

        {/* Header — drag handle */}
        <div className="detail-modal-header" onMouseDown={handleHeaderMouseDown}>
          <div className="detail-modal-title">
            <span className="detail-icon">{icon}</span>
            <h2>{title}</h2>
          </div>
          <div className="detail-header-actions">
            <button
              className={`detail-action-btn ${headerShared ? 'done' : ''}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={handleShareAll}
              title="Share all transactions"
            >
              {headerShared ? <CheckIcon /> : <ShareIcon />}
            </button>
            <button
              className={`detail-action-btn ${downloaded ? 'done' : ''}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={handleDownloadCSV}
              title="Download CSV"
            >
              {downloaded ? <CheckIcon /> : <DownloadIcon />}
            </button>
            <button className="detail-close-btn" onMouseDown={e => e.stopPropagation()} onClick={onClose}>×</button>
          </div>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="date-cell">{formatDate(txn.date)}</td>
                    <td className="desc-cell">{txn.description}</td>
                    <td className="person-cell">{txn.person_name || '-'}</td>
                    <td className="amount-cell">{formatCurrency(txn.amount)}</td>
                    <td className="share-cell">
                      <button
                        className={`txn-share-btn ${copiedTxn === txn.id ? 'done' : ''}`}
                        onClick={() => handleShareTransaction(txn)}
                        title="Share receipt"
                      >
                        {copiedTxn === txn.id ? <CheckIcon size={13} /> : <ShareIcon size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-transactions">No transactions found</div>
          )}
        </div>

        {/* SW corner */}
        <div className="detail-resize-handle detail-resize-sw" onMouseDown={e => handleResizeMouseDown('sw', e)} />
        {/* SE corner */}
        <div className="detail-resize-handle detail-resize-se" onMouseDown={e => handleResizeMouseDown('se', e)} />
      </div>
    </div>
  )
}

export default DetailModal
