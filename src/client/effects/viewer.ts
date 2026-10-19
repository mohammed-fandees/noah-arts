/** Tap a name (on the page or in the list) and the camera glides into that face. */
export function initViewer() {
  const viewer = document.querySelector<HTMLElement>('[data-viewer]');
  const zoomer = viewer?.querySelector<HTMLElement>('[data-zoomer]');
  if (!viewer || !zoomer) return;
  const hotspots = Array.from(viewer.querySelectorAll<HTMLElement>('.hotspot'));
  const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('.face-chip[data-face]'));
  const more = document.querySelector<HTMLElement>('[data-face-more]');
  let current: string | null = null;

  const zoomTo = (slug: string | null) => {
    current = slug;
    const spot = slug ? hotspots.find((h) => h.dataset.face === slug) : undefined;
    if (!spot) {
      current = null;
      zoomer.style.transform = '';
      viewer.classList.remove('is-zoomed');
    } else {
      const W = viewer.clientWidth;
      const H = viewer.clientHeight;
      const x = spot.offsetLeft;
      const y = spot.offsetTop;
      const w = spot.offsetWidth;
      const h = spot.offsetHeight;
      const s = Math.max(1, Math.min(W / w, H / h) * 0.92);
      const tx = Math.min(0, Math.max(W - W * s, W / 2 - (x + w / 2) * s));
      const ty = Math.min(0, Math.max(H - H * s, H / 2 - (y + h / 2) * s));
      zoomer.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      viewer.classList.add('is-zoomed');
    }
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.face === current));
    if (more) {
      more.hidden = !current;
      const name = chips.find((c) => c.dataset.face === current)?.textContent ?? '';
      const nameEl = more.querySelector('[data-face-name]');
      if (nameEl) nameEl.textContent = name;
      const link = more.querySelector<HTMLAnchorElement>('[data-face-link]');
      if (link && current) link.href = `/?person=${encodeURIComponent(current)}#sketchbook`;
    }
  };

  hotspots.forEach((h) => h.addEventListener('click', () => zoomTo(h.dataset.face ?? null)));
  chips.forEach((c) => c.addEventListener('click', () => zoomTo(c.dataset.face === current ? null : c.dataset.face ?? null)));
  document.querySelector('[data-face-reset]')?.addEventListener('click', () => zoomTo(null));
  viewer.addEventListener('reveal:play', () => zoomTo(null));
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') zoomTo(null);
  });
  window.addEventListener('resize', () => zoomTo(current));

  const fromUrl = new URLSearchParams(location.search).get('face');
  if (fromUrl) window.setTimeout(() => zoomTo(fromUrl), 600);
}
