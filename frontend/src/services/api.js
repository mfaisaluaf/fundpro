/**
 * API Service
 * Handles all communication with the backend
 */

const API_BASE = 'http://localhost:3001/api'

// Helper function for API calls
async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errBody = await response.json()
      errMsg = errBody.error || errBody.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  return response.json()
}

// ============================================
// DASHBOARD
// ============================================

export async function getDashboard(workspace) {
  return fetchAPI(`/dashboard/${workspace}`)
}

// ============================================
// TRANSACTIONS
// ============================================

export async function getTransactions(filters = {}) {
  const params = new URLSearchParams(filters)
  return fetchAPI(`/transactions?${params}`)
}

export async function addTransaction(data) {
  return fetchAPI('/transactions', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getTransaction(id) {
  return fetchAPI(`/transactions/${id}`)
}

export async function updateTransaction(id, data) {
  return fetchAPI(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteTransaction(id, password) {
  return fetchAPI(`/transactions/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ password })
  })
}

export async function getTransactionsByCategory(categoryName, workspace) {
  const params = workspace ? `?workspace=${workspace}` : ''
  return fetchAPI(`/transactions/by-category/${encodeURIComponent(categoryName)}${params}`)
}

// ============================================
// CATEGORIES
// ============================================

export async function getCategories(filters = {}) {
  const params = new URLSearchParams(filters)
  return fetchAPI(`/categories?${params}`)
}

export async function addCategory(data) {
  return fetchAPI('/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCategory(id, data) {
  return fetchAPI(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteCategory(id) {
  return fetchAPI(`/categories/${id}`, {
    method: 'DELETE'
  })
}

// ============================================
// FUNDS
// ============================================

export async function getFunds(workspace) {
  const params = workspace ? `?workspace=${workspace}` : ''
  return fetchAPI(`/funds${params}`)
}

export async function addFund(data) {
  return fetchAPI('/funds', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateFund(id, data) {
  return fetchAPI(`/funds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteFund(id) {
  return fetchAPI(`/funds/${id}`, {
    method: 'DELETE'
  })
}

export async function addFundContribution(fundId, data) {
  return fetchAPI(`/funds/${fundId}/contribute`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ============================================
// PEOPLE
// ============================================

export async function getPeople() {
  return fetchAPI('/people')
}

export async function addPerson(data) {
  return fetchAPI('/people', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updatePerson(id, data) {
  return fetchAPI(`/people/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deletePerson(id) {
  return fetchAPI(`/people/${id}`, {
    method: 'DELETE'
  })
}

// ============================================
// BANK ACCOUNTS
// ============================================

export async function getBankAccounts() {
  return fetchAPI('/bank-accounts')
}

// ============================================
// CREDIT CARDS
// ============================================

export async function getCreditCards() {
  return fetchAPI('/credit-cards')
}

// ============================================
// SETTINGS
// ============================================

export async function getSettings() {
  return fetchAPI('/settings')
}

export async function updateSetting(key, value) {
  return fetchAPI(`/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  })
}

// ============================================
// PAYMENT METHODS
// ============================================

export async function getPaymentMethods() {
  return fetchAPI('/payment-methods')
}

export async function addPaymentMethod(data) {
  return fetchAPI('/payment-methods', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updatePaymentMethod(id, data) {
  return fetchAPI(`/payment-methods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deletePaymentMethod(id) {
  return fetchAPI(`/payment-methods/${id}`, {
    method: 'DELETE'
  })
}

// ============================================
// DASHBOARD CONFIG
// ============================================

export async function getDashboardConfig() {
  return fetchAPI('/dashboard-config')
}

export async function updateDashboardConfig(config) {
  return fetchAPI('/dashboard-config', {
    method: 'PUT',
    body: JSON.stringify({ config })
  })
}

// ============================================
// QUANTITY UNITS
// ============================================

export async function getQuantityUnits() {
  return fetchAPI('/quantity-units')
}

export async function addQuantityUnit(data) {
  return fetchAPI('/quantity-units', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateQuantityUnit(id, data) {
  return fetchAPI(`/quantity-units/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteQuantityUnit(id) {
  return fetchAPI(`/quantity-units/${id}`, {
    method: 'DELETE'
  })
}

// ============================================
// FUND LOCATIONS / TRANSFERS / REALLOCATIONS
// ============================================

export async function getFundsWithLocations(workspace) {
  const params = workspace ? `?workspace=${workspace}` : ''
  return fetchAPI(`/funds-with-locations${params}`)
}

export async function getFundLocations(fundId) {
  return fetchAPI(`/funds/${fundId}/locations`)
}

export async function createFundTransfer(data) {
  return fetchAPI('/fund-transfers', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getFundTransfers() {
  return fetchAPI('/fund-transfers')
}

export async function createFundReallocation(data) {
  return fetchAPI('/fund-reallocations', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getFundReallocations(fundId) {
  const params = fundId ? `?fund_id=${fundId}` : ''
  return fetchAPI(`/fund-reallocations${params}`)
}

// ============================================
// WORKSPACES
// ============================================

export async function getWorkspaces() {
  return fetchAPI('/workspaces')
}

export async function resetWorkspace(workspace_id, password) {
  return fetchAPI('/reset-workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id, password })
  })
}
