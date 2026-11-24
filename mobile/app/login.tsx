import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Alert } from '../src/components/ui/Alert'
import { Button } from '../src/components/ui/Button'
import { Card } from '../src/components/ui/Card'
import { Logo } from '../src/components/ui/Logo'
import { PageLoader } from '../src/components/ui/PageLoader'
import { Screen } from '../src/components/ui/Screen'
import { TextField } from '../src/components/ui/TextField'
import { useAuth } from '../src/features/auth/AuthContext'
import {
  validateLogin,
  type FormErrors,
  type LoginFormValues,
} from '../src/features/auth/validation'
import { spacing } from '../src/theme'
import { useAppTheme } from '../src/theme/useAppTheme'
import { extractApiError } from '../src/utils/errors'

const initialValues: LoginFormValues = { email: '', password: '' }

export default function LoginScreen() {
  const router = useRouter()
  const { colors } = useAppTheme()
  const { login, status } = useAuth()
  const [values, setValues] = useState<LoginFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [router, status])

  if (status === 'loading') {
    return <PageLoader label="Checking your secure session…" />
  }

  const update = (key: keyof LoginFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setApiError(null)
  }

  const submit = async () => {
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setApiError(null)
    try {
      await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })
      router.replace('/dashboard')
    } catch (error) {
      setApiError(extractApiError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topRow}>
        <Logo compact />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to welcome"
          onPress={() => router.replace('/')}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={16} color={colors.muted} />
          <Text style={[styles.backText, { color: colors.muted }]}>Home</Text>
        </Pressable>
      </View>

      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Sign in to your secure UniFlow workspace.
        </Text>
      </View>

      {apiError ? <Alert message={apiError} /> : null}

      <Card>
        <TextField
          label="Email address"
          placeholder="you@example.com"
          value={values.email}
          onChangeText={(text) => update('email', text)}
          error={errors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          placeholder="Enter your password"
          value={values.password}
          onChangeText={(text) => update('password', text)}
          error={errors.password}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button
          label="Sign in securely"
          onPress={submit}
          loading={submitting}
        />
      </Card>

      <View style={styles.switchRow}>
        <Text style={[styles.switchCopy, { color: colors.muted }]}>
          New to UniFlow?
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/register')}
        >
          <Text style={[styles.switchLink, { color: colors.primary }]}>
            Create an account
          </Text>
        </Pressable>
      </View>

      <View style={styles.note}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.subtle} />
        <Text style={[styles.noteText, { color: colors.subtle }]}>
          UniFlow never asks for banking passwords, UPI PINs, OTPs or CVVs.
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
  },
  heading: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  switchCopy: {
    fontSize: 13,
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    justifyContent: 'center',
    paddingTop: spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
})
