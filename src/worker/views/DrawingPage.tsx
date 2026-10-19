import type { Chapter, Drawing } from '../../shared/types';
import { RevealFigure } from './Home';
import { Layout } from './Layout';
import { Arrow, media, Tape } from './parts';

interface Props {
  drawing: Drawing;
  index: number;
  total: number;
  prev: Drawing;
  next: Drawing;
  chapter?: Chapter;
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const DrawingPage = ({ drawing: d, index, total, prev, next, chapter }: Props) => (
  <Layout page="drawing" title={`${d.title} — Noah’s sketchbook`} description={d.alt} ogImage={media(d.imageKey)}>
    <main id="main" class="drawing-page">
      <div class="drawing-top">
        <a href="/#sketchbook" class="back">
          <Arrow dir="left" /> <span class="hand">back to the sketchbook</span>
        </a>
        <nav class="drawing-nav" aria-label="Drawings">
          <span class="counter">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          <a class="round" href={`/d/${prev.slug}`} aria-label={`Previous: ${prev.title}`}><Arrow dir="left" /></a>
          <a class="round" href={`/d/${next.slug}`} aria-label={`Next: ${next.title}`}><Arrow /></a>
        </nav>
      </div>

      <div class="drawing-body">
        <div class="viewer-sheet">
          <Tape tilt={3} className="tape-top" />
          <div class="viewer" data-viewer style={`aspect-ratio:${d.width}/${d.height}`}>
            <div class="zoomer" data-zoomer data-reveal-group="drawing" data-autoplay>
              <RevealFigure d={d} label={d.alt} />
              {d.faces.map((f) => (
                <button
                  type="button"
                  class="hotspot"
                  data-face={f.personSlug}
                  style={`left:${pct(f.x)};top:${pct(f.y)};width:${pct(f.w)};height:${pct(f.h)}`}
                  aria-label={`Zoom into ${f.personName}`}
                >
                  <span class="hand">{f.personName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div class="drawing-info">
          <p class="kicker">
            {[d.shelf, d.pageDate, chapter ? `from chapter ${chapter.position} · ${chapter.title}` : null].filter(Boolean).join(' · ')}
          </p>
          <h1>{d.title}</h1>
          {d.quote && <p class="quote hand">“{d.quote}”</p>}
          {d.story && <p class="story-text">{d.story}</p>}

          {d.faces.length > 0 && (
            <div class="faces-box">
              <span class="label">Faces on this page — tap one</span>
              <div class="face-chips" role="group" aria-label="Faces on this page">
                {d.faces.map((f) => (
                  <button type="button" class="face-chip hand" data-face={f.personSlug} aria-pressed="false">{f.personName}</button>
                ))}
                <button type="button" class="face-chip face-reset" data-face-reset>whole page</button>
              </div>
              <p class="face-more" data-face-more hidden>
                <a href="/#sketchbook" data-face-link>every page with <span data-face-name></span> →</a>
              </p>
            </div>
          )}

          <div class="drawing-actions" data-reveal-controls="drawing">
            <button type="button" class="btn btn-light" data-reveal-play>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
              <span data-reveal-play-label>Watch it drawn</span>
            </button>
            {d.timelapseKey && (
              <a class="btn btn-ghost" href={media(d.timelapseKey)}>Time-lapse video</a>
            )}
            {chapter && <a class="btn btn-ghost" href="/#story">Read its chapter</a>}
          </div>
        </div>
      </div>
    </main>
  </Layout>
);

export const NotFound = () => (
  <Layout page="missing" title="Page not found — Noah’s sketchbook">
    <main id="main" class="missing">
      <p class="hand big">this page was torn out…</p>
      <a class="btn btn-dark" href="/">Back to the sketchbook</a>
    </main>
  </Layout>
);

