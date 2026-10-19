import type { Drawing } from '../../shared/types';
import { Layout } from './Layout';
import { Arrow, JsonData, media } from './parts';

export const NotebookPage = ({ drawings }: { drawings: Drawing[] }) => {
  const pages = drawings.map((d) => ({ src: media(d.imageKey), title: d.title, alt: d.alt, slug: d.slug }));
  return (
    <Layout page="notebook" title="The notebook — Noah’s sketchbook" description="Flip through Noah’s notebook, page by page.">
      <main id="main" class="notebook-page">
        <div class="notebook-top">
          <a href="/#sketchbook" class="back"><Arrow dir="left" /> <span class="hand">back to the wall</span></a>
          <span class="counter" data-nb-counter aria-live="polite"></span>
        </div>
        <div class="notebook" data-notebook>
          <noscript>
            <ul class="nb-fallback">
              {pages.map((p) => (
                <li><a href={`/d/${p.slug}`}><img src={p.src} alt={p.alt} /></a></li>
              ))}
            </ul>
          </noscript>
        </div>
        <div class="notebook-controls">
          <button type="button" class="round" data-nb-prev aria-label="Previous pages"><Arrow dir="left" /></button>
          <span class="hand">turn the page</span>
          <button type="button" class="round" data-nb-next aria-label="Next pages"><Arrow /></button>
        </div>
        <JsonData id="notebook-pages" data={pages} />
      </main>
    </Layout>
  );
};
