import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Layout
import MainLayout from './layouts/MainLayout'

// Pages
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Funds from './pages/Funds'
import CreditCards from './pages/CreditCards'
import Loans from './pages/Loans'
import Investments from './pages/Investments'
import Savings from './pages/Savings'
import Budgets from './pages/Budgets'
import GroupExpenses from './pages/GroupExpenses'
import Receivables from './pages/Receivables'
import Reports from './pages/Reports'
import Admin from './pages/Admin'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="funds" element={<Funds />} />
          <Route path="credit-cards" element={<CreditCards />} />
          <Route path="loans" element={<Loans />} />
          <Route path="investments" element={<Investments />} />
          <Route path="savings" element={<Savings />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="group-expenses" element={<GroupExpenses />} />
          <Route path="receivables" element={<Receivables />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<Admin />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
