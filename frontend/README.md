# Vastra frontend — Next.js App Router

## Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

Server-only configuration in `.env.local`:

- `API_URL` — FastAPI base URL (default `http://127.0.0.1:8000`)
- `AUTH_COOKIE_MAX_AGE_HOURS` — keep aligned with backend `JWT_EXPIRE_HOURS`

Do not put backend secrets or Nebius credentials in frontend env files.

Sessions use an HttpOnly cookie set by `/api/auth/*` route handlers. Logout clears the cookie; it does not revoke the backend JWT.

Style Profile uses `/api/profile` (GET/PUT/DELETE) with the same cookie session. Wardrobe CRUD UI is not connected yet.

## Scripts

- `npm run dev` — development server
- `npm run dev:clean` — clear `.next` cache, then start the dev server (use if you see 500 / MODULE_NOT_FOUND)
- `npm test` — auth proxy / cookie tests
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript
- `npm run build` — production build (stop `npm run dev` first)
- `npm start` — serve production build
