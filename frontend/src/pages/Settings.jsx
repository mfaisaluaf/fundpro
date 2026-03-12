import { useState, useEffect } from 'react'
import { getSettings, updateSetting } from '../services/api'
import './Settings.css'

const AVATAR_COLORS = [
  { value: '#10B981', label: 'Green' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#1e293b', label: 'Dark' }
]

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY']

function Settings() {
  const [activeTab, setActiveTab] = useState('profile')

  // Profile state
  const [profileName, setProfileName] = useState('Faisal')
  const [appName, setAppName] = useState('FundPro')
  const [avatarColor, setAvatarColor] = useState('#10B981')

  // General state
  const [currency, setCurrency] = useState('Rs')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [fridayBudget, setFridayBudget] = useState('8000')

  // Workspace visibility (localStorage)
  const [visibleWorkspaces, setVisibleWorkspaces] = useState({
    office: true, personal: true, treat: true
  })

  // Security state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSettings()
    const saved = localStorage.getItem('workspaceVisibility')
    if (saved) setVisibleWorkspaces(JSON.parse(saved))
  }, [])

  async function loadSettings() {
    try {
      const s = await getSettings()
      if (s.profile_name) setProfileName(s.profile_name)
      if (s.app_name) setAppName(s.app_name)
      if (s.avatar_color) setAvatarColor(s.avatar_color)
      if (s.currency) setCurrency(s.currency)
      if (s.date_format) setDateFormat(s.date_format)
      if (s.friday_weekly_budget) setFridayBudget(s.friday_weekly_budget)
    } catch (err) {
      setError('Failed to load settings: ' + err.message)
    }
  }

  function showMsg(msg) {
    setSuccess(msg)
    setError('')
    setTimeout(() => setSuccess(''), 3000)
  }

  // Profile save
  async function saveProfile() {
    setSaving(true)
    setError('')
    try {
      await Promise.all([
        updateSetting('profile_name', profileName.trim() || 'Faisal'),
        updateSetting('app_name', appName.trim() || 'FundPro')
      ])
      showMsg('Profile saved successfully')
      // Notify MainLayout to update avatar
      window.dispatchEvent(new StorageEvent('storage', { key: 'profile_settings' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Avatar color — save immediately on click
  async function saveAvatarColor(color) {
    setAvatarColor(color)
    try {
      await updateSetting('avatar_color', color)
      window.dispatchEvent(new StorageEvent('storage', { key: 'profile_settings' }))
    } catch (err) {
      setError('Failed to save color: ' + err.message)
    }
  }

  // General save
  async function saveGeneral() {
    setSaving(true)
    setError('')
    try {
      await Promise.all([
        updateSetting('currency', currency.trim() || 'Rs'),
        updateSetting('date_format', dateFormat),
        updateSetting('friday_weekly_budget', fridayBudget)
      ])
      showMsg('General settings saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Workspace toggle
  function toggleWorkspace(key) {
    const enabled = Object.values(visibleWorkspaces).filter(Boolean).length
    if (enabled === 1 && visibleWorkspaces[key]) return // keep at least one

    const updated = { ...visibleWorkspaces, [key]: !visibleWorkspaces[key] }
    setVisibleWorkspaces(updated)
    localStorage.setItem('workspaceVisibility', JSON.stringify(updated))
    // Notify MainLayout
    window.dispatchEvent(new StorageEvent('storage', { key: 'workspaceVisibility', newValue: JSON.stringify(updated) }))
  }

  // Security save
  async function savePassword() {
    setError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters')
      return
    }
    setSaving(true)
    try {
      const s = await getSettings()
      const storedPw = s.admin_password || ''
      if (currentPassword !== storedPw) {
        setError('Current password is incorrect')
        setSaving(false)
        return
      }
      await updateSetting('admin_password', newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showMsg('Password changed successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const initials = profileName.trim()
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'FA'

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header-row">
        <div className="settings-avatar-preview" style={{ background: avatarColor }}>
          {initials}
        </div>
        <div>
          <h1 className="settings-title">{profileName}</h1>
          <p className="settings-subtitle">Profile &amp; App Settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'general', label: 'General' },
          { key: 'workspaces', label: 'Workspaces' },
          { key: 'security', label: 'Security' }
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.key); setError(''); setSuccess('') }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      {/* ─── Profile Tab ─── */}
      {activeTab === 'profile' && (
        <div className="settings-card">
          <h2 className="settings-card-title">Profile Information</h2>

          <div className="settings-form-group">
            <label>Your Name</label>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="settings-form-group">
            <label>App Name</label>
            <input
              type="text"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="App name shown in sidebar"
            />
          </div>

          <div className="settings-form-group">
            <label>Avatar Color</label>
            <div className="color-swatches">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`color-swatch ${avatarColor === c.value ? 'selected' : ''}`}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => saveAvatarColor(c.value)}
                />
              ))}
            </div>
            <p className="settings-hint">Color updates immediately — click to change</p>
          </div>

          <div className="settings-form-actions">
            <button className="settings-save-btn" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      )}

      {/* ─── General Tab ─── */}
      {activeTab === 'general' && (
        <div className="settings-card">
          <h2 className="settings-card-title">General Settings</h2>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label>Currency Symbol</label>
              <input
                type="text"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                maxLength={5}
                placeholder="Rs"
              />
            </div>

            <div className="settings-form-group">
              <label>Date Format</label>
              <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                {DATE_FORMATS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-form-group">
            <label>Friday Lunch Weekly Budget (Rs)</label>
            <input
              type="number"
              value={fridayBudget}
              onChange={e => setFridayBudget(e.target.value)}
              min="0"
              placeholder="8000"
            />
            <p className="settings-hint">Used to calculate Friday lunch budget on the Office dashboard</p>
          </div>

          <div className="settings-form-actions">
            <button className="settings-save-btn" onClick={saveGeneral} disabled={saving}>
              {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Workspaces Tab ─── */}
      {activeTab === 'workspaces' && (
        <div className="settings-card">
          <h2 className="settings-card-title">Workspace Visibility</h2>
          <p className="settings-card-subtitle">Show or hide workspaces in the top navigation bar</p>

          <div className="workspace-toggle-list">
            {[
              { key: 'office', emoji: '🏢', label: 'Office', desc: 'Company expenses, payables, receivables' },
              { key: 'personal', emoji: '👤', label: 'Personal', desc: 'Home finances, savings, loans, budgets' },
              { key: 'treat', emoji: '🎉', label: 'Treat', desc: 'Group treat/outing fund' }
            ].map(ws => (
              <div key={ws.key} className="workspace-toggle-row">
                <div className="workspace-toggle-info">
                  <span className="workspace-toggle-emoji">{ws.emoji}</span>
                  <div>
                    <div className="workspace-toggle-label">{ws.label}</div>
                    <div className="workspace-toggle-desc">{ws.desc}</div>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={visibleWorkspaces[ws.key] || false}
                    onChange={() => toggleWorkspace(ws.key)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
          </div>

          <p className="settings-hint" style={{ marginTop: 16 }}>
            At least one workspace must remain visible. Changes apply immediately.
          </p>
        </div>
      )}

      {/* ─── Security Tab ─── */}
      {activeTab === 'security' && (
        <div className="settings-card">
          <h2 className="settings-card-title">Change Password</h2>
          <p className="settings-card-subtitle">Used to confirm deletions and sensitive actions across the app</p>

          <div className="settings-form-group">
            <label>Current Password</label>
            <div className="pw-field-wrap">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button className="pw-toggle" onClick={() => setShowCurrentPw(p => !p)}>
                {showCurrentPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="settings-form-group">
            <label>New Password</label>
            <div className="pw-field-wrap">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <button className="pw-toggle" onClick={() => setShowNewPw(p => !p)}>
                {showNewPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="settings-form-group">
            <label>Confirm New Password</label>
            <div className="pw-field-wrap">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
              <button className="pw-toggle" onClick={() => setShowConfirmPw(p => !p)}>
                {showConfirmPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="settings-form-actions">
            <button className="settings-save-btn" onClick={savePassword} disabled={saving}>
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
