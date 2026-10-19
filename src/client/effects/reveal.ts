import { startScratch, type Scratch } from './sound';
import { clamp, onFirstView, reducedMotion } from './util';

// "Lines first, then shading": a drawing appears in order of how dark each pixel is,
// so the firm lines come first and the soft shading and page lines last. Works on any
// uploaded image. If Noah uploads real stage photos, they cross-fade instead.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, 1.0 - (a_pos.y + 1.0) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_img;
uniform float u_t;
uniform vec2 u_size;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec4 c = texture2D(u_img, v_uv);
  float dark = 1.0 - dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float grain = noise(v_uv * u_size / 2.5) * 0.6 + noise(v_uv * u_size / 9.0) * 0.4;
  float a = clamp((dark + (grain - 0.5) * 0.3 - (1.0 - u_t)) * 9.0, 0.0, 1.0);
  a = max(a, smoothstep(0.93, 1.0, u_t));
  gl_FragColor = vec4(mix(vec3(1.0), c.rgb, a), 1.0);
}`;

type Painter = (t: number) => void;

function glPainter(root: HTMLElement, img: HTMLImageElement): Painter | null {
  const canvas = root.querySelector<HTMLCanvasElement>('.reveal-canvas');
  const gl = canvas?.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!canvas || !gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  } catch {
    return null;
  }
  const uT = gl.getUniformLocation(prog, 'u_t');
  const uSize = gl.getUniformLocation(prog, 'u_size');

  let last = 1;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(root.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(root.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uSize, canvas.width, canvas.height);
  };
  const paint: Painter = (t) => {
    last = t;
    gl.uniform1f(uT, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  size();
  new ResizeObserver(() => {
    size();
    paint(last);
  }).observe(root);
  root.classList.add('is-gl');
  return paint;
}

function stagePainter(root: HTMLElement, img: HTMLImageElement, stages: string[]): Painter {
  // Each stage photo (and finally the finished drawing) is a layer on top of the last;
  // layer k fades in while t moves through the k-th step.
  const layers = [...stages, img.src].map((src) => {
    const im = new Image();
    im.src = src;
    im.alt = '';
    im.className = 'reveal-stage';
    root.appendChild(im);
    return im;
  });
  root.classList.add('is-staged');
  return (t) => {
    const pos = t * (layers.length - 1);
    layers.forEach((im, k) => {
      im.style.opacity = String(k === 0 ? 1 : clamp(pos - (k - 1)));
    });
  };
}

interface RevealHandle {
  set(t: number): void;
  play(onEnd?: () => void, onFrame?: (t: number) => void): void;
}

function createReveal(root: HTMLElement, startAt: number): Promise<RevealHandle> {
  return new Promise((resolve) => {
    const stages: string[] = JSON.parse(root.dataset.stages || '[]');
    const img = root.querySelector<HTMLImageElement>('.reveal-img')!;
    let paint: Painter = () => {};
    let raf = 0;
    let sound: Scratch = { stop() {} };

    const handle: RevealHandle = {
      set(t) {
        cancelAnimationFrame(raf);
        sound.stop();
        paint(t);
      },
      play(onEnd, onFrame) {
        cancelAnimationFrame(raf);
        sound.stop();
        const duration = stages.length ? 1400 * (stages.length + 1) : 5200;
        const start = performance.now();
        sound = startScratch(0.8);
        const step = (now: number) => {
          const t = clamp((now - start) / duration);
          paint(t);
          onFrame?.(t);
          if (t < 1) raf = requestAnimationFrame(step);
          else {
            sound.stop();
            onEnd?.();
          }
        };
        raf = requestAnimationFrame(step);
      }
    };

    const ready = () => {
      paint = stages.length ? stagePainter(root, img, stages) : glPainter(root, img) ?? (() => {});
      paint(startAt);
      resolve(handle);
    };
    if (img.complete && img.naturalWidth) ready();
    else img.addEventListener('load', ready, { once: true });
  });
}

/** Wires each [data-reveal-group] to its [data-reveal-controls] (play button + scrubber). */
export function initReveals() {
  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach(async (group) => {
    const root = group.querySelector<HTMLElement>('[data-reveal]');
    if (!root) return;
    const name = group.dataset.revealGroup;
    const controls = document.querySelector<HTMLElement>(`[data-reveal-controls="${name}"]`);
    const range = controls?.querySelector<HTMLInputElement>('[data-reveal-range]');
    const playBtn = controls?.querySelector<HTMLButtonElement>('[data-reveal-play]');
    const label = controls?.querySelector<HTMLElement>('[data-reveal-play-label]');
    const idleLabel = label?.textContent ?? '';
    const autoplay = group.hasAttribute('data-autoplay') && !reducedMotion();

    const reveal = await createReveal(root, autoplay ? 0 : 1);
    if (range) range.value = autoplay ? '0' : '100';

    const play = () => {
      if (label) label.textContent = 'Drawing…';
      reveal.play(
        () => {
          if (label) label.textContent = idleLabel;
        },
        (t) => {
          if (range) range.value = String(Math.round(t * 100));
        }
      );
    };

    playBtn?.addEventListener('click', () => {
      group.dispatchEvent(new CustomEvent('reveal:play', { bubbles: true }));
      play();
    });
    range?.addEventListener('input', () => {
      reveal.set(Number(range.value) / 100);
      if (label) label.textContent = idleLabel;
    });
    if (autoplay) onFirstView(group, play);
  });
}
