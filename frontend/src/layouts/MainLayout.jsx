import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { getSettings } from '../services/api'
import './MainLayout.css'

// Default workspace visibility
const defaultVisibility = { office: true, personal: true, treat: true }

// Workspace-specific navigation menus
const workspaceMenus = {
  office: [
    {
      label: 'Main',
      items: [
        { to: '/', icon: '📊', label: 'Dashboard' },
        { to: '/transactions', icon: '📋', label: 'Transactions' },
        { to: '/funds', icon: '💼', label: 'Funds' }
      ]
    },
    {
      label: 'Analysis',
      items: [
        { to: '/reports', icon: '📑', label: 'Reports' },
        { to: '/admin', icon: '⚙️', label: 'Admin Panel' },
        { to: '/settings', icon: '👤', label: 'Profile & Settings' }
      ]
    }
  ],
  personal: [
    {
      label: 'Main',
      items: [
        { to: '/', icon: '📊', label: 'Dashboard' },
        { to: '/transactions', icon: '📋', label: 'Transactions' }
      ]
    },
    {
      label: 'Finance',
      items: [
        { to: '/budgets', icon: '🎯', label: 'Budgets' },
        { to: '/savings', icon: '🏷️', label: 'Savings' },
        { to: '/credit-cards', icon: '💳', label: 'Credit Cards' },
        { to: '/loans', icon: '🏦', label: 'Loans' }
      ]
    },
    {
      label: 'Analysis',
      items: [
        { to: '/reports', icon: '📑', label: 'Reports' },
        { to: '/admin', icon: '⚙️', label: 'Admin Panel' },
        { to: '/settings', icon: '👤', label: 'Profile & Settings' }
      ]
    }
  ],
  treat: [
    {
      label: 'Main',
      items: [
        { to: '/', icon: '📊', label: 'Dashboard' },
        { to: '/contributions', icon: '💰', label: 'Contributions' },
        { to: '/transactions', icon: '🎉', label: 'Expenses' }
      ]
    },
    {
      label: 'Team',
      items: [
        { to: '/members', icon: '👥', label: 'Members' }
      ]
    },
    {
      label: 'Analysis',
      items: [
        { to: '/reports', icon: '📑', label: 'Reports' },
        { to: '/admin', icon: '⚙️', label: 'Admin Panel' },
        { to: '/settings', icon: '👤', label: 'Profile & Settings' }
      ]
    }
  ]
}

function MainLayout() {
  const navigate = useNavigate()
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    return localStorage.getItem('activeWorkspace') || 'office'
  })
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const settingsRef = useRef(null)
  const [profileName, setProfileName] = useState('Faisal')
  const [avatarColor, setAvatarColor] = useState('#10B981')
  const [appName, setAppName] = useState('FundPro')

  // Load workspace visibility from localStorage
  const [visibleWorkspaces, setVisibleWorkspaces] = useState(() => {
    const saved = localStorage.getItem('workspaceVisibility')
    return saved ? JSON.parse(saved) : defaultVisibility
  })

  // Save active workspace to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('activeWorkspace', activeWorkspace)
  }, [activeWorkspace])

  // Save visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('workspaceVisibility', JSON.stringify(visibleWorkspaces))
    // If current workspace is hidden, switch to first visible one
    if (!visibleWorkspaces[activeWorkspace]) {
      const firstVisible = Object.keys(visibleWorkspaces).find(k => visibleWorkspaces[k])
      if (firstVisible) setActiveWorkspace(firstVisible)
    }
  }, [visibleWorkspaces, activeWorkspace])

  // Load profile settings on mount + listen for changes from Settings page
  useEffect(() => {
    async function loadProfile() {
      try {
        const s = await getSettings()
        if (s.profile_name) setProfileName(s.profile_name)
        if (s.app_name) setAppName(s.app_name)
        if (s.avatar_color) setAvatarColor(s.avatar_color)
      } catch {}
    }
    loadProfile()

    function handleStorage(e) {
      if (e.key === 'workspaceVisibility' && e.newValue) {
        setVisibleWorkspaces(JSON.parse(e.newValue))
      }
      if (e.key === 'profile_settings') {
        loadProfile()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!showSettings) return
    function handleClick(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSettings])

  // Toggle workspace visibility
  const toggleWorkspace = (workspace) => {
    // Ensure at least one workspace remains visible
    const visibleCount = Object.values(visibleWorkspaces).filter(Boolean).length
    if (visibleCount === 1 && visibleWorkspaces[workspace]) return

    setVisibleWorkspaces(prev => ({ ...prev, [workspace]: !prev[workspace] }))
  }

  // Get current workspace menu
  const currentMenu = workspaceMenus[activeWorkspace] || workspaceMenus.office

  return (
    <div className="app-container">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar-mobile-open' : ''}`}>
        <div className="logo">
          <div className="logo-icon">{appName.charAt(0)}</div>
          <span className="logo-text">{appName}</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} title="Close menu">✕</button>
        </div>

        {/* Dynamic Navigation based on Workspace */}
        {currentMenu.map((section, sectionIndex) => (
          <div className="nav-section" key={sectionIndex}>
            <span className="nav-section-label">{section.label}</span>
            <ul className="nav-menu">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <NavLink to={item.to} className="nav-item" onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Main Area */}
      <div className="main-wrapper">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} title="Open menu">
              <span /><span /><span />
            </button>
            <div className="workspace-selector">
              {visibleWorkspaces.office && (
                <button
                  className={`workspace-btn ${activeWorkspace === 'office' ? 'active' : ''}`}
                  onClick={() => setActiveWorkspace('office')}
                >
                  🏢 Office
                </button>
              )}
              {visibleWorkspaces.personal && (
                <button
                  className={`workspace-btn ${activeWorkspace === 'personal' ? 'active' : ''}`}
                  onClick={() => setActiveWorkspace('personal')}
                >
                  👤 Personal
                </button>
              )}
              {visibleWorkspaces.treat && (
                <button
                  className={`workspace-btn treat ${activeWorkspace === 'treat' ? 'active' : ''}`}
                  onClick={() => setActiveWorkspace('treat')}
                >
                  🎉 Treat
                </button>
              )}

              {/* Settings Toggle */}
              <div className="workspace-settings" ref={settingsRef}>
                <button
                  className="settings-toggle"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Manage workspaces"
                >
                  ⚙️
                </button>

                {showSettings && (
                  <div className="settings-dropdown">
                    <div className="settings-header">Show/Hide Workspaces</div>
                    <label className="settings-option">
                      <input
                        type="checkbox"
                        checked={visibleWorkspaces.office}
                        onChange={() => toggleWorkspace('office')}
                      />
                      🏢 Office
                    </label>
                    <label className="settings-option">
                      <input
                        type="checkbox"
                        checked={visibleWorkspaces.personal}
                        onChange={() => toggleWorkspace('personal')}
                      />
                      👤 Personal
                    </label>
                    <label className="settings-option">
                      <input
                        type="checkbox"
                        checked={visibleWorkspaces.treat}
                        onChange={() => toggleWorkspace('treat')}
                      />
                      🎉 Treat
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="user-profile" onClick={() => navigate('/settings')}>
              <span className="user-name">{profileName}</span>
              <div className="user-avatar" style={{ background: avatarColor }}>
                {profileName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'FA'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">
          <Outlet context={{ workspace: activeWorkspace }} />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
