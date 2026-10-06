# Vastra frontend — Next.js App Router shell

## Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

`NEXT_PUBLIC_API_URL` points at the FastAPI backend. Do not put backend secrets or Nebius credentials in frontend env files.

## Scripts

- `npm run dev` — development server
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — serve production build
