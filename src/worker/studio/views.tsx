import type { Child } from 'hono/jsx';
import type { Chapter, Drawing, Person, Settings } from '../../shared/types';
import { JsonData, media } from '../views/parts';
import { SETTING_FIELDS } from './store';

type Section = 'drawings' | 'chapters' | 'cast' | 'text';

export const StudioLayout = ({ title, section, flash, error, script = false, children }: {
  title: string; section: Section; flash?: string | null; error?: string | null; script?: boolean; children: Child;
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>{title} — Noah’s studio</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=Reenie+Beanie&display=swap" />
      <link rel="stylesheet" href="/assets/studio.css" />
      <script type="module" src="/assets/studio.js"></script>
    </head>
    <body data-studio-script={script ? 'editor' : 'basic'}>
      <div class="studio">
        <aside class="side">
          <a class="brand" href="/studio"><span class="hand">noah</span><span class="tag">STUDIO</span></a>
          <nav aria-label="Studio">
            <a href="/studio/drawings" aria-current={section === 'drawings' ? 'page' : undefined}>Drawings</a>
            <a href="/studio/chapters" aria-current={section === 'chapters' ? 'page' : undefined}>Story chapters</a>
            <a href="/studio/cast" aria-current={section === 'cast' ? 'page' : undefined}>The cast</a>
            <a href="/studio/text" aria-current={section === 'text' ? 'page' : undefined}>Site text</a>
          </nav>
          <a class="view-site" href="/" target="_blank" rel="noopener">View my site ↗</a>
        </aside>
        <main class="main" id="main">
          {flash && <p class="flash" role="status">{flash}</p>}
          {error && <p class="flash flash-error" role="alert">{error}</p>}
          {children}
        </main>
      </div>
    </body>
  </html>
);

export const AccessPage = ({ reason }: { reason: 'not-configured' | 'denied' }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>Studio — Noah’s sketchbook</title>
      <link rel="stylesheet" href="/assets/studio.css" />
    </head>
    <body>
      <main class="locked">
        <h1>The studio is locked.</h1>
        {reason === 'not-configured' ? (
          <p>
            It opens once Cloudflare Access protects <code>/studio</code> and the Worker knows the Access team domain
            and audience tag (<code>ACCESS_TEAM_DOMAIN</code>, <code>ACCESS_AUD</code>). See the README.
          </p>
        ) : (
          <p>Sign in through Cloudflare Access with Noah’s email to open it.</p>
        )}
        <a href="/">Back to the sketchbook</a>
      </main>
    </body>
  </html>
);

export const DrawingsList = ({ drawings, flash }: { drawings: Drawing[]; flash?: string | null }) => (
  <StudioLayout title="Drawings" section="drawings" flash={flash}>
    <div class="head">
      <div>
        <p class="kicker">Drawings</p>
        <h1>Your sketchbook</h1>
      </div>
      <a class="button primary" href="/studio/drawings/new">+ Add a drawing</a>
    </div>
    {drawings.length === 0 && <p class="empty hand">No drawings yet — add your first page.</p>}
    <ul class="tiles" role="list">
      {drawings.map((d) => (
        <li class="tile">
          <a href={`/studio/drawings/${d.id}`} class="tile-link">
            <img src={media(d.imageKey)} alt="" loading="lazy" />
            <span class="tile-title hand">{d.title}</span>
          </a>
          <span class="tile-meta">
            {d.shelf}
            {d.isNew && <b> · new!</b>}
            {d.faces.length > 0 && ` · ${d.faces.length} ${d.faces.length === 1 ? 'face' : 'faces'}`}
          </span>
          <span class="tile-actions">
            <a href={`/studio/drawings/${d.id}`}>Edit</a>
            <a href={`/d/${d.slug}`} target="_blank" rel="noopener">View</a>
            <form method="post" action={`/studio/drawings/${d.id}/delete`} data-confirm={`Delete “${d.title}” from the sketchbook? This can’t be undone.`}>
              <button type="submit" class="link danger">Delete</button>
            </form>
          </span>
        </li>
      ))}
    </ul>
  </StudioLayout>
);

export interface EditorData {
  drawing: null | {
    id: number;
    title: string;
    shelf: string;
    pageDate: string | null;
    quote: string | null;
    story: string | null;
    alt: string;
    animation: 'lines' | 'hatch';
    isNew: boolean;
    imageUrl: string;
    width: number;
    height: number;
    faces: { name: string; x: number; y: number; w: number; h: number }[];
    stageCount: number;
    hasTimelapse: boolean;
    chapterId: number | null;
    chapterCaption: string | null;
  };
  people: string[];
}

export const Editor = ({ data, shelves, chapters }: { data: EditorData; shelves: string[]; chapters: Chapter[] }) => {
  const d = data.drawing;
  return (
    <StudioLayout title={d ? `Edit ${d.title}` : 'Add a drawing'} section="drawings" script>
      <form class="editor" data-editor novalidate>
        <div class="head">
          <div>
            <p class="kicker"><a href="/studio/drawings">Drawings</a> / {d ? 'Edit' : 'New'}</p>
            <h1>{d ? d.title : 'Add a drawing'}</h1>
          </div>
          {d && <a class="button" href={`/studio/drawings/${d.id}`}>Start over</a>}
        </div>

        <section class="step" aria-labelledby="s1">
          <h2 id="s1"><span class="num">1</span> The photo</h2>
          <p class="hint">
            {d ? 'Keep the current picture, or choose a new photo to replace it.' : 'A phone photo is perfect — daylight, from straight above.'}
          </p>
          <label class="drop" data-drop>
            <input type="file" accept="image/*" data-photo-input />
            <span class="hand">{d ? 'replace the photo…' : 'choose a photo, or drop it here'}</span>
          </label>
          <div class="crop" data-crop hidden>
            <p class="hint">Drag the four yellow corners onto the corners of the page.</p>
            <div class="crop-stage"><canvas data-crop-canvas aria-label="Photo with page corners to adjust"></canvas></div>
            <div class="row">
              <button type="button" class="button" data-rotate="-1">↺ Rotate</button>
              <button type="button" class="button" data-rotate="1">↻ Rotate</button>
              <button type="button" class="button" data-reset-corners>Whole photo</button>
            </div>
          </div>
        </section>

        <section class="step" aria-labelledby="s2" data-clean-step hidden>
          <h2 id="s2"><span class="num">2</span> Clean-up</h2>
          <p class="hint">Shadows and the phone’s yellow tint are removed and the paper turns white. Drag across the picture to compare.</p>
          <div class="compare" data-compare></div>
          <div class="row wrap">
            <label class="check"><input type="checkbox" data-clean-toggle checked /> Clean up the page</label>
            <label class="slider">Graphite <input type="range" min="100" max="180" value="125" data-strength /></label>
          </div>
        </section>

        <section class="step" aria-labelledby="s3">
          <h2 id="s3"><span class="num">3</span> Name the faces <span class="optional">optional</span></h2>
          <p class="hint">Drag a box around each face on the page, then type who it is. They join “The cast”.</p>
          <div class="faces-stage" data-faces-stage>
            <p class="hand placeholder" data-faces-placeholder>choose a photo first</p>
          </div>
          <ol class="face-list" data-face-list></ol>
          <datalist id="people-list">
            {data.people.map((p) => <option value={p} />)}
          </datalist>
        </section>

        <section class="step" aria-labelledby="s4">
          <h2 id="s4"><span class="num">4</span> Title &amp; story</h2>
          <div class="grid">
            <label>Title<input name="title" required maxlength={120} value={d?.title ?? ''} /></label>
            <label>Date on the page <span class="optional">optional</span><input name="page_date" maxlength={40} value={d?.pageDate ?? ''} /></label>
            <label>Shelf
              <input name="shelf" required maxlength={40} list="shelves" value={d?.shelf ?? 'Portraits'} />
              <datalist id="shelves">{shelves.map((s) => <option value={s} />)}</datalist>
            </label>
            <label>Story chapter
              <select name="chapter_id">
                <option value="">— not in a chapter —</option>
                {chapters.map((c) => <option value={String(c.id)} selected={d?.chapterId === c.id}>{`${c.position} · ${c.title}`}</option>)}
              </select>
            </label>
            <label class="span2">Caption in the chapter <span class="optional">optional</span><input name="chapter_caption" maxlength={120} value={d?.chapterCaption ?? ''} /></label>
            <label class="span2">One line about it <span class="optional">optional</span><input name="quote" maxlength={300} value={d?.quote ?? ''} /></label>
            <label class="span2">The story behind it <span class="optional">optional</span><textarea name="story" rows={4} maxlength={4000}>{d?.story ?? ''}</textarea></label>
            <label class="span2">Describe the drawing for people who can’t see it
              <textarea name="alt" rows={2} required maxlength={400} placeholder="e.g. A pencil portrait of a boy with glasses and messy hair">{d?.alt ?? ''}</textarea>
            </label>
          </div>
        </section>

        <section class="step" aria-labelledby="s5">
          <h2 id="s5"><span class="num">5</span> How it comes to life</h2>
          <div class="choices">
            <label class="choice"><input type="radio" name="animation" value="lines" checked={!d || d.animation === 'lines'} /><b>Lines first, then shading</b><span>automatic</span></label>
            <label class="choice"><input type="radio" name="animation" value="hatch" checked={d?.animation === 'hatch'} /><b>The pencil shades it in</b><span>automatic</span></label>
          </div>
          <div class="grid">
            <label>Stage photos <span class="optional">optional · 2–6 photos while drawing, in order</span>
              <input type="file" accept="image/*" multiple data-stages />
            </label>
            <label>Time-lapse video <span class="optional">optional · MP4 or WebM, up to 90 MB</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" data-timelapse />
            </label>
            {d && d.stageCount > 0 && <label class="check"><input type="checkbox" data-remove-stages /> Remove the {d.stageCount} stage photos</label>}
            {d && d.hasTimelapse && <label class="check"><input type="checkbox" data-remove-timelapse /> Remove the time-lapse</label>}
          </div>
        </section>

        <section class="step" aria-labelledby="s6">
          <h2 id="s6"><span class="num">6</span> On the site</h2>
          <label class="check"><input type="checkbox" name="is_new" checked={d ? d.isNew : true} /> Mark it “new!” (only the newest one keeps the badge)</label>
          <fieldset class="hero-pick" data-hero>
            <legend>Use it on the home page, next to your name?</legend>
            <label class="check"><input type="radio" name="hero" value="" checked /> No</label>
            <label class="check"><input type="radio" name="hero" value="whole" /> Yes — the whole drawing</label>
          </fieldset>
        </section>

        <div class="publish">
          <p class="status" data-status role="status" aria-live="polite"></p>
          <button type="submit" class="button primary big" data-submit>{d ? 'Save changes' : 'Publish to the sketchbook'}</button>
        </div>
      </form>
      <JsonData id="editor-data" data={data} />
    </StudioLayout>
  );
};

export const ChaptersPage = ({ chapters, drawings, flash, error }: {
  chapters: Chapter[]; drawings: Drawing[]; flash?: string | null; error?: string | null;
}) => {
  const form = (c: Chapter | null) => {
    const picked = new Map(c?.drawings.map((cd, i) => [cd.drawing.id, { caption: cd.caption, position: i + 1 }]) ?? []);
    return (
      <form method="post" action={c ? `/studio/chapters/${c.id}` : '/studio/chapters'} enctype="multipart/form-data" class="chapter-form">
        <div class="grid">
          <label>Small line above the title<input name="kicker" required maxlength={80} value={c?.kicker ?? 'chapter five · 2026'} /></label>
          <label>Title<input name="title" required maxlength={120} value={c?.title ?? ''} /></label>
          <label class="span2">The chapter, in your words<textarea name="body" rows={5} required maxlength={6000}>{c?.body ?? ''}</textarea></label>
          <label>Note in the margin <span class="optional">optional</span><input name="margin_note" maxlength={200} value={c?.marginNote ?? ''} /></label>
          <label>Sticky note <span class="optional">optional</span><input name="sticky_note" maxlength={200} value={c?.stickyNote ?? ''} /></label>
          <label>A photo <span class="optional">optional · e.g. you as a kid</span><input type="file" name="photo" accept="image/*" /></label>
          <label>Photo caption <span class="optional">optional</span><input name="photo_caption" maxlength={120} value={c?.photoCaption ?? ''} /></label>
          {c?.photoKey && (
            <label class="check span2"><input type="checkbox" name="remove_photo" value="1" /> Remove the current photo
              <img class="thumb" src={media(c.photoKey)} alt="" />
            </label>
          )}
        </div>
        <fieldset class="picks">
          <legend>Drawings beside this chapter (the first two show)</legend>
          {drawings.map((d) => {
            const p = picked.get(d.id);
            return (
              <div class="pick">
                <label class="check"><input type="checkbox" name={`include-${d.id}`} value="1" checked={!!p} />
                  <img src={media(d.imageKey)} alt="" loading="lazy" /> {d.title}</label>
                <input name={`caption-${d.id}`} maxlength={120} placeholder="caption" value={p?.caption ?? ''} aria-label={`Caption for ${d.title}`} />
                <input name={`position-${d.id}`} type="number" min="1" max="99" value={String(p?.position ?? '')} placeholder="order" aria-label={`Order of ${d.title}`} />
              </div>
            );
          })}
        </fieldset>
        <button type="submit" class="button primary">{c ? 'Save chapter' : 'Add chapter'}</button>
      </form>
    );
  };
  return (
    <StudioLayout title="Story chapters" section="chapters" flash={flash} error={error}>
      <div class="head">
        <div>
          <p class="kicker">Story chapters</p>
          <h1>Your story, in order</h1>
        </div>
      </div>
      {chapters.map((c, i) => (
        <details class="card" open={chapters.length <= 1}>
          <summary>
            <span class="hand big">{c.position}</span> <b>{c.title}</b> <span class="muted">{c.kicker}</span>
          </summary>
          {form(c)}
          <div class="row card-actions">
            <form method="post" action={`/studio/chapters/${c.id}/move?dir=up`}><button class="button" disabled={i === 0}>Move up</button></form>
            <form method="post" action={`/studio/chapters/${c.id}/move?dir=down`}><button class="button" disabled={i === chapters.length - 1}>Move down</button></form>
            <form method="post" action={`/studio/chapters/${c.id}/delete`} data-confirm={`Delete the chapter “${c.title}”? The drawings stay in the sketchbook.`}>
              <button class="link danger">Delete chapter</button>
            </form>
          </div>
        </details>
      ))}
      <details class="card new-card" open={chapters.length === 0}>
        <summary><b>+ Add a chapter</b></summary>
        {form(null)}
      </details>
    </StudioLayout>
  );
};

export const CastPage = ({ people, flash, error }: { people: Person[]; flash?: string | null; error?: string | null }) => (
  <StudioLayout title="The cast" section="cast" flash={flash} error={error}>
    <div class="head">
      <div>
        <p class="kicker">The cast</p>
        <h1>Everyone you’ve drawn</h1>
      </div>
    </div>
    <p class="hint">New people are added when you name a face on a drawing. Here you can rename them, add a note, or change the order.</p>
    <ul class="people" role="list">
      {people.map((p, i) => (
        <li class="person card">
          <img src={media(p.faceKey)} alt="" loading="lazy" />
          <form method="post" action={`/studio/cast/${p.id}`} class="person-form">
            <label>Name<input name="name" required maxlength={60} value={p.name} /></label>
            <label>A note about them <span class="optional">optional</span><textarea name="note" rows={2} maxlength={600}>{p.note ?? ''}</textarea></label>
            <span class="muted">{p.drawings.length} {p.drawings.length === 1 ? 'drawing' : 'drawings'}{p.drawings.length === 0 ? ' — hidden on the site' : ''}</span>
            <button class="button">Save</button>
          </form>
          <div class="row">
            <form method="post" action={`/studio/cast/${p.id}/move?dir=up`}><button class="button" disabled={i === 0} aria-label={`Move ${p.name} up`}>↑</button></form>
            <form method="post" action={`/studio/cast/${p.id}/move?dir=down`}><button class="button" disabled={i === people.length - 1} aria-label={`Move ${p.name} down`}>↓</button></form>
            <form method="post" action={`/studio/cast/${p.id}/delete`} data-confirm={`Remove ${p.name} from the cast? Their name boxes on drawings go too.`}>
              <button class="link danger">Remove</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  </StudioLayout>
);

export const TextPage = ({ settings, drawings, flash, error }: { settings: Settings; drawings: Drawing[]; flash?: string | null; error?: string | null }) => (
  <StudioLayout title="Site text" section="text" flash={flash} error={error}>
    <div class="head">
      <div>
        <p class="kicker">Site text</p>
        <h1>The words around your drawings</h1>
      </div>
    </div>
    <form method="post" action="/studio/text" class="card text-form">
      <div class="grid">
        {SETTING_FIELDS.map((f) => (
          <label class={f.long ? 'span2' : ''}>
            {f.label}
            {f.long ? (
              <textarea name={f.key} rows={3} maxlength={f.max} placeholder={f.hint}>{settings[f.key] ?? ''}</textarea>
            ) : (
              <input name={f.key} maxlength={f.max} value={settings[f.key] ?? ''} placeholder={f.hint} />
            )}
          </label>
        ))}
        <label>Drawing shown in “How I draw”
          <select name="process_drawing">
            {drawings.map((d) => <option value={d.slug} selected={settings.process_drawing === d.slug}>{d.title}</option>)}
          </select>
        </label>
      </div>
      <button class="button primary">Save</button>
    </form>
  </StudioLayout>
);
