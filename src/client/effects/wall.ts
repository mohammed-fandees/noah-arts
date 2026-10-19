/** Sketchbook filters (by shelf, or by a person from the cast via ?person=slug). */
export function initWall() {
  const wall = document.querySelector<HTMLElement>('[data-wall]');
  const chips = document.querySelector<HTMLElement>('[data-filters]');
  if (!wall || !chips) return;
  const cards = Array.from(wall.querySelectorAll<HTMLElement>('.card'));
  const shelfChips = Array.from(chips.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const personChip = chips.querySelector<HTMLButtonElement>('[data-person-chip]');

  let shelf = 'all';
  let person = new URLSearchParams(location.search).get('person');

  const apply = () => {
    for (const card of cards) {
      const okShelf = shelf === 'all' || card.dataset.shelf === shelf;
      const okPerson = !person || (card.dataset.people ?? '').split(' ').includes(person);
      card.hidden = !(okShelf && okPerson);
    }
    for (const chip of shelfChips) chip.setAttribute('aria-pressed', String(chip.dataset.filter === shelf));
    if (personChip) {
      personChip.hidden = !person;
      const name = person && document.querySelector(`.face[href*="face=${CSS.escape(person)}"] .face-name`)?.textContent;
      const label = personChip.querySelector('[data-person-name]');
      if (label) label.textContent = name || person || '';
    }
  };

  for (const chip of shelfChips) {
    chip.addEventListener('click', () => {
      shelf = chip.dataset.filter ?? 'all';
      apply();
    });
  }
  personChip?.addEventListener('click', () => {
    person = null;
    history.replaceState(null, '', location.pathname + location.hash);
    apply();
  });
  apply();

  // On touch screens there is no hover: let the graphite come in as each page scrolls into view.
  if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-seen')),
      { threshold: 0.6 }
    );
    cards.forEach((c) => io.observe(c));
  }
}
