// Scroll-linked pieces: the header pencil that gets shorter as you read, and the
// story line that a pencil draws through the chapters.

export function initScrollEffects() {
  const progress = document.querySelector<HTMLElement>('[data-progress]');
  const story = document.querySelector<HTMLElement>('[data-story]');
  const storyInk = document.querySelector<SVGSVGElement>('[data-story-ink]');
  const storyPencil = document.querySelector<HTMLElement>('.story-pencil');
  if (!progress && !story) return;

  let queued = false;
  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      const f = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.style.width = `${100 - f * 84}%`;
    }
    if (story && storyInk) {
      const r = story.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (vh / 2 - r.top) / r.height));
      storyInk.style.clipPath = `inset(0 -20px ${((1 - f) * 100).toFixed(2)}% -20px)`;
      // The pencil's tip rides the end of the line.
      const line = storyPencil?.parentElement;
      if (storyPencil && line) storyPencil.style.transform = `translateY(${f * line.clientHeight}px)`;
    }
  };
  const onScroll = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}
