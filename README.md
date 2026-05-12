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

## Enable URL ingestion (paste a product URL)

The add-item form has a "Paste product URL" field. When you click Fetch, the server downloads the page, asks Claude to extract the product name, image, and dimensions, and pre-fills the form. To enable this, add to `.env.local`:

- `ANTHROPIC_API_KEY` — get one at https://console.anthropic.com → Settings → API Keys

When this is unset, the rest of the app works fine — only URL ingestion is disabled. Extraction uses `claude-opus-4-7` with adaptive thinking; you can drop to a cheaper model by editing `src/lib/extract.ts` if cost becomes an issue.

### Sites that block URL ingestion

Some retailers run bot-protection (Akamai, Cloudflare Bot Manager, PerimeterX) that returns 403 to any plain HTTP request, especially from cloud IPs like Vercel's. **West Elm, Pottery Barn, and some Etsy listings** fall in this bucket. For those, **screenshot the product page in your browser and drop the screenshot into the form** — Claude reads the dimensions from the image with vision. Works on any site since your browser already passed the bot check.

The image area in the add-form supports:

- Drag and drop from your desktop or another browser tab
- Paste from clipboard (⌘V) — screenshot then paste, or copy an image
- Click to choose a file

Society6, Minted, Redbubble, and Shopify-hosted indie shops generally just work with the URL paste.

If you want the URL path to work on Akamai-protected sites, add a `SCRAPINGBEE_API_KEY` to `.env.local` (and to your Vercel project env). The extractor automatically falls back to ScrapingBee when a direct fetch hits 401/403/429/503/520+. Each premium-proxy fetch uses 10 ScrapingBee credits (~$0.005 at paid tier; the 1000-credit free trial covers about 100 retailer fetches).

## Enable background removal (optional)

Each piece in the items panel gets a `−BG` button on hover. Click it to strip the listing-photo background — useful for unframed pieces or busy lifestyle shots. To enable, add to `.env.local` (and to your Vercel project env):

- `REPLICATE_API_TOKEN` — get one at https://replicate.com/account/api-tokens

Each call costs about $0.001 and takes 5–8 seconds. The original image is kept so you can toggle back (`+BG`).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- React-Konva for the wall canvas
- jsPDF for export
- Supabase (Postgres) for storage, with a JSON-file fallback for dev
- Anthropic Claude (`@anthropic-ai/sdk`) + Cheerio for URL ingestion
