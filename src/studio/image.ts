// Image work for the studio, done in the browser so the Worker never has to touch pixels:
// straighten a phone photo of a page (four corners → rectangle), then clean it
// (paper → white, shadows and tint gone, graphite a little deeper).
// The clean-up is the same maths as scripts/clean_photo.py.

export interface Pt {
  x: number;
  y: number;
}

export const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

/** Loads a file (respecting phone orientation) into a canvas no larger than `maxSide`. */
export async function loadFile(file: Blob, maxSide = 2400): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const c = canvasOf(bitmap.width * s, bitmap.height * s);
  const g = ctx2d(c);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

export async function loadUrl(url: string): Promise<HTMLCanvasElement> {
  const res = await fetch(url);
  return loadFile(await res.blob(), 4000);
}

export function rotate(src: HTMLCanvasElement, dir: 1 | -1): HTMLCanvasElement {
  const c = canvasOf(src.height, src.width);
  const g = ctx2d(c);
  g.translate(c.width / 2, c.height / 2);
  g.rotate((dir * Math.PI) / 2);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/** Projective map from the unit square to the quad tl, tr, br, bl (Heckbert). */
function squareToQuad([p0, p1, p2, p3]: Pt[]) {
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  return (u: number, v: number): Pt => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + p0.x) / w, y: (d * u + e * v + p0.y) / w };
  };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size for a quad: the longer of each pair of opposite edges, capped at `maxSide`. */
export function quadSize(q: Pt[], maxSide = 1800) {
  const w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** Straightens the page inside `quad` (tl, tr, br, bl in source pixels) into a width×height rectangle. */
export function warp(src: HTMLCanvasElement, quad: Pt[], width: number, height: number): HTMLCanvasElement {
  const sw = src.width;
  const sh = src.height;
  const s = ctx2d(src).getImageData(0, 0, sw, sh).data;
  const out = canvasOf(width, height);
  const og = ctx2d(out);
  const img = og.createImageData(out.width, out.height);
  const o = img.data;
  const map = squareToQuad(quad);
  for (let y = 0; y < out.height; y++) {
    const v = (y + 0.5) / out.height;
    for (let x = 0; x < out.width; x++) {
      const p = map((x + 0.5) / out.width, v);
      const fx = Math.min(sw - 1.001, Math.max(0, p.x - 0.5));
      const fy = Math.min(sh - 1.001, Math.max(0, p.y - 0.5));
      const x0 = fx | 0;
      const y0 = fy | 0;
      const tx = fx - x0;
      const ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const k = (y * out.width + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = s[i00 + ch] + (s[i10 + ch] - s[i00 + ch]) * tx;
        const bot = s[i01 + ch] + (s[i11 + ch] - s[i01 + ch]) * tx;
        o[k + ch] = top + (bot - top) * ty;
      }
      o[k + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

function maxFilter(a: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(a.length);
  const out = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, a[y * w + k]);
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x]);
      out[y * w + x] = m;
    }
  }
  return out;
}

function boxBlur(a: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(a.length);
  const out = new Float32Array(a.length);
  const pass = (src: Float32Array, dst: Float32Array, len: number, lines: number, step: number, lineStep: number) => {
    for (let l = 0; l < lines; l++) {
      const base = l * lineStep;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[base + Math.min(len - 1, Math.max(0, k)) * step];
      for (let i = 0; i < len; i++) {
        dst[base + i * step] = sum / (2 * r + 1);
        sum += src[base + Math.min(len - 1, i + r + 1) * step] - src[base + Math.max(0, i - r) * step];
      }
    }
  };
  pass(a, tmp, w, h, 1, w);
  pass(tmp, out, h, w, w, 1);
  return out;
}

/**
 * Cleans a straightened page: estimates the bare paper (strokes removed, lighting smoothed),
 * divides it out, then sets levels. `strength` deepens the graphite (1 = gentle, 1.8 = bold).
 */
export function cleanPage(src: HTMLCanvasElement, strength = 1.25): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const data = ctx2d(src).getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;

  // The paper estimate is computed at ~600px, like the reference script, then scaled back up.
  const s = Math.min(1, 600 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * s));
  const sh = Math.max(1, Math.round(h * s));
  const small = canvasOf(sw, sh);
  ctx2d(small).drawImage(src, 0, 0, sw, sh);
  const sd = ctx2d(small).getImageData(0, 0, sw, sh).data;
  let paper = new Float32Array(sw * sh);
  for (let i = 0; i < paper.length; i++) paper[i] = (sd[i * 4] * 0.299 + sd[i * 4 + 1] * 0.587 + sd[i * 4 + 2] * 0.114) / 255;
  paper = maxFilter(paper, sw, sh, 7);
  for (let i = 0; i < 3; i++) paper = boxBlur(paper, sw, sh, 10); // three box blurs ≈ a Gaussian, sigma ≈ 18

  const n = new Float32Array(w * h);
  const hist = new Uint32Array(1024);
  for (let y = 0; y < h; y++) {
    const py = Math.min(sh - 1.001, Math.max(0, (y + 0.5) * s - 0.5));
    const y0 = py | 0;
    const ty = py - y0;
    for (let x = 0; x < w; x++) {
      const px = Math.min(sw - 1.001, Math.max(0, (x + 0.5) * s - 0.5));
      const x0 = px | 0;
      const tx = px - x0;
      const i = y0 * sw + x0;
      const top = paper[i] + (paper[i + 1] - paper[i]) * tx;
      const bot = paper[i + sw] + (paper[i + sw + 1] - paper[i + sw]) * tx;
      const bg = Math.max(1 / 255, top + (bot - top) * ty);
      const v = Math.min(1, gray[y * w + x] / bg);
      n[y * w + x] = v;
      hist[Math.min(1023, (v * 1023) | 0)]++;
    }
  }
  // Black point: the 0.7th percentile (never above 0.55), like the reference.
  let count = 0;
  let lo = 0;
  const target = n.length * 0.007;
  for (let b = 0; b < 1024; b++) {
    count += hist[b];
    if (count >= target) {
      lo = Math.min(0.55, b / 1023);
      break;
    }
  }
  const hi = 0.93;
  const out = canvasOf(w, h);
  const og = ctx2d(out);
  const img = og.createImageData(w, h);
  for (let i = 0; i < n.length; i++) {
    const v = Math.round(Math.pow(Math.min(1, Math.max(0, (n[i] - lo) / (hi - lo))), strength) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Crops a box (fractions of the image) widened to `aspect` (w/h), resized to outW. */
export function cropBox(src: HTMLCanvasElement, box: Box, aspect: number, outW: number, grow = 1): HTMLCanvasElement {
  let w = box.w * src.width * grow;
  let h = box.h * src.height * grow;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, src.width);
  h = Math.min(h, src.height);
  const cx = (box.x + box.w / 2) * src.width;
  const cy = (box.y + box.h / 2) * src.height;
  const x = Math.min(src.width - w, Math.max(0, cx - w / 2));
  const y = Math.min(src.height - h, Math.max(0, cy - h / 2));
  const out = canvasOf(outW, outW / aspect);
  const g = ctx2d(out);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(src, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}

export function resizeTo(src: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  if (src.width === width && src.height === height) return src;
  const out = canvasOf(width, height);
  ctx2d(out).drawImage(src, 0, 0, width, height);
  return out;
}

export const toJpeg = (c: HTMLCanvasElement, quality = 0.88) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality));
