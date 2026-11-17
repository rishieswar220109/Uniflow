import { Route, Routes } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from '../components/ProtectedRoute'
import { useAuth } from '../features/auth/AuthContext'
import { useThemePreference } from '../hooks/useThemePreference'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProfilePage } from '../pages/ProfilePage'
import { RegisterPage } from '../pages/RegisterPage'
import { SettingsPage } from '../pages/SettingsPage'
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
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
