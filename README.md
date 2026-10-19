# Noah — the living sketchbook

Noah's personal site: her pencil drawings and the story behind them, told in chapters.
Everything on the page is *drawn* rather than shown — her name writes itself, a pencil
shades her self-portrait into the page, one pencil line runs through her story as you
scroll, and every drawing comes in "lines first, then shading".

Runs entirely on Cloudflare:

| Piece | Cloudflare product |
| --- | --- |
| Pages + API (`src/worker`) | **Workers** (Hono, server-rendered JSX) |
| Styles, client script (`public/`) | **Workers static assets** |
| Drawings, chapters, the cast, site text | **D1** (SQLite) — schema in `migrations/` |
| Her images | **R2**, served from `/media/<key>` |
| Dashboard login (next step) | **Cloudflare Access** |

## What's on the site

- **Hero** — her self-portrait (the sketch she labelled “Me”) shaded in by a moving pencil; visitors can doodle on the page and rub it out.
- **The story** — chapters she writes, each with drawings taped beside it; a pencil draws one line through all of them as you scroll.
- **The sketchbook** — every drawing, newest first, faint until you hover (on phones: as it scrolls into view). Filters by shelf, or by person (`/?person=vadim`).
- **The cast** — every face she has named, gathered from all her pages.
- **One drawing** (`/d/<slug>`) — tap a name and the view glides into that face; “Watch it drawn” replays it from first lines to finished shading.
- **The notebook** (`/notebook`) — flip through the pages over a spiral binding (one page at a time on phones).
- Pencil sounds (off by default), a scroll bar that is a shrinking pencil, and “reduce motion” support.

### How a drawing animates

1. **Automatic (any upload):** a WebGL shader reveals the image in order of darkness — firm lines first, shading next, soft marks and page lines last.
2. **Stage photos (optional):** rows in `stages` replace the automatic reveal with a cross-fade through her real stages.
3. **Time-lapse (optional):** `drawings.timelapse_key` links a video.

## Run it locally

```bash
npm install
npm run seed:local     # tables + the starter drawings, into a local D1 and R2
npm run dev            # http://localhost:8787
```

`npm run typecheck` checks both the Worker and the browser code.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create noah-arts          # copy the printed database_id into wrangler.jsonc
npx wrangler r2 bucket create noah-arts-media
npm run seed:remote                        # schema + starter content + images
npm run deploy
```

Then attach a custom domain to the `noah-arts` Worker in the Cloudflare dashboard if you have one.

## Adding drawings (until the dashboard exists)

1. Clean the phone photo: `python3 scripts/clean_photo.py photo.jpg seed/media/new.jpg [left top right bottom]`
2. Upload it: `npx wrangler r2 object put noah-arts-media/new.jpg --file=seed/media/new.jpg --content-type=image/jpeg --remote`
3. Add a row to `drawings` (and `faces` / `people` for named faces) with `npx wrangler d1 execute noah-arts --remote --command "…"`.

Text in `[brackets]` in the seed is a placeholder for Noah's own words.

## Next step: the dashboard

A `/studio` area behind Cloudflare Access where Noah adds a drawing: drag four corners
to crop and straighten, automatic clean-up in the browser (same maths as
`scripts/clean_photo.py`), draw a box around each face and name it, write the title,
story and chapter, choose how it animates, and publish — straight into D1 and R2.
