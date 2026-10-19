import { startScratch, type Scratch } from './sound';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_STROKES = 40;

/** Visitors can sketch on the hero with a soft pencil, then rub it out. */
export function initDoodle() {
  const area = document.querySelector<HTMLElement>('[data-doodle]');
  const layer = document.querySelector<SVGSVGElement>('[data-doodle-layer]');
  const hint = document.querySelector<HTMLElement>('[data-doodle-hint]');
  const erase = document.querySelector<HTMLButtonElement>('[data-doodle-erase]');
  if (!area || !layer) return;

  let points: [number, number][] = [];
  let path: SVGPathElement | null = null;
  let sound: Scratch | null = null;

  const toD = (p: [number, number][]) => {
    let d = `M${p[0][0]} ${p[0][1]}`;
    for (let i = 1; i < p.length; i++) {
      const mx = (p[i - 1][0] + p[i][0]) / 2;
      const my = (p[i - 1][1] + p[i][1]) / 2;
      d += ` Q${p[i - 1][0]} ${p[i - 1][1]} ${mx} ${my}`;
    }
    const last = p[p.length - 1];
    return `${d} L${last[0]} ${last[1]}`;
  };

  const at = (e: PointerEvent): [number, number] => {
    const r = area.getBoundingClientRect();
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
  };

  area.classList.add('is-doodling');
  area.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('a, button, input, textarea, [data-hero-art]')) return;
    // Touch: leave vertical swipes to scrolling; draw with a mouse or pen.
    if (e.pointerType === 'touch') return;
    points = [at(e)];
    path = document.createElementNS(SVG_NS, 'path');
    layer.appendChild(path);
    while (layer.childNodes.length > MAX_STROKES) layer.firstChild?.remove();
    area.setPointerCapture(e.pointerId);
    sound = startScratch(0.7);
  });
  area.addEventListener('pointermove', (e) => {
    if (!path) return;
    points.push(at(e));
    if (points.length > 1) path.setAttribute('d', toD(points));
  });
  const end = () => {
    if (!path) return;
    if (points.length < 2) path.remove();
    path = null;
    sound?.stop();
    sound = null;
    const has = layer.childNodes.length > 0;
    if (erase) erase.hidden = !has;
    if (hint) hint.textContent = has ? 'not bad! keep going, or' : 'psst — hold & drag anywhere here to sketch with me';
  };
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);

  erase?.addEventListener('click', () => {
    layer.replaceChildren();
    end();
    erase.hidden = true;
    if (hint) hint.textContent = 'psst — hold & drag anywhere here to sketch with me';
  });
}
