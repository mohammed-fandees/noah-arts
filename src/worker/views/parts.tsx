import { raw } from 'hono/html';

export const media = (key: string) => `/media/${encodeURIComponent(key)}`;

/** A wide image (landscape) gets two gallery columns. */
export const isWide = (w: number, h: number) => w > h * 1.15;

/**
 * The zig-zag "shading" stroke the hero pencil follows: diagonal passes 44px apart
 * that overshoot the box so a 96px-wide stroke covers every pixel.
 */
export function hatchPath(w: number, h: number) {
  const left = -20;
  const right = w + 80;
  const points: string[] = [];
  let y = 0;
  let i = 0;
  while (y <= h + 88) {
    points.push(`${i % 2 === 0 ? left : right} ${y}`);
    y += 44;
    i += 1;
  }
  const length = Math.ceil((points.length - 1) * Math.hypot(right - left, 44)) + 10;
  return { d: `M${points.join(' L')}`, length };
}

/** Embeds data for the client script. `<` is escaped so the JSON can't close the tag. */
export const JsonData = ({ id, data }: { id: string; data: unknown }) => (
  <script type="application/json" id={id}>
    {raw(JSON.stringify(data).replace(/</g, '\\u003c'))}
  </script>
);

export const Tape = ({ tilt = -3, className = '' }: { tilt?: number; className?: string }) => (
  <span class={`tape ${className}`} aria-hidden="true" style={`--tilt:${tilt}deg`}></span>
);

/** The yellow HB pencil, pointing left, 170×22. */
export const Pencil = () => (
  <svg class="pencil" width="170" height="22" viewBox="0 0 170 22" aria-hidden="true">
    <polygon points="0,11 9,8 9,14" fill="#1F1F1E" />
    <polygon points="9,8 30,1 30,21 9,14" fill="#E8CFA4" />
    <rect x="30" y="1" width="104" height="20" fill="var(--pencil)" />
    <rect x="30" y="7.5" width="104" height="1.2" fill="rgba(0,0,0,.13)" />
    <rect x="30" y="13.5" width="104" height="1.2" fill="rgba(0,0,0,.13)" />
    <rect x="134" y="0" width="14" height="22" fill="#B9B8B2" />
    <rect x="148" y="0" width="20" height="22" rx="5" fill="#E7A3A0" />
  </svg>
);

/** The same pencil standing up, tip down, 22×170. */
export const PencilDown = () => (
  <svg width="22" height="170" viewBox="0 0 22 170" aria-hidden="true">
    <rect x="0" y="0" width="22" height="20" rx="5" fill="#E7A3A0" />
    <rect x="0" y="20" width="22" height="14" fill="#B9B8B2" />
    <rect x="1" y="34" width="20" height="104" fill="var(--pencil)" />
    <rect x="7" y="34" width="1.2" height="104" fill="rgba(0,0,0,.13)" />
    <rect x="13.8" y="34" width="1.2" height="104" fill="rgba(0,0,0,.13)" />
    <polygon points="1,138 21,138 14,161 8,161" fill="#E8CFA4" />
    <polygon points="8,161 14,161 11,170" fill="#1F1F1E" />
  </svg>
);

export const Arrow = ({ dir = 'right' }: { dir?: 'right' | 'left' | 'down' }) => {
  const d = { right: 'M5 12h14M13 6l6 6-6 6', left: 'M19 12H5M11 6l-6 6 6 6', down: 'M12 5v14M6 13l6 6 6-6' }[dir];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
};

/** Her drawing on the site: white paper melts into the page (multiply). */
export const Art = ({ src, alt, width, height, eager = false, className = 'art' }: {
  src: string; alt: string; width: number; height: number; eager?: boolean; className?: string;
}) => (
  <img class={className} src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" />
);

/** The site's own grain + hatch definitions, used by several sections. */
export const SharedDefs = () => (
  <svg class="defs" aria-hidden="true" width="0" height="0">
    <defs>
      <filter id="pencil-edge" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="2" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="#2B2B29" stroke-width="1.3" />
      </pattern>
    </defs>
  </svg>
);
