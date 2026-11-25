import { describe, expect, it } from 'vitest'

import {
  validateEmail,
  validateLogin,
  validatePassword,
  validateRegistration,
} from '../features/auth/validation'

describe('authentication form validation', () => {
  it('requires all registration fields', () => {
    const errors = validateRegistration({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    })
    expect(errors.fullName).toBe('Enter your full name.')
    expect(errors.email).toBe('Enter your email address.')
    expect(errors.password).toBe('Enter your password.')
    expect(errors.confirmPassword).toBe('Confirm your password.')
  })

  it('rejects invalid email addresses', () => {
    expect(validateEmail('not-an-email')).toMatch(/valid email/i)
    expect(validateEmail('name@example.com')).toBeUndefined()
  })

  it('enforces password strength', () => {
    expect(validatePassword('short')).toMatch(/8 characters/i)
    expect(validatePassword('lettersOnly')).toMatch(/number/i)
    expect(validatePassword('12345678')).toMatch(/letter/i)
    expect(validatePassword('Guardian123')).toBeUndefined()
  })

  it('detects mismatched passwords', () => {
    const errors = validateRegistration({
      fullName: 'Asha Verma',
      email: 'asha@example.com',
      password: 'Guardian123',
      confirmPassword: 'Guardian124',
    })
    expect(errors.confirmPassword).toBe('Passwords do not match.')
    expect(errors.email).toBeUndefined()
    expect(errors.password).toBeUndefined()
  })

  it('accepts a complete registration form', () => {
    expect(
      validateRegistration({
        fullName: 'Asha Verma',
        email: 'asha@example.com',
        password: 'Guardian123',
        confirmPassword: 'Guardian123',
      }),
    ).toEqual({})
  })

  it('requires login credentials', () => {
    const errors = validateLogin({ email: '', password: '' })
    expect(errors.email).toBeTruthy()
    expect(errors.password).toBe('Enter your password.')
  })
})
