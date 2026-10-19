import { initDoodle } from './effects/doodle';
import { initHero } from './effects/hero';
import { initNotebook } from './effects/notebook';
import { initReveals } from './effects/reveal';
import { initScrollEffects } from './effects/scroll';
import { initSoundToggle } from './effects/sound';
import { initViewer } from './effects/viewer';
import { initWall } from './effects/wall';

// Every effect enhances markup the server already rendered: without this script the
// site still shows every drawing and every word.
const start = () => {
  initSoundToggle();
  initScrollEffects();
  initHero();
  initDoodle();
  initWall();
  initReveals();
  initViewer();
  initNotebook();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
