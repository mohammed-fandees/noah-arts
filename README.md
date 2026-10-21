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
| Studio login | Username + password, sessions in **D1** |

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

## The studio (`/studio`)

Noah's dashboard. Everything happens in her browser before anything is uploaded:

- **Drawings** — add a drawing: choose a phone photo, drag four corners onto the page (perspective is straightened), check the automatic clean-up (before/after slider, graphite strength), drag a box around each face and type who it is (new names join the cast with their own face picture), then title, shelf, story chapter, the story, a description for screen readers, how it animates, optional stage photos (straightened with the same corners) and a time-lapse video, "new!", and whether it becomes the home-page picture. Edit or delete any drawing later.
- **Story chapters** — write, reorder and delete chapters; attach drawings with captions; add a personal photo.
- **The cast** — rename people, add a note, reorder, remove.
- **Site text** — every sentence around the drawings, the Instagram link, and the drawing used in “How I draw”.

Saving is one D1 transaction; images go to R2 under fresh keys, and replaced files are deleted afterwards.

### Signing in

The studio has its own username + password, so nobody needs a Cloudflare account to use it.

```bash
npm run studio:user -- noah --remote     # create the account (or reset its password) on the live site
npm run studio:user -- noah --local      # the same for `npm run dev`
```

It asks for the password twice (at least 10 characters) and stores only a PBKDF2-SHA256 hash.
Then sign in at `/studio`. Noah can change her password under **Account**; doing so signs out
every other browser.

- Sessions are a random token in an HttpOnly, SameSite=Lax cookie scoped to `/studio`; D1 keeps only its SHA-256. They last 30 days, and **Sign out** ends them.
- Ten wrong passwords from one IP lock that IP out for 15 minutes (fifty per username, so nobody can easily lock Noah out).
- Every studio form and upload must come from the studio's own pages (Origin check).
- With no accounts yet, `/studio` shows how to create one and nothing else.

## Preparing images by hand

`python3 scripts/clean_photo.py photo.jpg out.jpg [left top right bottom]` runs the same clean-up as the studio, e.g. for bulk imports.
