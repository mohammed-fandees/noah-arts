import type { Chapter, Drawing, Face, Person, Site } from '../shared/types';

interface DrawingRow {
  id: number;
  slug: string;
  title: string;
  shelf: string;
  page_date: string | null;
  quote: string | null;
  story: string | null;
  image_key: string;
  width: number;
  height: number;
  alt: string;
  animation: 'lines' | 'hatch';
  timelapse_key: string | null;
  is_new: number;
  notebook_order: number;
}

interface FaceRow {
  drawing_id: number;
  slug: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ChapterRow {
  id: number;
  position: number;
  kicker: string;
  title: string;
  body: string;
  margin_note: string | null;
  sticky_note: string | null;
  photo_key: string | null;
  photo_caption: string | null;
}

interface PersonRow {
  id: number;
  slug: string;
  name: string;
  note: string | null;
  face_key: string;
}

/** Loads everything the public site shows in one round trip. The whole sketchbook is small. */
export async function loadSite(db: D1Database): Promise<Site> {
  const [settingsRes, drawingsRes, facesRes, stagesRes, chaptersRes, chapterDrawingsRes, peopleRes, appearancesRes] =
    await db.batch([
      db.prepare('SELECT key, value FROM settings'),
      db.prepare('SELECT * FROM drawings ORDER BY published_at DESC, id DESC'),
      db.prepare(
        `SELECT f.drawing_id, p.slug, p.name, f.x, f.y, f.w, f.h
         FROM faces f JOIN people p ON p.id = f.person_id ORDER BY f.drawing_id, f.y, f.x`
      ),
      db.prepare('SELECT drawing_id, image_key FROM stages ORDER BY drawing_id, position'),
      db.prepare('SELECT * FROM chapters ORDER BY position'),
      db.prepare('SELECT chapter_id, drawing_id, caption FROM chapter_drawings ORDER BY chapter_id, position'),
      db.prepare('SELECT * FROM people ORDER BY position, name'),
      db.prepare(
        `SELECT f.person_id, d.slug, d.title FROM faces f JOIN drawings d ON d.id = f.drawing_id
         ORDER BY d.published_at DESC`
      )
    ]);

  const settings: Record<string, string> = {};
  for (const row of settingsRes.results as { key: string; value: string }[]) settings[row.key] = row.value;

  const facesByDrawing = new Map<number, Face[]>();
  for (const f of facesRes.results as FaceRow[]) {
    const list = facesByDrawing.get(f.drawing_id) ?? [];
    list.push({ personSlug: f.slug, personName: f.name, x: f.x, y: f.y, w: f.w, h: f.h });
    facesByDrawing.set(f.drawing_id, list);
  }

  const stagesByDrawing = new Map<number, string[]>();
  for (const s of stagesRes.results as { drawing_id: number; image_key: string }[]) {
    const list = stagesByDrawing.get(s.drawing_id) ?? [];
    list.push(s.image_key);
    stagesByDrawing.set(s.drawing_id, list);
  }

  const drawings: Drawing[] = (drawingsRes.results as DrawingRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    shelf: r.shelf,
    pageDate: r.page_date,
    quote: r.quote,
    story: r.story,
    imageKey: r.image_key,
    width: r.width,
    height: r.height,
    alt: r.alt,
    animation: r.animation,
    timelapseKey: r.timelapse_key,
    isNew: r.is_new === 1,
    notebookOrder: r.notebook_order,
    faces: facesByDrawing.get(r.id) ?? [],
    stages: stagesByDrawing.get(r.id) ?? []
  }));
  const byId = new Map(drawings.map((d) => [d.id, d]));

  const chapters: Chapter[] = (chaptersRes.results as ChapterRow[]).map((r) => ({
    id: r.id,
    position: r.position,
    kicker: r.kicker,
    title: r.title,
    body: r.body,
    marginNote: r.margin_note,
    stickyNote: r.sticky_note,
    photoKey: r.photo_key,
    photoCaption: r.photo_caption,
    drawings: []
  }));
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  for (const cd of chapterDrawingsRes.results as { chapter_id: number; drawing_id: number; caption: string | null }[]) {
    const drawing = byId.get(cd.drawing_id);
    const chapter = chapterById.get(cd.chapter_id);
    if (drawing && chapter) chapter.drawings.push({ drawing, caption: cd.caption });
  }

  const appearances = new Map<number, { slug: string; title: string }[]>();
  for (const a of appearancesRes.results as { person_id: number; slug: string; title: string }[]) {
    const list = appearances.get(a.person_id) ?? [];
    if (!list.some((d) => d.slug === a.slug)) list.push({ slug: a.slug, title: a.title });
    appearances.set(a.person_id, list);
  }
  const people: Person[] = (peopleRes.results as PersonRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    note: r.note,
    faceKey: r.face_key,
    drawings: appearances.get(r.id) ?? []
  }));

  return { settings, drawings, chapters, people };
}

/** The chapter a drawing is told in, if any. */
export function chapterOf(site: Site, drawingId: number): Chapter | undefined {
  return site.chapters.find((c) => c.drawings.some((cd) => cd.drawing.id === drawingId));
}
