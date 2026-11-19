# Foresite Rhythm

An offline-first personal routine companion. Application data is stored in IndexedDB on the current browser profile. There is no account, application backend, analytics, or third-party data service.

## Run locally

```sh
npm install
npm run dev
```

The dev server is for development. To exercise the production service worker and offline shell:

```sh
npm run build
npm run preview
```

The first online visit caches the app shell. Routine activity and backups remain local to that browser. Clearing site data can erase local records, so use **Settings → Export backup** regularly.

## Checks

```sh
npm run test:unit
npm run test:e2e
```

The end-to-end suite uses Chromium with a 390 × 844 mobile viewport and checks IndexedDB persistence, routine edits, goals, reviews, offline shell loading, and the mobile layout. It does not replace a final Safari/iOS device check.

## Install on iPhone

An iPhone needs the app on a secure HTTPS origin to install it as a home-screen web app and enable its service worker. Deploy the static `dist/` output to an HTTPS static host, open its URL in Safari, let the first visit finish, then use **Share → Add to Home Screen**. Launch it once while online before testing with Airplane Mode.

`vercel.json` and `netlify.toml` contain static-build, SPA fallback, and service-worker cache settings. The PWA manifest, PNG icons, iOS touch icon, and iPhone 12 startup image are included. Reminders are explicitly marked unavailable; no notification permission is requested.

## Data and backups

The IndexedDB schema is versioned in `src/db.ts`. Exported JSON backups include a format version and can be merged or restored after validation and confirmation. A restore replaces local app data, so export a copy first if the current device has records worth keeping.
