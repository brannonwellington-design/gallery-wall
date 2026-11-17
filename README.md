# Gallery Wall

A scaled gallery-wall planner. Set wall dimensions, drop in pieces with their real-world sizes, optionally frame them, and drag them around with snap and live measurements. Each room has its own URL and auto-saves.

## Run locally

Requires Node 24 (see `.nvmrc`).

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm test` | Vitest unit tests (`tests/`) for geometry, snapping, layout, redlines, validation, migrations, outbound-fetch safety and image cleanup |
| `npm run lint` / `npm run typecheck` | ESLint and `tsc --noEmit` |
| `npm run build` | Production build |

CI (`.github/workflows/ci.yml`) runs all four on every push.

Production deploys from `main`: every push to `main` builds and goes live on listen-gallerywall.vercel.app (Vercel project `gallery-wall`, Listen Labs team). Other branches get preview deployments behind Vercel login.

Without any environment variables, rooms persist to a local JSON file at `data/rooms.json` (gitignored). Useful for solo dev — but rooms won't be shared across machines.

## Connect Supabase (for shared rooms)

1. Create a Supabase project (free tier is fine).
2. In the SQL Editor, run the files in `supabase/migrations/` in order (`0001` creates the `rooms` table, `0002` the public `room-images` bucket).
3. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` — Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → `service_role` secret
4. Restart `npm run dev`. Rooms now persist to Supabase and are visible to anyone with access to the deployment.

The service role key bypasses RLS and is **server-only**. It must never reach the browser; it is only used from route handlers via `src/lib/server/supabase.ts`.

Piece images live in Storage, not in the room JSON. Files are named `<roomId>/<pieceId>-<main|original>-<contentHash>.<ext>`, so an upload never overwrites a file something still points at. Deleting a room deletes its images (except files another room still uses); duplicating a room copies them.

## Security model

The app has no login of its own — access control is Vercel Deployment Protection on the project (set it to **All Deployments** so the production domain requires a Listen Labs Vercel login). On top of that, the API defends itself:

- Saves are validated against a schema (`src/lib/roomSchema.ts`) and use compare-and-set on `updatedAt`, so a stale tab gets "Out of date · Reload" instead of overwriting someone else's work.
- Product-page and image fetches go through `src/lib/server/safeFetch.ts`, which refuses private, loopback and metadata addresses, re-checks every redirect, and caps body size.
- Background removal only accepts the app's own images; uploads only accept PNG/JPEG/WebP/GIF into existing rooms.

## Enable URL ingestion (paste a product URL)

The add-item form has a "Paste product URL" field. When you click Fetch, the server downloads the page, asks Claude to extract the product name, image, and dimensions, and pre-fills the form. To enable this, add to `.env.local`:

- `ANTHROPIC_API_KEY` — get one at https://console.anthropic.com → Settings → API Keys

When this is unset, the rest of the app works fine — only URL ingestion is disabled. Extraction uses Claude Opus 5.5 (`claude-opus-5-5`) with adaptive thinking at medium effort and structured output; the model is one constant (`EXTRACTION_MODEL`) in `src/lib/extract.ts`.

### Sites that block URL ingestion

Some retailers run bot-protection (Akamai, Cloudflare Bot Manager, PerimeterX) that returns 403 to any plain HTTP request, especially from cloud IPs like Vercel's. **West Elm, Pottery Barn, and some Etsy listings** fall in this bucket. For those, **screenshot the product page in your browser and drop the screenshot into the form** — Claude reads the dimensions from the image with vision. Works on any site since your browser already passed the bot check.

The image area in the add-form supports:

- Drag and drop from your desktop or another browser tab
- Paste from clipboard (⌘V) — screenshot then paste, or copy an image
- Click to choose a file

Society6, Minted, Redbubble, and Shopify-hosted indie shops generally just work with the URL paste.

If you want the URL path to work on Akamai-protected sites, add a `SCRAPINGBEE_API_KEY` to `.env.local` (and to your Vercel project env). The extractor automatically falls back to ScrapingBee when a direct fetch hits 401/403/429/503/520+. Each premium-proxy fetch uses 10 ScrapingBee credits (~$0.005 at paid tier; the 1000-credit free trial covers about 100 retailer fetches).

## Enable background removal (optional)

Each piece in the Pieces list has a scissors button that strips the listing-photo background — useful for unframed pieces or busy lifestyle shots. To enable, add to `.env.local` (and to your Vercel project env):

- `REPLICATE_API_TOKEN` — get one at https://replicate.com/account/api-tokens

Each call costs about $0.001 and takes 5–8 seconds. The original image is kept, so pressing the button again restores it.

## Image cleanup (scheduled)

`vercel.json` runs `/api/cron/sweep-images` daily. It deletes stored images that no room references and that are more than 7 days old (the grace period keeps undo and crash recovery working for recently deleted pieces). It refuses to run until `CRON_SECRET` is set in the Vercel project env; Vercel Cron sends it automatically. Call it with `?dryRun=1` (and the same `Authorization: Bearer` header) to list what would be deleted.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4, shadcn/ui on Radix, themed with Listen Labs Paper tokens (`src/app/globals.css`)
- React-Konva for the wall canvas
- jsPDF for export
- Supabase (Postgres) for storage, with a JSON-file fallback for dev
- Anthropic Claude (`@anthropic-ai/sdk`) + Cheerio for URL ingestion
