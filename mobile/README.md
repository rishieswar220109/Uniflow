# Mobile Application

Expo (React Native) client for UniFlow, built with Expo Router and
TypeScript.

Phases 1 and 2 are implemented: authentication, profile and settings, plus
consent-based accounts, transactions, bills, subscriptions, upcoming payments
and a dashboard summary. The financial data comes from the mock provider and is
labelled as mock throughout. No payment is executed and no AI feature exists yet.

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

There is no automated mobile test suite yet. Phase 2 verification is limited to
TypeScript; see [`../phases/PHASE_2_PROGRESS.md`](../phases/PHASE_2_PROGRESS.md)
for what has and has not been verified.

## Structure

```
app/                  Expo Router screens
├── index.tsx         Welcome
├── login.tsx
├── register.tsx
├── (app)/            Authenticated tabs
│   ├── _layout.tsx   Tab navigator and auth guard
│   ├── dashboard.tsx Summary, due soon and recent activity
│   ├── accounts.tsx  Connect, sync, revoke and balances
│   ├── transactions.tsx Filter, add, edit and delete transactions
│   ├── payments.tsx  Bills, subscriptions, upcoming and suggestions
│   ├── profile.tsx
│   └── settings.tsx
└── +not-found.tsx
src/
├── components/ui/    Shared UI primitives
├── components/finance/ Finance-specific components
├── features/auth/    Auth context and validation
├── services/         Axios client, API wrappers, secure storage
├── theme/            Colours and theme hook
└── utils/            Formatting and error extraction
```

## Session model

- Access token: in memory only.
- Refresh token: `expo-secure-store` (keychain/keystore), with rotation on every
  refresh.
- Mobile registration and login send `X-Client-Platform: mobile` so the backend
  returns the refresh token in JSON. On refresh, the token is sent in the
  request body and the rotated token is returned in JSON.
- A 401 triggers one refresh-and-retry. A second failure clears the session and
  returns to sign-in.
- The Expo **web** preview has no SecureStore, so it keeps the refresh token in
  memory for that session only. This is not the native behaviour.

## Notes

- Bill and subscription payments are records only; no money moves.
- `autopay` is a stored preference and reminder lead times are shown, but no
  notification is delivered.
- Mock data is flagged in the UI. Only the mock bank provider is bundled.
- `app.json` must remain valid JSON and `package.json` must stay BOM-free.
- Static hosting of an Expo web export needs SPA fallback for deep links.
- Native device/emulator execution and SecureStore on a real keychain remain
  manual verification items.
