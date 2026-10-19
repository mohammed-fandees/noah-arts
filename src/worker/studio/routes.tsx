import { Hono, type Context } from 'hono';
import { chapterOf, loadSite } from '../db';
import { media } from '../views/parts';
import { checkAccess, type AccessEnv } from './auth';
import {
  deleteChapter, deleteDrawing, deletePerson, InputError, move, saveChapter, saveDrawing, savePerson, saveSettings, type StudioEnv
} from './store';
import { AccessPage, CastPage, ChaptersPage, DrawingsList, Editor, TextPage, type EditorData } from './views';

type Env = { Bindings: StudioEnv & AccessEnv };

export const studio = new Hono<Env>();

// Every studio request must come through Cloudflare Access (verified here as well).
studio.use('*', async (c, next) => {
  const access = await checkAccess(c.req.raw, c.env);
  if (!access.ok) {
    return c.html(<AccessPage reason={access.reason} />, access.reason === 'denied' ? 403 : 503);
  }
  // Writes only from the studio's own pages.
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('Origin');
    if (!origin || new URL(origin).host !== new URL(c.req.url).host) return c.text('Cross-site request refused.', 403);
  }
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');
  await next();
});

const flashOf = (url: string) => new URL(url).searchParams.get('saved');
const errorOf = (url: string) => new URL(url).searchParams.get('error');
const back = (path: string, error: unknown) => {
  const message = error instanceof InputError ? error.message : 'Something went wrong — nothing was saved.';
  if (!(error instanceof InputError)) console.error(error);
  return `${path}?error=${encodeURIComponent(message)}`;
};

studio.get('/', (c) => c.redirect('/studio/drawings'));

// ---------- Drawings ----------

studio.get('/drawings', async (c) => {
  const site = await loadSite(c.env.DB);
  const saved = flashOf(c.req.url);
  return c.html(<DrawingsList drawings={site.drawings} flash={saved ? `Saved “${saved}”.` : null} />);
});

studio.get('/drawings/new', async (c) => {
  const site = await loadSite(c.env.DB);
  const data: EditorData = { drawing: null, people: site.people.map((p) => p.name) };
  return c.html(<Editor data={data} shelves={shelvesOf(site.drawings)} chapters={site.chapters} />);
});

studio.get('/drawings/:id{[0-9]+}', async (c) => {
  const site = await loadSite(c.env.DB);
  const d = site.drawings.find((x) => x.id === Number(c.req.param('id')));
  if (!d) return c.redirect('/studio/drawings');
  const chapter = chapterOf(site, d.id);
  const data: EditorData = {
    drawing: {
      id: d.id, title: d.title, shelf: d.shelf, pageDate: d.pageDate, quote: d.quote, story: d.story, alt: d.alt,
      animation: d.animation, isNew: d.isNew, imageUrl: media(d.imageKey), width: d.width, height: d.height,
      faces: d.faces.map((f) => ({ name: f.personName, x: f.x, y: f.y, w: f.w, h: f.h })),
      stageCount: d.stages.length, hasTimelapse: !!d.timelapseKey,
      chapterId: chapter?.id ?? null,
      chapterCaption: chapter?.drawings.find((cd) => cd.drawing.id === d.id)?.caption ?? null
    },
    people: site.people.map((p) => p.name)
  };
  return c.html(<Editor data={data} shelves={shelvesOf(site.drawings)} chapters={site.chapters} />);
});

const shelvesOf = (drawings: { shelf: string }[]) =>
  Array.from(new Set(['Portraits', 'Full pages', 'Doodles', ...drawings.map((d) => d.shelf)]));

const saveJson = async (c: Context<Env>, id: number | null) => {
  try {
    const saved = await saveDrawing(c.env, id, await c.req.formData());
    return c.json({ ok: true, ...saved });
  } catch (err) {
    if (err instanceof InputError) return c.json({ ok: false, error: err.message }, 400);
    console.error(err);
    return c.json({ ok: false, error: 'Something went wrong — nothing was saved.' }, 500);
  }
};

studio.post('/api/drawings', (c) => saveJson(c, null));
studio.post('/api/drawings/:id{[0-9]+}', (c) => saveJson(c, Number(c.req.param('id'))));

studio.post('/drawings/:id{[0-9]+}/delete', async (c) => {
  await deleteDrawing(c.env, Number(c.req.param('id')));
  return c.redirect('/studio/drawings?saved=' + encodeURIComponent('the sketchbook'));
});

// ---------- Chapters ----------

studio.get('/chapters', async (c) => {
  const site = await loadSite(c.env.DB);
  return c.html(
    <ChaptersPage chapters={site.chapters} drawings={site.drawings} flash={flashOf(c.req.url) ? 'Saved.' : null} error={errorOf(c.req.url)} />
  );
});

const chapterSave = async (c: Context<Env>, id: number | null) => {
  try {
    await saveChapter(c.env, id, await c.req.formData());
    return c.redirect('/studio/chapters?saved=1');
  } catch (err) {
    return c.redirect(back('/studio/chapters', err));
  }
};
studio.post('/chapters', (c) => chapterSave(c, null));
studio.post('/chapters/:id{[0-9]+}', (c) => chapterSave(c, Number(c.req.param('id'))));
studio.post('/chapters/:id{[0-9]+}/move', async (c) => {
  await move(c.env, 'chapters', Number(c.req.param('id')), c.req.query('dir') === 'up' ? 'up' : 'down');
  return c.redirect('/studio/chapters');
});
studio.post('/chapters/:id{[0-9]+}/delete', async (c) => {
  await deleteChapter(c.env, Number(c.req.param('id')));
  return c.redirect('/studio/chapters?saved=1');
});

// ---------- The cast ----------

studio.get('/cast', async (c) => {
  const site = await loadSite(c.env.DB);
  return c.html(<CastPage people={site.people} flash={flashOf(c.req.url) ? 'Saved.' : null} error={errorOf(c.req.url)} />);
});
studio.post('/cast/:id{[0-9]+}', async (c) => {
  try {
    await savePerson(c.env, Number(c.req.param('id')), await c.req.formData());
    return c.redirect('/studio/cast?saved=1');
  } catch (err) {
    return c.redirect(back('/studio/cast', err));
  }
});
studio.post('/cast/:id{[0-9]+}/move', async (c) => {
  await move(c.env, 'people', Number(c.req.param('id')), c.req.query('dir') === 'up' ? 'up' : 'down');
  return c.redirect('/studio/cast');
});
studio.post('/cast/:id{[0-9]+}/delete', async (c) => {
  await deletePerson(c.env, Number(c.req.param('id')));
  return c.redirect('/studio/cast?saved=1');
});

// ---------- Site text ----------

studio.get('/text', async (c) => {
  const site = await loadSite(c.env.DB);
  return c.html(<TextPage settings={site.settings} drawings={site.drawings} flash={flashOf(c.req.url) ? 'Saved.' : null} error={errorOf(c.req.url)} />);
});
studio.post('/text', async (c) => {
  try {
    await saveSettings(c.env, await c.req.formData());
    return c.redirect('/studio/text?saved=1');
  } catch (err) {
    return c.redirect(back('/studio/text', err));
  }
});
