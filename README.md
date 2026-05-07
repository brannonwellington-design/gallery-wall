# Gallery Wall

A scaled gallery-wall planner. Set wall dimensions, drop in pieces with their real-world sizes, optionally frame them, and drag them around with snap and live measurements. Each room has its own URL and auto-saves.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without any environment variables, rooms persist to a local JSON file at `data/rooms.json` (gitignored). Useful for solo dev — but rooms won't be shared across machines.

## Connect Supabase (for shared rooms)

1. Create a Supabase project (free tier is fine).
2. In the SQL Editor, run `supabase/migrations/0001_create_rooms.sql`.
3. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` — Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → `service_role` secret
4. Restart `npm run dev`. Rooms now persist to Supabase and are visible to anyone with access to the deployment.

The service role key bypasses RLS and is **server-only**. It must never reach the browser; we only use it inside `/api/rooms` route handlers.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- React-Konva for the wall canvas
- jsPDF for export
- Supabase (Postgres) for storage, with a JSON-file fallback for dev
