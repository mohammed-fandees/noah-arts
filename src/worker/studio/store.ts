import { slugify, uniqueSlug } from '../../shared/slug';

// Everything the studio writes to D1 and R2. D1 batches are transactions, so each save
// either lands completely or not at all; replaced R2 objects are deleted only afterwards.

export interface StudioEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
}

export class InputError extends Error {}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 90 * 1024 * 1024;

export function text(value: unknown, max: number, field: string, required = false): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) {
    if (required) throw new InputError(`${field} is required.`);
    return null;
  }
  if (s.length > max) throw new InputError(`${field} is too long (max ${max} characters).`);
  return s;
}

const fraction = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new InputError('A face box is outside the drawing.');
  return n;
};

const rand = () => crypto.randomUUID().slice(0, 8);

async function putImage(env: StudioEnv, key: string, file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new InputError('Images must be JPEG, PNG or WebP.');
  if (file.size > MAX_IMAGE) throw new InputError('That image is too large (max 15 MB).');
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}

const extOf = (file: File) => ({ 'image/png': 'png', 'image/webp': 'webp' })[file.type] ?? 'jpg';

function fileField(form: FormData, name: string | undefined | null): File | null {
  if (!name) return null;
  const f = form.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

async function deleteKeys(env: StudioEnv, keys: (string | null | undefined)[]) {
  const list = keys.filter((k): k is string => !!k);
  if (list.length) await env.MEDIA.delete(list);
}

// ---------- Drawings ----------

interface FaceInput {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Form field holding a 4:5 crop of this face (needed when the person is new to the cast). */
  crop?: string;
}

export interface DrawingInput {
  title: string;
  shelf: string;
  pageDate?: string;
  quote?: string;
  story?: string;
  alt: string;
  animation: 'lines' | 'hatch';
  isNew: boolean;
  width?: number;
  height?: number;
  chapterId?: number | null;
  chapterCaption?: string;
  faces: FaceInput[];
  /** "keep" the current stage photos, "replace" them with stage-0…n, or "remove" them. */
  stages: 'keep' | 'replace' | 'remove';
  stageCount?: number;
  hero?: { width: number; height: number } | null;
  removeTimelapse?: boolean;
}

interface DrawingRow {
  id: number;
  slug: string;
  image_key: string;
  timelapse_key: string | null;
}

export async function saveDrawing(env: StudioEnv, id: number | null, form: FormData): Promise<{ id: number; slug: string }> {
  let input: DrawingInput;
  try {
    input = JSON.parse(String(form.get('meta') ?? ''));
  } catch {
    throw new InputError('The form data was unreadable.');
  }
  const title = text(input.title, 120, 'Title', true)!;
  const shelf = text(input.shelf, 40, 'Shelf', true)!;
  const alt = text(input.alt, 400, 'Description for screen readers', true)!;
  const pageDate = text(input.pageDate, 40, 'Date');
  const quote = text(input.quote, 300, 'Quote');
  const story = text(input.story, 4000, 'Story');
  const animation = input.animation === 'hatch' ? 'hatch' : 'lines';
  const chapterCaption = text(input.chapterCaption, 120, 'Caption');

  const existing = id
    ? await env.DB.prepare('SELECT id, slug, image_key, timelapse_key FROM drawings WHERE id = ?').bind(id).first<DrawingRow>()
    : null;
  if (id && !existing) throw new InputError('That drawing no longer exists.');

  const image = fileField(form, 'image');
  if (!existing && !image) throw new InputError('Choose a photo of the drawing first.');
  const width = Math.round(Number(input.width));
  const height = Math.round(Number(input.height));
  if (image && !(width > 0 && height > 0 && width < 20000 && height < 20000)) throw new InputError('Image size is missing.');

  // Slug: new drawings get one from the title; it stays stable afterwards so links keep working.
  let slug = existing?.slug ?? '';
  if (!existing) {
    const rows = await env.DB.prepare('SELECT slug FROM drawings').all<{ slug: string }>();
    const taken = new Set(rows.results.map((r) => r.slug));
    slug = uniqueSlug(slugify(title), (s) => taken.has(s));
  }

  const uploaded: string[] = [];
  const toDelete: (string | null)[] = [];
  try {
    const imageKey = image ? await putImage(env, `d/${slug}-${rand()}.${extOf(image)}`, image) : existing!.image_key;
    if (image) {
      uploaded.push(imageKey);
      if (existing) toDelete.push(existing.image_key);
    }

    // The cast: match faces to people by name, adding new people with their face crop.
    const people = await env.DB.prepare('SELECT id, slug, name FROM people').all<{ id: number; slug: string; name: string }>();
    const byName = new Map(people.results.map((p) => [p.name.toLowerCase(), p]));
    const takenPeople = new Set(people.results.map((p) => p.slug));
    const faces: { personId: number | null; newIndex: number; x: number; y: number; w: number; h: number }[] = [];
    const newPeople: { slug: string; name: string; faceKey: string }[] = [];
    for (const f of (input.faces ?? []).slice(0, 40)) {
      const name = text(f.name, 60, 'Name', true)!;
      const box = { x: fraction(f.x), y: fraction(f.y), w: fraction(f.w), h: fraction(f.h) };
      const known = byName.get(name.toLowerCase());
      if (known) {
        faces.push({ personId: known.id, newIndex: -1, ...box });
        continue;
      }
      let index = newPeople.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
      if (index === -1) {
        const crop = fileField(form, f.crop);
        if (!crop) throw new InputError(`Missing the face picture for ${name}.`);
        const personSlug = uniqueSlug(slugify(name, 'someone'), (s) => takenPeople.has(s));
        takenPeople.add(personSlug);
        const faceKey = await putImage(env, `f/${personSlug}-${rand()}.${extOf(crop)}`, crop);
        uploaded.push(faceKey);
        newPeople.push({ slug: personSlug, name, faceKey });
        index = newPeople.length - 1;
      }
      faces.push({ personId: null, newIndex: index, ...box });
    }

    // Stage photos (her real process), in order.
    const stageKeys: string[] = [];
    if (input.stages === 'replace') {
      for (let i = 0; i < Math.min(12, Number(input.stageCount) || 0); i++) {
        const file = fileField(form, `stage-${i}`);
        if (file) {
          const key = await putImage(env, `s/${slug}-${i}-${rand()}.${extOf(file)}`, file);
          uploaded.push(key);
          stageKeys.push(key);
        }
      }
    }
    const oldStages =
      existing && input.stages !== 'keep'
        ? (await env.DB.prepare('SELECT image_key FROM stages WHERE drawing_id = ?').bind(existing.id).all<{ image_key: string }>()).results
        : [];
    toDelete.push(...oldStages.map((s) => s.image_key));

    // Optional time-lapse video.
    let timelapseKey = existing?.timelapse_key ?? null;
    const video = fileField(form, 'timelapse');
    if (video) {
      if (!VIDEO_TYPES.includes(video.type)) throw new InputError('Time-lapse must be an MP4, WebM or MOV video.');
      if (video.size > MAX_VIDEO) throw new InputError('That video is too large (max 90 MB).');
      const key = `v/${slug}-${rand()}.${video.type === 'video/webm' ? 'webm' : 'mp4'}`;
      await env.MEDIA.put(key, video.stream(), { httpMetadata: { contentType: video.type } });
      uploaded.push(key);
      toDelete.push(timelapseKey);
      timelapseKey = key;
    } else if (input.removeTimelapse) {
      toDelete.push(timelapseKey);
      timelapseKey = null;
    }

    // Hero crop for the home page.
    const heroFile = input.hero ? fileField(form, 'hero') : null;
    let heroKey: string | null = null;
    if (heroFile) {
      heroKey = await putImage(env, `hero-${rand()}.${extOf(heroFile)}`, heroFile);
      uploaded.push(heroKey);
      const old = await env.DB.prepare("SELECT value FROM settings WHERE key = 'hero_image_key'").first<{ value: string }>();
      if (old?.value) toDelete.push(old.value);
    }

    // One transaction for every row.
    const stmts: D1PreparedStatement[] = [];
    const drawingId = existing?.id ?? null;
    const idExpr = drawingId ? String(drawingId) : '(SELECT id FROM drawings WHERE slug = ?1)';
    if (existing) {
      stmts.push(
        env.DB.prepare(
          `UPDATE drawings SET title=?, shelf=?, page_date=?, quote=?, story=?, alt=?, animation=?, image_key=?,
           width=COALESCE(?, width), height=COALESCE(?, height), timelapse_key=?, is_new=? WHERE id=?`
        ).bind(title, shelf, pageDate, quote, story, alt, animation, imageKey, image ? width : null, image ? height : null,
          timelapseKey, input.isNew ? 1 : 0, existing.id)
      );
    } else {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO drawings (slug, title, shelf, page_date, quote, story, image_key, width, height, alt, animation,
            timelapse_key, is_new, notebook_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(notebook_order), 0) + 1 FROM drawings))`
        ).bind(slug, title, shelf, pageDate, quote, story, imageKey, width, height, alt, animation, timelapseKey, input.isNew ? 1 : 0)
      );
    }
    const withSlug = (sql: string, ...rest: unknown[]) =>
      drawingId ? env.DB.prepare(sql).bind(...rest) : env.DB.prepare(sql).bind(slug, ...rest);

    if (input.isNew) stmts.push(withSlug(`UPDATE drawings SET is_new = 0 WHERE id <> ${idExpr}`));
    for (const p of newPeople) {
      stmts.push(
        env.DB.prepare('INSERT INTO people (slug, name, face_key, position) VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM people))')
          .bind(p.slug, p.name, p.faceKey)
      );
    }
    stmts.push(withSlug(`DELETE FROM faces WHERE drawing_id = ${idExpr}`));
    for (const f of faces) {
      // Person slugs come from slugify(): only [a-z0-9-], so inlining them is safe.
      const personExpr = f.personId ? String(f.personId) : `(SELECT id FROM people WHERE slug = '${newPeople[f.newIndex].slug}')`;
      stmts.push(
        withSlug(`INSERT INTO faces (drawing_id, person_id, x, y, w, h) VALUES (${idExpr}, ${personExpr}, ?, ?, ?, ?)`,
          f.x, f.y, f.w, f.h)
      );
    }
    if (input.stages !== 'keep') {
      stmts.push(withSlug(`DELETE FROM stages WHERE drawing_id = ${idExpr}`));
      stageKeys.forEach((key, i) => stmts.push(withSlug(`INSERT INTO stages (drawing_id, position, image_key) VALUES (${idExpr}, ?, ?)`, i + 1, key)));
    }
    stmts.push(withSlug(`DELETE FROM chapter_drawings WHERE drawing_id = ${idExpr}`));
    if (input.chapterId) {
      stmts.push(
        withSlug(
          `INSERT INTO chapter_drawings (chapter_id, drawing_id, position, caption)
           SELECT id, ${idExpr}, (SELECT COALESCE(MAX(position), 0) + 1 FROM chapter_drawings WHERE chapter_id = ?), ? FROM chapters WHERE id = ?`,
          Number(input.chapterId), chapterCaption, Number(input.chapterId)
        )
      );
    }
    if (heroKey && input.hero) {
      const set = (key: string, value: string) =>
        env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').bind(key, value);
      stmts.push(
        set('hero_image_key', heroKey),
        set('hero_image_width', String(Math.round(input.hero.width))),
        set('hero_image_height', String(Math.round(input.hero.height))),
        set('hero_image_alt', alt)
      );
    }
    await env.DB.batch(stmts);
  } catch (err) {
    await deleteKeys(env, uploaded).catch(() => {});
    throw err;
  }
  await deleteKeys(env, toDelete).catch(() => {});

  const row = await env.DB.prepare('SELECT id, slug FROM drawings WHERE slug = ?').bind(slug).first<{ id: number; slug: string }>();
  return row!;
}

export async function deleteDrawing(env: StudioEnv, id: number) {
  const row = await env.DB.prepare('SELECT image_key, timelapse_key FROM drawings WHERE id = ?').bind(id).first<DrawingRow>();
  if (!row) return;
  const stages = await env.DB.prepare('SELECT image_key FROM stages WHERE drawing_id = ?').bind(id).all<{ image_key: string }>();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM faces WHERE drawing_id = ?').bind(id),
    env.DB.prepare('DELETE FROM stages WHERE drawing_id = ?').bind(id),
    env.DB.prepare('DELETE FROM chapter_drawings WHERE drawing_id = ?').bind(id),
    env.DB.prepare('DELETE FROM drawings WHERE id = ?').bind(id)
  ]);
  await deleteKeys(env, [row.image_key, row.timelapse_key, ...stages.results.map((s) => s.image_key)]).catch(() => {});
}

// ---------- Chapters ----------

export async function saveChapter(env: StudioEnv, id: number | null, form: FormData) {
  const kicker = text(form.get('kicker'), 80, 'Kicker', true);
  const title = text(form.get('title'), 120, 'Title', true);
  const body = text(form.get('body'), 6000, 'Text', true);
  const marginNote = text(form.get('margin_note'), 200, 'Margin note');
  const stickyNote = text(form.get('sticky_note'), 200, 'Sticky note');
  const photoCaption = text(form.get('photo_caption'), 120, 'Photo caption');
  const photo = fileField(form, 'photo');
  const removePhoto = form.get('remove_photo') === '1';

  const old = id ? await env.DB.prepare('SELECT photo_key FROM chapters WHERE id = ?').bind(id).first<{ photo_key: string | null }>() : null;
  if (id && !old) throw new InputError('That chapter no longer exists.');
  let photoKey = old?.photo_key ?? null;
  const toDelete: (string | null)[] = [];
  if (photo) {
    toDelete.push(photoKey);
    photoKey = await putImage(env, `c/${rand()}-${rand()}.${extOf(photo)}`, photo);
  } else if (removePhoto) {
    toDelete.push(photoKey);
    photoKey = null;
  }

  // Which drawings sit beside this chapter, with captions.
  const picks: { id: number; caption: string | null; position: number }[] = [];
  for (const [key, value] of form.entries()) {
    const m = key.match(/^include-(\d+)$/);
    if (m && value === '1') {
      const did = Number(m[1]);
      picks.push({ id: did, caption: text(form.get(`caption-${did}`), 120, 'Caption'), position: Number(form.get(`position-${did}`)) || 99 });
    }
  }
  picks.sort((a, b) => a.position - b.position);

  const stmts: D1PreparedStatement[] = [];
  if (id) {
    stmts.push(
      env.DB.prepare('UPDATE chapters SET kicker=?, title=?, body=?, margin_note=?, sticky_note=?, photo_key=?, photo_caption=? WHERE id=?')
        .bind(kicker, title, body, marginNote, stickyNote, photoKey, photoCaption, id)
    );
  } else {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO chapters (position, kicker, title, body, margin_note, sticky_note, photo_key, photo_caption)
         VALUES ((SELECT COALESCE(MAX(position), 0) + 1 FROM chapters), ?, ?, ?, ?, ?, ?, ?)`
      ).bind(kicker, title, body, marginNote, stickyNote, photoKey, photoCaption)
    );
  }
  const chapterExpr = id ? String(id) : '(SELECT MAX(id) FROM chapters)';
  stmts.push(env.DB.prepare(`DELETE FROM chapter_drawings WHERE chapter_id = ${chapterExpr}`));
  picks.forEach((p, i) =>
    stmts.push(
      env.DB.prepare(
        `INSERT INTO chapter_drawings (chapter_id, drawing_id, position, caption)
         SELECT ${chapterExpr}, id, ?, ? FROM drawings WHERE id = ?`
      ).bind(i + 1, p.caption, p.id)
    )
  );
  await env.DB.batch(stmts);
  await deleteKeys(env, toDelete).catch(() => {});
}

export async function deleteChapter(env: StudioEnv, id: number) {
  const old = await env.DB.prepare('SELECT photo_key FROM chapters WHERE id = ?').bind(id).first<{ photo_key: string | null }>();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM chapter_drawings WHERE chapter_id = ?').bind(id),
    env.DB.prepare('DELETE FROM chapters WHERE id = ?').bind(id)
  ]);
  await deleteKeys(env, [old?.photo_key]).catch(() => {});
}

/** Swaps a row's position with its neighbour above or below. */
export async function move(env: StudioEnv, table: 'chapters' | 'people', id: number, dir: 'up' | 'down') {
  const rows = (await env.DB.prepare(`SELECT id, position FROM ${table} ORDER BY position, id`).all<{ id: number; position: number }>()).results;
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await env.DB.batch(rows.map((r, k) => env.DB.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).bind(k + 1, r.id)));
}

// ---------- The cast ----------

export async function savePerson(env: StudioEnv, id: number, form: FormData) {
  const name = text(form.get('name'), 60, 'Name', true);
  const note = text(form.get('note'), 600, 'Note');
  const clash = await env.DB.prepare('SELECT id FROM people WHERE lower(name) = lower(?) AND id <> ?').bind(name, id).first();
  if (clash) throw new InputError(`Someone in the cast is already called ${name}.`);
  await env.DB.prepare('UPDATE people SET name = ?, note = ? WHERE id = ?').bind(name, note, id).run();
}

export async function deletePerson(env: StudioEnv, id: number) {
  const row = await env.DB.prepare('SELECT face_key FROM people WHERE id = ?').bind(id).first<{ face_key: string }>();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM faces WHERE person_id = ?').bind(id),
    env.DB.prepare('DELETE FROM people WHERE id = ?').bind(id)
  ]);
  await deleteKeys(env, [row?.face_key]).catch(() => {});
}

// ---------- Site text ----------

export const SETTING_FIELDS: { key: string; label: string; max: number; long?: boolean; hint?: string }[] = [
  { key: 'hero_kicker', label: 'Small line above your name', max: 80 },
  { key: 'hero_tagline', label: 'Your one-line introduction', max: 240, long: true },
  { key: 'hero_caption', label: 'Note next to your portrait', max: 60, hint: 'e.g. that’s me ☺' },
  { key: 'story_title', label: 'Story — heading', max: 120 },
  { key: 'story_intro', label: 'Story — introduction', max: 800, long: true },
  { key: 'gallery_title', label: 'Sketchbook — heading', max: 120 },
  { key: 'cast_title', label: 'The cast — heading', max: 120 },
  { key: 'cast_intro', label: 'The cast — introduction', max: 400, long: true },
  { key: 'process_title', label: 'How I draw — heading', max: 120 },
  { key: 'process_text', label: 'How I draw — in your words', max: 1200, long: true },
  { key: 'closing_title', label: 'Last section — heading', max: 120 },
  { key: 'closing_text', label: 'Last section — text', max: 600, long: true },
  { key: 'instagram_url', label: 'Instagram link', max: 200, hint: 'https://instagram.com/…' },
  { key: 'instagram_handle', label: 'Instagram name', max: 60, hint: '@yourname' }
];

export async function saveSettings(env: StudioEnv, form: FormData) {
  const stmts: D1PreparedStatement[] = [];
  for (const f of SETTING_FIELDS) {
    let value = text(form.get(f.key), f.max, f.label) ?? '';
    if (f.key === 'instagram_url' && value && !/^https:\/\//.test(value)) throw new InputError('The Instagram link must start with https://');
    stmts.push(
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').bind(f.key, value)
    );
  }
  const process = text(form.get('process_drawing'), 80, 'Drawing for “How I draw”');
  if (process) {
    stmts.push(
      env.DB.prepare("INSERT INTO settings (key, value) VALUES ('process_drawing', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(process)
    );
  }
  await env.DB.batch(stmts);
}
