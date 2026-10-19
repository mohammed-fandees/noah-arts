import { scratchFor } from './sound';
import { reducedMotion } from './util';

const DRAW_MS = 7500;

/** The pencil shades Noah's self-portrait into the page, then "draw me again". */
export function initHero() {
  const art = document.querySelector<HTMLElement>('[data-hero-art]');
  const slot = art?.parentElement;
  if (!art || !slot) return;

  // Keep the art at its designed size (the pencil path is in px) and zoom it to fit small screens.
  const designWidth = Number(slot.dataset.fit) || art.offsetWidth;
  const fit = () => {
    const room = slot.clientWidth - 24;
    const scale = Math.min(1, room / designWidth);
    art.style.setProperty('zoom', String(scale));
  };
  fit();
  window.addEventListener('resize', fit);

  const draw = () => {
    if (reducedMotion()) return;
    art.classList.remove('is-drawing');
    void art.offsetWidth; // restart the CSS animations
    art.classList.add('is-drawing');
    scratchFor(DRAW_MS - 400, 0.8);
  };
  draw();
  document.querySelector('[data-hero-redraw]')?.addEventListener('click', draw);
}
