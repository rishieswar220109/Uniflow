import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { StyleSheet } from 'react-native'

import { PageLoader } from '../../src/components/ui/PageLoader'
import { useAuth } from '../../src/features/auth/AuthContext'
import { useAppTheme } from '../../src/theme/useAppTheme'

export default function AppLayout() {
  const { status } = useAuth()
  const { colors } = useAppTheme()

  if (status === 'loading') {
    return <PageLoader label="Checking your session…" />
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 7,
        },
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
})
