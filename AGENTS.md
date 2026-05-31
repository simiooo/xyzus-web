# xyz-web — Podcast Web Client (小宇宙)

## Stack

React 19 + TypeScript 6 + Vite 8 + Ant Design 6 + Alova 3 + Zustand 5 + React Router 7 + Tailwind CSS 3

## Commands

```sh
pnpm dev        # start Vite dev server (proxies API to http://localhost:23020)
pnpm build      # tsc -b && vite build (typecheck first)
pnpm lint       # ESLint flat config (eslint.config.js)
pnpm preview    # vite preview
```

No test suite, no formatter config, no CI, no pre-commit hooks.

## Key conventions

- **Package manager**: pnpm (never npm/yarn).
- **Path alias**: `@/` → `src/` (all internal imports use this).
- **Component exports**: default exports everywhere.
- **Styling**: Tailwind utility classes. Ant Design components for UI primitives. Theme in `src/theme.ts` — dark theme with orange accent (`#FF7A45`).
- **Tailwind caveat**: `preflight: false` in config — no CSS reset (Ant Design manages its own). Do not rely on Tailwind base styles.
- **State**: Zustand stores in `src/stores/`.
- **API client**: Alova (`src/alova.ts`). **All endpoints use POST** (Xiaoyuzhou API convention). Auth token injected via `beforeRequest` interceptor. Automatic 401 → token refresh → retry logic.

## Architecture notes

- **React Compiler**: enabled via `@rolldown/plugin-babel` + `babel-plugin-react-compiler` in `vite.config.ts`.
- **Router**: `createBrowserRouter` (React Router 7 data router) in `src/router.tsx`. Lazy-loaded pages with `React.lazy` + `Suspense`.
- **Auth**: Phone + verification code. `AuthGuard` wraps all routes except `/login`. Token refresh on startup + on 401. Emits `auth:expired` custom event on failure.
- **Layout**: Three-column responsive (sidebar / main / right panel). MiniPlayer fixed bottom. MobileNav replaces sidebar on small screens.
- **API layer**: `src/api/` — one file per domain (auth, podcast, episode, search, comment, category, user, subscription, discovery).
- **Env**: `VITE_API_BASE_URL` in `.env` / `.env.development`.
