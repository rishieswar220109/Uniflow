import { Route, Routes } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from '../components/ProtectedRoute'
import { useAuth } from '../features/auth/AuthContext'
import { useThemePreference } from '../hooks/useThemePreference'
import { AccountsPage } from '../pages/AccountsPage'
import { BillsPage } from '../pages/BillsPage'
import { BudgetsPage } from '../pages/BudgetsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { IntelligencePage } from '../pages/IntelligencePage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProfilePage } from '../pages/ProfilePage'
import { RegisterPage } from '../pages/RegisterPage'
import { ReportsPage } from '../pages/ReportsPage'
import { SavingsGoalsPage } from '../pages/SavingsGoalsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { SpendingPreferencesPage } from '../pages/SpendingPreferencesPage'
import { SubscriptionsPage } from '../pages/SubscriptionsPage'
import { TransactionsPage } from '../pages/TransactionsPage'
import { UpcomingPage } from '../pages/UpcomingPage'
import { WelcomePage } from '../pages/WelcomePage'

export default function App() {
  const { user } = useAuth()
  useThemePreference(user?.preferences.theme)

  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/upcoming" element={<UpcomingPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/savings-goals" element={<SavingsGoalsPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route
            path="/spending-preferences"
            element={<SpendingPreferencesPage />}
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
