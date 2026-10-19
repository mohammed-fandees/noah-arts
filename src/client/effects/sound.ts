// Pencil-on-paper sound, synthesised (no audio files): band-passed noise with a
// jittery volume, like strokes. Off by default; the visitor's choice is remembered.

const KEY = 'noah-sound';
let enabled = false;
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

try {
  enabled = localStorage.getItem(KEY) === 'on';
} catch {
  enabled = false;
}

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export interface Scratch {
  stop(): void;
}

const silent: Scratch = { stop() {} };

/** Starts a scratching sound; call stop() when the drawing stops. */
export function startScratch(intensity = 1): Scratch {
  if (!enabled) return silent;
  const ac = audio();
  if (!ac || !noise) return silent;
  const source = ac.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2600;
  band.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.value = 0;
  source.connect(band).connect(gain).connect(ac.destination);
  source.start();
  const timer = window.setInterval(() => {
    const now = ac.currentTime;
    gain.gain.setTargetAtTime((0.015 + Math.random() * 0.06) * intensity, now, 0.02);
    band.frequency.setTargetAtTime(2000 + Math.random() * 1800, now, 0.05);
  }, 70);
  return {
    stop() {
      window.clearInterval(timer);
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      window.setTimeout(() => source.stop(), 300);
    }
  };
}

/** A scratch that stops on its own. */
export function scratchFor(ms: number, intensity = 1) {
  const s = startScratch(intensity);
  window.setTimeout(() => s.stop(), ms);
}

export function initSoundToggle() {
  const button = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  const label = document.querySelector<HTMLElement>('[data-sound-label]');
  if (!button) return;
  const render = () => {
    button.setAttribute('aria-pressed', String(enabled));
    if (label) label.textContent = enabled ? 'sounds on' : 'sounds off';
  };
  render();
  button.addEventListener('click', () => {
    enabled = !enabled;
    try {
      localStorage.setItem(KEY, enabled ? 'on' : 'off');
    } catch {
      /* private mode: keep it for this visit only */
    }
    render();
    if (enabled) scratchFor(600);
  });
}
