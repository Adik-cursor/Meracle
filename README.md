# Meracle Demo v1

Meracle Demo v1 is a browser-based demonstration of the Meracle CRM workspace. It is intended for evaluating the interface and client-side workflows with fictional data.

## Technology

- React 19
- TypeScript 6
- Vite 8
- PDF generation with `pdf-lib`

## Run locally

Requirements: Node.js and npm.

```bash
npm ci
npm run dev
```

Vite prints the local development URL in the terminal.

## Checks and production build

```bash
npm run lint
npm run build
npm run preview
```

The production build is written to `dist/`. `npm run build` runs the TypeScript project build before Vite creates the static files.

## Deploy to Vercel

Import the repository into Vercel and use these project settings:

- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_DEMO_MODE` to `true` in the Vercel project environment variables for the public demo build. The flag is applied only to production builds; local `npm run dev` keeps the existing development mode.

The root `vercel.json` rewrites application paths to `index.html` so the client-side router can handle direct links and page refreshes.

## Demo data and limitations

- Business data and the current session are stored locally in the visitor's browser (`localStorage`). Data normally remains in that browser profile after refresh, but is not shared with other visitors, devices, or browser profiles.
- There is no backend API or shared database in this version. A change made by one visitor is not visible to another visitor.
- The current sign-in flow selects a locally stored user and does not use a password or secure server-side authentication. It is not suitable for protecting real accounts or confidential data.
- A fresh local-development browser store initializes a platform account, organizations, business-type catalog entries, and module settings. A production build with `VITE_DEMO_MODE=true` uses a separate browser-storage key, omits Platform Owner, and creates synthetic company-role profiles. It does not provide a complete realistic dataset of customers, sales, or inventory.
- Use only fictional data. Do not enter real customer, employee, financial, health, or other personal information.
- Browser storage can be unavailable or reach its quota; persistence failures are not backed by a server or automatic recovery mechanism.
- The interface loads Manrope from Google Fonts, so that font request requires an internet connection.

This demo is not a multi-user SaaS deployment and should not be used as a production system of record.
