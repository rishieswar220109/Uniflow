export interface RegisterFormValues {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export interface LoginFormValues {
  email: string
  password: string
}

export type FormErrors<T> = Partial<Record<keyof T, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Enter a valid email address, such as name@example.com.'
  }
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Enter your password.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password.length > 128) return 'Password must be at most 128 characters.'
  if (!/[A-Za-z]/.test(password)) return 'Password must include a letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  return undefined
}

export function validateRegistration(
  values: RegisterFormValues,
): FormErrors<RegisterFormValues> {
  const errors: FormErrors<RegisterFormValues> = {}

  if (!values.fullName.trim()) {
    errors.fullName = 'Enter your full name.'
  } else if (values.fullName.trim().length < 2) {
    errors.fullName = 'Your name must be at least 2 characters.'
  } else if (values.fullName.trim().length > 120) {
    errors.fullName = 'Your name must be at most 120 characters.'
  }

  const emailError = validateEmail(values.email)
  if (emailError) errors.email = emailError

  const passwordError = validatePassword(values.password)
  if (passwordError) errors.password = passwordError

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function validateLogin(
  values: LoginFormValues,
): FormErrors<LoginFormValues> {
  const errors: FormErrors<LoginFormValues> = {}
  const emailError = validateEmail(values.email)
  if (emailError) errors.email = emailError
  if (!values.password) errors.password = 'Enter your password.'
  return errors
}
