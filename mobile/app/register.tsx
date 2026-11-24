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
  validateRegistration,
  type FormErrors,
  type RegisterFormValues,
} from '../src/features/auth/validation'
import { spacing } from '../src/theme'
import { useAppTheme } from '../src/theme/useAppTheme'
import { extractApiError } from '../src/utils/errors'

const initialValues: RegisterFormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export default function RegisterScreen() {
  const router = useRouter()
  const { colors } = useAppTheme()
  const { register, status } = useAuth()
  const [values, setValues] = useState<RegisterFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<RegisterFormValues>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [router, status])

  if (status === 'loading') {
    return <PageLoader label="Preparing your secure workspace…" />
  }

  const update = (key: keyof RegisterFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setApiError(null)
  }

  const submit = async () => {
    const nextErrors = validateRegistration(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setApiError(null)
    try {
      await register({
        full_name: values.fullName.trim().replace(/\s+/g, ' '),
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
        <Text style={[styles.title, { color: colors.text }]}>
          Create your account
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Set up a secure UniFlow workspace in under a minute.
        </Text>
      </View>

      {apiError ? <Alert message={apiError} /> : null}

      <Card>
        <TextField
          label="Full name"
          placeholder="e.g. Asha Verma"
          value={values.fullName}
          onChangeText={(text) => update('fullName', text)}
          error={errors.fullName}
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="name"
          returnKeyType="next"
        />
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
          placeholder="Create a password"
          value={values.password}
          onChangeText={(text) => update('password', text)}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
          secure
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          returnKeyType="next"
        />
        <TextField
          label="Confirm password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChangeText={(text) => update('confirmPassword', text)}
          error={errors.confirmPassword}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button
          label="Create secure account"
          onPress={submit}
          loading={submitting}
        />
      </Card>

      <Text style={[styles.legal, { color: colors.subtle }]}>
        By creating an account, you confirm that these details are yours and
        that you will keep your sign-in credentials private. UniFlow never asks
        for banking passwords, UPI PINs, OTPs or CVVs.
      </Text>

      <View style={styles.switchRow}>
        <Text style={[styles.switchCopy, { color: colors.muted }]}>
          Already have an account?
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/login')}
        >
          <Text style={[styles.switchLink, { color: colors.primary }]}>
            Sign in
          </Text>
        </Pressable>
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
    paddingTop: spacing.lg,
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
  legal: {
    fontSize: 11,
    lineHeight: 16,
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
})
