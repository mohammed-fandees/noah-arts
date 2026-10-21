import { Hono, type Context } from 'hono';
import { chapterOf, loadSite } from '../db';
import { media } from '../views/parts';
import { changePassword, currentUser, hasAccounts, sessionCookie, signIn, signOut, type StudioUser } from './auth';
import {
  deleteChapter, deleteDrawing, deletePerson, InputError, move, saveChapter, saveDrawing, savePerson, saveSettings, type StudioEnv
} from './store';
import { AccountPage, CastPage, ChaptersPage, DrawingsList, Editor, LoginPage, TextPage, type EditorData } from './views';

type Env = { Bindings: StudioEnv; Variables: { user: StudioUser } };

export const studio = new Hono<Env>();

/** Only same-site paths inside the studio are valid places to return to after signing in. */
const safeNext = (next: string | null | undefined) =>
  next && /^\/studio(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&%_.-]*)?$/.test(next) && !next.startsWith('/studio/login') ? next : '/studio/drawings';

studio.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');
  c.header('X-Frame-Options', 'DENY');
  // Writes (sign-in included) only from the studio's own pages.
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('Origin');
    if (!origin || new URL(origin).host !== new URL(c.req.url).host) return c.text('Cross-site request refused.', 403);
  }
  if (c.req.path === '/studio/login') return next();
  const user = await currentUser(c.env.DB, c.req.raw);
  if (!user) {
    if (c.req.path.startsWith('/studio/api/')) return c.json({ ok: false, error: 'You were signed out — sign in again in another tab, then retry.' }, 401);
    const url = new URL(c.req.url);
    return c.redirect(`/studio/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  c.set('user', user);
  await next();
});

// ---------- Signing in ----------

studio.get('/login', async (c) => {
  if (await currentUser(c.env.DB, c.req.raw)) return c.redirect(safeNext(c.req.query('next')));
  return c.html(<LoginPage next={safeNext(c.req.query('next'))} noAccounts={!(await hasAccounts(c.env.DB))} />);
});

studio.post('/login', async (c) => {
  const form = await c.req.formData();
  const username = String(form.get('username') ?? '').trim().slice(0, 32);
  const password = String(form.get('password') ?? '').slice(0, 200);
  const next = safeNext(String(form.get('next') ?? ''));
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  const result = await signIn(c.env.DB, username, password, ip);
  if (!result.ok) {
    const error =
      result.reason === 'locked'
        ? 'Too many tries. Wait 15 minutes, then try again.'
        : 'That username and password don’t match.';
    return c.html(<LoginPage next={next} error={error} noAccounts={false} />, result.reason === 'locked' ? 429 : 401);
  }
  c.header('Set-Cookie', sessionCookie(result.token, new URL(c.req.url).protocol === 'https:'));
  return c.redirect(next);
});

studio.post('/logout', async (c) => {
  await signOut(c.env.DB, c.req.raw);
  c.header('Set-Cookie', sessionCookie('', new URL(c.req.url).protocol === 'https:', 0));
  return c.redirect('/studio/login');
});

studio.get('/account', (c) =>
  c.html(<AccountPage username={c.get('user').username} flash={c.req.query('saved') ? 'Password changed.' : null} error={c.req.query('error')} />)
);

studio.post('/account/password', async (c) => {
  const form = await c.req.formData();
  const error = await changePassword(
    c.env.DB, c.req.raw, c.get('user'),
    String(form.get('current') ?? ''), String(form.get('next') ?? ''), String(form.get('repeat') ?? '')
  );
  return c.redirect(error ? `/studio/account?error=${encodeURIComponent(error)}` : '/studio/account?saved=1');
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
