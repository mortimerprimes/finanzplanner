## Bank Sync Automation

The app now supports two automated balance-sync paths in the Bank Sync screen:

- Raiffeisenbank via GoCardless Bank Account Data (PSD2 / Open Banking)
- Trade Republic via a secure webhook endpoint that accepts pushed balance snapshots

Required environment variables:

```bash
GOCARDLESS_SECRET_ID=...
GOCARDLESS_SECRET_KEY=...
BANK_SYNC_CRON_SECRET=...
```

Relevant endpoints:

- `GET /api/bank-sync/providers` returns provider availability
- `GET /api/bank-sync/institutions?country=DE&query=raiffeisen` searches GoCardless institutions
- `POST /api/bank-sync/gocardless/connect` creates a PSD2 connection and returns the bank authorization URL
- `POST /api/bank-sync/sync` refreshes configured pull connections for the current user
- `GET /api/bank-sync/cron` runs pull sync for all users when called with `Authorization: Bearer $BANK_SYNC_CRON_SECRET`
- `POST /api/bank-sync/trade-republic/[connectionId]` accepts webhook pushes with `Authorization: Bearer <one-time-token>`

Trade Republic note:

There is no stable official PSD2/open-banking path here, so the app exposes a secure push endpoint instead. Generate the webhook in the UI, then let an external fetcher (server cron, GitHub Action, local scheduler) POST the current balance to the returned URL.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
