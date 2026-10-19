import { Hono } from 'hono';
import { chapterOf, loadSite } from './db';
import type { AccessEnv } from './studio/auth';
import { studio } from './studio/routes';
import { DrawingPage, NotFound } from './views/DrawingPage';
import { Home } from './views/Home';
import { NotebookPage } from './views/NotebookPage';

type Env = { Bindings: { DB: D1Database; MEDIA: R2Bucket } & AccessEnv };

const app = new Hono<Env>();

// Pages are rendered from D1 on each request; a short edge cache keeps them fast
// while new drawings from the dashboard still show up within a minute.
const PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';

app.get('/', async (c) => {
  const site = await loadSite(c.env.DB);
  c.header('Cache-Control', PAGE_CACHE);
  return c.html(<Home site={site} />);
});

app.get('/d/:slug', async (c) => {
  const site = await loadSite(c.env.DB);
  const index = site.drawings.findIndex((d) => d.slug === c.req.param('slug'));
  if (index === -1) return c.html(<NotFound />, 404);
  const total = site.drawings.length;
  const drawing = site.drawings[index];
  c.header('Cache-Control', PAGE_CACHE);
  return c.html(
    <DrawingPage
      drawing={drawing}
      index={index}
      total={total}
      prev={site.drawings[(index - 1 + total) % total]}
      next={site.drawings[(index + 1) % total]}
      chapter={chapterOf(site, drawing.id)}
    />
  );
});

app.get('/notebook', async (c) => {
  const site = await loadSite(c.env.DB);
  const pages = [...site.drawings].sort((a, b) => a.notebookOrder - b.notebookOrder);
  c.header('Cache-Control', PAGE_CACHE);
  return c.html(<NotebookPage drawings={pages} />);
});

app.get('/api/site', async (c) => c.json(await loadSite(c.env.DB)));

// Her images live in R2. Keys are never reused (a new upload gets a new key), so cache forever.
app.get('/media/:key{.+}', async (c) => {
  const object = await c.env.MEDIA.get(c.req.param('key'));
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
});

// Noah's dashboard (behind Cloudflare Access).
app.route('/studio', studio);

app.notFound((c) => c.html(<NotFound />, 404));

export default app;
