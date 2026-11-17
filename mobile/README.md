# Mobile Application

Expo (React Native) client for AI Payment Guardian, built with Expo Router and
TypeScript.

Phase 1 provides Welcome, Register, Login, Dashboard, Profile and Settings
screens. The dashboard intentionally shows no financial data.

## Run

```powershell
npm install
npx expo start
```

Then open an Android emulator, iOS simulator or Expo Go.

The default API URL is `http://localhost:8000/api/v1`. On a physical device,
point it at your computer's LAN address:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:8000/api/v1"
npx expo start
```

The backend must be reachable from the device. Native apps are not subject to
browser CORS, but any Expo web preview is.

## Checks

```powershell
npx tsc --noEmit
npx expo export --platform web
```

There is no automated mobile test suite yet. See
`../phases/PHASE_1_PROGRESS.md` for what has and has not been verified.

## Structure

```
app/                  Expo Router screens
├── index.tsx         Welcome
├── login.tsx
├── register.tsx
├── (app)/            Authenticated tabs
│   ├── _layout.tsx   Tab navigator and auth guard
│   ├── dashboard.tsx
│   ├── profile.tsx
│   └── settings.tsx
└── +not-found.tsx
src/
├── components/ui/    Shared UI primitives
├── features/auth/    Auth context and validation
├── services/         Axios client, API wrappers, secure storage
├── theme/            Colours and theme hook
└── utils/            Formatting and error extraction
```

## Session model

- Access token: in memory only.
- Refresh token: `expo-secure-store` (keychain/keystore), with rotation on every
  refresh.
- Requests send `X-Client-Platform: mobile` so the backend returns the refresh
  token in JSON.
- A 401 triggers one refresh-and-retry. A second failure clears the session and
  returns to sign-in.
- The Expo **web** preview has no SecureStore, so it keeps the refresh token in
  memory for that session only. This is not the native behaviour.

## Notes

- `app.json` must remain valid JSON and `package.json` must stay BOM-free.
- Static hosting of an Expo web export needs SPA fallback for deep links.
- Native device/emulator execution and SecureStore on a real keychain remain
  manual verification items.
