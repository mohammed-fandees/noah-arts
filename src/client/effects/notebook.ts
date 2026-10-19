import { scratchFor } from './sound';

interface Page {
  src: string;
  title: string;
  alt: string;
  slug: string;
}

type Sheet = Page | 'cover' | null;

/** Flip through the notebook: real page turns over a spiral binding (one page at a time on phones). */
export function initNotebook() {
  const book = document.querySelector<HTMLElement>('[data-notebook]');
  const data = document.getElementById('notebook-pages');
  if (!book || !data) return;
  const pages: Page[] = JSON.parse(data.textContent || '[]');
  const sheets: Sheet[] = ['cover', ...pages];
  const prevBtn = document.querySelector<HTMLButtonElement>('[data-nb-prev]');
  const nextBtn = document.querySelector<HTMLButtonElement>('[data-nb-next]');
  const counter = document.querySelector<HTMLElement>('[data-nb-counter]');

  const single = () => window.matchMedia('(max-width: 760px)').matches;
  let pos = 0; // spread index, or page index in single mode
  let busy = false;

  const sheetEl = (sheet: Sheet | undefined, side: 'nb-left' | 'nb-right', num: number) => {
    const el = document.createElement('div');
    el.className = `nb-page ${side}`;
    if (sheet === 'cover') {
      el.innerHTML =
        '<div class="nb-cover"><span class="kicker">This notebook belongs to</span>' +
        '<span class="hand big">Noah</span><span class="hand small">if found, please don’t peek… ok, peek.</span></div>';
    } else if (sheet) {
      const link = document.createElement('a');
      link.className = 'nb-img';
      link.href = `/d/${sheet.slug}`;
      const img = document.createElement('img');
      img.src = sheet.src;
      img.alt = sheet.alt;
      link.appendChild(img);
      const cap = document.createElement('div');
      cap.className = 'nb-cap';
      cap.innerHTML = '<span class="hand"></span><span class="num"></span>';
      cap.children[0].textContent = sheet.title;
      cap.children[1].textContent = `p.${num}`;
      el.append(link, cap);
    }
    return el;
  };

  const lastPos = () => (single() ? sheets.length - 1 : Math.floor((sheets.length - 1) / 2));
  const leftAt = (p: number) => (single() ? -1 : 2 * p);
  const rightAt = (p: number) => (single() ? p : 2 * p + 1);

  const render = () => {
    book.classList.toggle('is-single', single());
    pos = Math.min(pos, lastPos());
    const rings = document.createElement('div');
    rings.className = 'nb-rings';
    rings.innerHTML = '<span></span>'.repeat(15);
    const kids: HTMLElement[] = [];
    if (!single()) kids.push(sheetEl(sheets[leftAt(pos)], 'nb-left', leftAt(pos)));
    kids.push(sheetEl(sheets[rightAt(pos)], 'nb-right', rightAt(pos)), rings);
    book.replaceChildren(...kids);
    if (prevBtn) prevBtn.disabled = pos === 0;
    if (nextBtn) nextBtn.disabled = pos >= lastPos();
    if (counter) {
      const a = single() ? pos : 2 * pos;
      const b = Math.min(single() ? pos : 2 * pos + 1, sheets.length - 1);
      const label = (n: number) => (n === 0 ? 'Cover' : `page ${n}`);
      const text = a === b ? label(a) : `${label(a)} – ${label(b)}`;
      counter.textContent = `${text.charAt(0).toUpperCase()}${text.slice(1)} of ${pages.length}`;
    }
  };

  const turn = (dir: 1 | -1) => {
    if (busy) return;
    const target = pos + dir;
    if (target < 0 || target > lastPos()) return;
    busy = true;
    scratchFor(500, 0.5);
    const leaf = document.createElement('div');
    leaf.className = `nb-leaf ${dir === 1 ? 'to-next' : 'to-prev'}`;
    let front: Sheet | undefined;
    let back: Sheet | undefined;
    if (single()) {
      // Next: the current page lifts away to the left; prev: the previous page comes back over.
      front = sheets[dir === 1 ? pos : target];
      back = null;
      const under = book.querySelector('.nb-right');
      if (dir === 1 && under) under.replaceWith(sheetEl(sheets[target], 'nb-right', target));
    } else {
      front = sheets[dir === 1 ? rightAt(pos) : leftAt(pos)];
      back = sheets[dir === 1 ? leftAt(target) : rightAt(target)];
      // Reveal the page that lies under the turning leaf.
      if (dir === 1) book.querySelector('.nb-right')?.replaceWith(sheetEl(sheets[rightAt(target)], 'nb-right', rightAt(target)));
      else book.querySelector('.nb-left')?.replaceWith(sheetEl(sheets[leftAt(target)], 'nb-left', leftAt(target)));
    }
    const f = sheetEl(front, 'nb-right', dir === 1 ? rightAt(pos) : single() ? target : leftAt(pos));
    const b = sheetEl(back, 'nb-left', dir === 1 ? leftAt(target) : rightAt(target));
    b.classList.add('nb-back');
    leaf.append(f, b);
    book.appendChild(leaf);
    leaf.addEventListener(
      'animationend',
      () => {
        pos = target;
        busy = false;
        render();
      },
      { once: true }
    );
  };

  prevBtn?.addEventListener('click', () => turn(-1));
  nextBtn?.addEventListener('click', () => turn(1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') turn(1);
    if (e.key === 'ArrowLeft') turn(-1);
  });
  let wasSingle = single();
  window.addEventListener('resize', () => {
    if (single() !== wasSingle) {
      wasSingle = single();
      pos = 0;
      render();
    }
  });
  render();
}
