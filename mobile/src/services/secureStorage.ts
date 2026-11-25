import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const REFRESH_TOKEN_KEY = 'guardian.refresh_token.v1'

// The mobile preview on web has no SecureStore. Keeping this in memory avoids
// writing long-lived credentials to browser storage; a reload requires sign-in.
let webFallback: string | null = null

export async function getStoredRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webFallback
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export async function storeRefreshToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webFallback = token
    return
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  })
}

export async function clearStoredRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webFallback = null
    return
  }
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  } catch {
    // Clearing local state must not depend on the keychain being available.
  }
}
