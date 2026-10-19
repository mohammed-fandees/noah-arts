import type { Chapter, Drawing, Person, Site } from '../../shared/types';
import { Layout, SiteFooter, SiteHeader } from './Layout';
import { Arrow, Art, hatchPath, isWide, media, Pencil, PencilDown, Tape } from './parts';

const HERO_W = 420;

const Hero = ({ s }: { s: Site['settings'] }) => {
  const iw = Number(s.hero_image_width) || 330;
  const ih = Number(s.hero_image_height) || 397;
  const h = Math.round((HERO_W * ih) / iw);
  const hatch = hatchPath(HERO_W, h);
  const src = media(s.hero_image_key);
  return (
    <section id="top" class="hero" data-doodle>
      <div class="wrap hero-row">
        <div class="hero-text">
          <p class="kicker">01 — {s.hero_kicker}</p>
          <h1 class="name-mark">
            <span class="sr-only">Noah — my sketchbook</span>
            <svg viewBox="0 0 760 330" aria-hidden="true">
              <path class="name-underline" d="M8 300 c120 -14 340 -18 560 -6 c70 4 120 10 170 2" />
              <text class="name-stroke" x="0" y="262">Noah</text>
            </svg>
          </h1>
          <p class="hero-tagline">{s.hero_tagline}</p>
          <div class="actions">
            <a class="btn btn-dark" href="#story">Start the story <Arrow dir="down" /></a>
            <a class="btn" href="#sketchbook">Just the drawings</a>
          </div>
          <div class="doodle-hint">
            <svg class="wiggle" width="64" height="44" viewBox="0 0 64 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M60 6 c-20 4 -40 14 -50 30" />
              <path d="M6 26 l4 12 l12 -4" />
            </svg>
            <span class="hand" data-doodle-hint>psst — hold &amp; drag anywhere here to sketch with me</span>
            <button type="button" class="eraser-btn" data-doodle-erase hidden>
              <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                <rect x="1" y="1" width="20" height="12" rx="3" fill="#E7A3A0" stroke="#1F1F1E" stroke-width="1.2" />
                <line x1="8" y1="1" x2="8" y2="13" stroke="#1F1F1E" stroke-width="1.2" />
              </svg>
              erase my doodles
            </button>
          </div>
        </div>

        <div class="hero-art-slot" data-fit={HERO_W}>
          <div class="hero-art" data-hero-art style={`width:${HERO_W}px;height:${h}px`}>
            <Tape tilt={-3} className="tape-top" />
            <svg width={HERO_W} height={h} viewBox={`0 0 ${HERO_W} ${h}`} role="img" aria-label={s.hero_image_alt}>
              <defs>
                <mask id="hero-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={HERO_W} height={h}>
                  <rect x="0" y="0" width={HERO_W} height={h} fill="black" />
                  <path class="hatch-run" d={hatch.d} style={`--len:${hatch.length}`} />
                </mask>
              </defs>
              <image class="hero-masked" href={src} x="0" y="0" width={HERO_W} height={h} preserveAspectRatio="xMidYMid slice" mask="url(#hero-mask)" />
              <image class="hero-full" href={src} x="0" y="0" width={HERO_W} height={h} preserveAspectRatio="xMidYMid slice" />
            </svg>
            <div class="pencil-run" style={`offset-path:path('${hatch.d}')`} aria-hidden="true"><Pencil /></div>
            {s.hero_caption && <span class="hero-caption hand">← {s.hero_caption}</span>}
          </div>
          <button type="button" class="redraw hand" data-hero-redraw>draw me again ↺</button>
        </div>
      </div>
      <svg class="doodle-layer" data-doodle-layer aria-hidden="true"></svg>
    </section>
  );
};

const Polaroid = ({ d, caption, eager = false }: { d: Drawing; caption: string | null; eager?: boolean }) => (
  <figure class="polaroid">
    <Tape />
    <a href={`/d/${d.slug}`} aria-label={`Open ${d.title}`}>
      <Art src={media(d.imageKey)} alt={d.alt} width={d.width} height={d.height} eager={eager} />
    </a>
    {caption && <figcaption class="hand">{caption}</figcaption>}
  </figure>
);

const ChapterBlock = ({ c, index }: { c: Chapter; index: number }) => {
  const count = c.drawings.length + (c.photoKey ? 1 : 0);
  return (
    <article class={`chap ${index % 2 === 1 ? 'chap-flip' : ''}`}>
      <div class="chap-text">
        <span class="chap-kicker hand">{c.kicker}</span>
        <h3>{c.title}</h3>
        <p>{c.body}</p>
        {c.marginNote && <p class="margin-note hand">{c.marginNote}</p>}
      </div>
      <div class={`chap-node ${index === 3 ? 'is-dark' : ''}`} aria-hidden="true">{c.position}</div>
      <div class={`collage collage-${Math.min(count, 2)}`}>
        {c.photoKey && (
          <figure class="polaroid">
            <Tape />
            <img class="photo" src={media(c.photoKey)} alt={c.photoCaption ?? ''} loading="lazy" />
            {c.photoCaption && <figcaption class="hand">{c.photoCaption}</figcaption>}
          </figure>
        )}
        {c.drawings.slice(0, c.photoKey ? 1 : 2).map((cd) => <Polaroid d={cd.drawing} caption={cd.caption} />)}
        {c.stickyNote && <p class="sticky hand">{c.stickyNote}</p>}
      </div>
    </article>
  );
};

// A gently wobbling vertical line; stretched to the height of the story.
const STORY_LINE = 'M48 0 C 34 60, 62 120, 48 180 S 34 300, 48 360 S 62 480, 48 540 S 34 660, 48 720 S 62 840, 48 900 S 44 970, 48 1000';

const Story = ({ s, chapters }: { s: Site['settings']; chapters: Chapter[] }) => (
  <section id="story" class="story">
    <div class="wrap story-head">
      <p class="kicker">02 — The story so far</p>
      <h2>{s.story_title}</h2>
      <p class="lede">{s.story_intro}</p>
      <span class="hand follow">follow the line ↓</span>
    </div>
    <div class="wrap story-body" data-story>
      <div class="story-line" aria-hidden="true">
        <svg class="sl-svg" viewBox="0 0 96 1000" preserveAspectRatio="none">
          <path class="sl-ghost" d={STORY_LINE} />
        </svg>
        <svg class="sl-svg sl-ink" data-story-ink viewBox="0 0 96 1000" preserveAspectRatio="none">
          <path class="sl-path" d={STORY_LINE} />
        </svg>
        <div class="story-pencil"><PencilDown /></div>
      </div>
      {chapters.map((c, i) => <ChapterBlock c={c} index={i} />)}
      <p class="to-be-continued hand">to be continued…</p>
    </div>
  </section>
);

const Sketchbook = ({ s, drawings }: { s: Site['settings']; drawings: Drawing[] }) => {
  const shelves = Array.from(new Set(drawings.map((d) => d.shelf)));
  return (
    <section id="sketchbook" class="sketchbook">
      <div class="wrap">
        <div class="section-head">
          <div>
            <p class="kicker">03 — The sketchbook</p>
            <h2>{s.gallery_title}</h2>
          </div>
          <div class="view-switch" role="group" aria-label="View">
            <span class="is-on">Wall</span>
            <a href="/notebook">Flip through the notebook <Arrow /></a>
          </div>
        </div>
        <div class="chips" role="group" aria-label="Filter drawings" data-filters>
          <button type="button" class="chip" data-filter="all" aria-pressed="true">
            <ChipPencil /> Everything <span class="count">{drawings.length}</span>
          </button>
          {shelves.map((shelf) => (
            <button type="button" class="chip" data-filter={shelf} aria-pressed="false">
              <ChipPencil /> {shelf} <span class="count">{drawings.filter((d) => d.shelf === shelf).length}</span>
            </button>
          ))}
          <button type="button" class="chip chip-person" data-person-chip hidden aria-pressed="true">
            with <span data-person-name></span> ×
          </button>
        </div>
        <div class="wall" data-wall>
          {drawings.map((d, i) => (
            <a
              href={`/d/${d.slug}`}
              class={`card ${isWide(d.width, d.height) ? 'is-wide' : ''}`}
              style={`--tilt:${[-1.2, 1.6, -1.8, 1.2, -1, 1.4][i % 6]}deg`}
              data-shelf={d.shelf}
              data-people={d.faces.map((f) => f.personSlug).join(' ')}
            >
              <Tape tilt={[-4, 5, -3, 3, 6, -5][i % 6]} />
              {d.isNew && <span class="new-badge hand">new!</span>}
              <Art src={media(d.imageKey)} alt={d.alt} width={d.width} height={d.height} />
              <span class="card-foot">
                <span>
                  <span class="card-title hand">{d.title}</span>
                  <span class="card-meta">{[d.shelf, d.pageDate, d.faces.length > 1 ? `${d.faces.length} faces` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span class="card-open hand">look closer →</span>
              </span>
            </a>
          ))}
        </div>
        <p class="hand hint-center">(hover a page — the graphite comes in)</p>
      </div>
    </section>
  );
};

const ChipPencil = () => (
  <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
    <polygon points="0,6 8,4 8,8" fill="currentColor" />
    <polygon points="8,4 18,0 18,12 8,8" fill="#E8CFA4" />
    <rect x="18" y="0" width="16" height="12" fill="var(--pencil)" />
  </svg>
);

const Cast = ({ s, people }: { s: Site['settings']; people: Person[] }) => (
  <section id="cast" class="cast">
    <div class="wrap">
      <div class="section-head">
        <div>
          <p class="kicker">04 — The cast</p>
          <h2>{s.cast_title}</h2>
        </div>
        <p class="lede narrow">{s.cast_intro}</p>
      </div>
      <ul class="faces" role="list">
        {people.filter((p) => p.drawings.length > 0).map((p, i) => (
          <li>
            <a class="face" href={`/d/${p.drawings[0].slug}?face=${p.slug}`} style={`--tilt:${[-2, 1.5, -1, 2, -1.5, 1, -2.2, 1.4][i % 8]}deg`}>
              <Tape tilt={[-5, 4, -3, 6, -4, 3, 5, -6][i % 8]} />
              <img class="art" src={media(p.faceKey)} alt={`Pencil sketch of ${p.name}`} width="320" height="400" loading="lazy" />
              <span class="face-foot">
                <span class="hand face-name">{p.name}</span>
                <span class="face-meta">{p.drawings.length} {p.drawings.length === 1 ? 'page' : 'pages'}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export const RevealFigure = ({ d, label }: { d: Drawing; label: string }) => (
  <div class="reveal" data-reveal data-src={media(d.imageKey)} data-stages={JSON.stringify(d.stages.map(media))}>
    <img class="reveal-img" src={media(d.imageKey)} alt={label} width={d.width} height={d.height} loading="lazy" />
    <canvas class="reveal-canvas" aria-hidden="true"></canvas>
  </div>
);

const Process = ({ s, drawing }: { s: Site['settings']; drawing?: Drawing }) => (
  <section id="process" class="process">
    <div class="wrap process-row">
      <div class="process-text">
        <p class="kicker">05 — How I draw</p>
        <h2>{s.process_title}</h2>
        <p class="lede">{s.process_text}</p>
        {drawing && (
          <div class="scrub" data-reveal-controls="process">
            <div class="scrub-top">
              <label for="process-scrub">Watch a drawing come in</label>
              <button type="button" class="pill" data-reveal-play>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
                <span data-reveal-play-label>Watch it again</span>
              </button>
            </div>
            <input id="process-scrub" type="range" min="0" max="100" value="100" data-reveal-range />
            <div class="scrub-labels hand"><span>first lines</span><span>shading</span><span>done</span></div>
          </div>
        )}
      </div>
      {drawing && (
        <div class="process-art" data-reveal-group="process" data-autoplay>
          <Tape tilt={4} className="tape-top" />
          <RevealFigure d={drawing} label={drawing.alt} />
        </div>
      )}
    </div>
  </section>
);

const PENCILS = [
  { g: '6H', tip: '#B3B2AC', body: 150 }, { g: '2H', tip: '#94938D', body: 118 }, { g: 'HB', tip: '#6E6D68', body: 64 },
  { g: '2B', tip: '#454542', body: 96 }, { g: '4B', tip: '#2B2B29', body: 128 }, { g: '6B', tip: '#0E0E0D', body: 84 }
];

const Closing = ({ s }: { s: Site['settings'] }) => (
  <section id="next" class="closing">
    <div class="wrap closing-row">
      <div class="closing-text">
        <p class="kicker">06 — To be continued</p>
        <h2>{s.closing_title}</h2>
        <p class="lede">{s.closing_text}</p>
        {s.instagram_url && (
          <a class="link" href={s.instagram_url} rel="me noopener">Follow along on Instagram {s.instagram_handle}</a>
        )}
        <div class="pencil-case">
          <span class="hand">what’s in my pencil case:</span>
          <ul class="pencils" role="list">
            {PENCILS.map((p) => {
              const top = 240 - (34 + p.body + 28);
              return (
                <li>
                  <svg width="30" height="240" viewBox="0 0 30 240" aria-hidden="true">
                    <g transform={`translate(0 ${top})`}>
                      <polygon points="15,0 11,10 19,10" fill={p.tip} />
                      <polygon points="11,10 4,34 26,34 19,10" fill="#E8CFA4" />
                      <rect x="4" y="34" width="22" height={p.body} fill="var(--pencil)" />
                      <rect x="4" y={34 + p.body} width="22" height="12" fill="#B9B8B2" />
                      <rect x="4" y={46 + p.body} width="22" height="16" rx="4" fill="#E7A3A0" />
                    </g>
                  </svg>
                  <span>{p.g}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div class="blank-page-slot">
        <div class="blank-page">
          <Tape tilt={-4} className="tape-top" />
          <span class="hand">the next drawing goes here…</span>
        </div>
        <div class="hover-pencil" aria-hidden="true"><Pencil /></div>
      </div>
    </div>
  </section>
);

export const Home = ({ site }: { site: Site }) => {
  const s = site.settings;
  const processDrawing = site.drawings.find((d) => d.slug === s.process_drawing) ?? site.drawings[0];
  return (
    <Layout
      page="home"
      title="Noah — my sketchbook"
      description={s.hero_tagline}
      ogImage={s.hero_image_key ? media(s.hero_image_key) : undefined}
    >
      <SiteHeader />
      <main id="main">
        <Hero s={s} />
        <Story s={s} chapters={site.chapters} />
        <Sketchbook s={s} drawings={site.drawings} />
        <Cast s={s} people={site.people} />
        <Process s={s} drawing={processDrawing} />
        <Closing s={s} />
      </main>
      <SiteFooter />
    </Layout>
  );
};
