import type { Child } from 'hono/jsx';
import { SharedDefs } from './parts';

interface LayoutProps {
  title: string;
  description?: string;
  page: 'home' | 'drawing' | 'notebook' | 'missing';
  ogImage?: string;
  children: Child;
}

export const Layout = ({ title, description, page, ogImage, children }: LayoutProps) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta name="theme-color" content="#F2F1EC" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&family=Reenie+Beanie&display=swap"
      />
      <link rel="stylesheet" href="/assets/styles.css" />
      <script type="module" src="/assets/app.js"></script>
    </head>
    <body class={`page-${page}`}>
      <a class="skip" href="#main">Skip to content</a>
      <SharedDefs />
      <div class="grain" aria-hidden="true"></div>
      {children}
    </body>
  </html>
);

export const SiteHeader = ({ home = true }: { home?: boolean }) => {
  const at = (hash: string) => (home ? hash : `/${hash}`);
  return (
    <header class="site-header">
      <div class="wrap header-row">
        <a class="logo" href={home ? '#top' : '/'} aria-label="Noah — home">
          <span class="logo-name">noah</span>
          <span class="logo-tag">ARTS</span>
        </a>
        <nav class="main-nav" aria-label="Main">
          <a href={at('#story')}>My story</a>
          <a href={at('#sketchbook')}>Sketchbook</a>
          <a href={at('#cast')}>The cast</a>
          <a href={at('#process')}>How I draw</a>
          <button type="button" class="pill sound-toggle" data-sound-toggle aria-pressed="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 10v4h4l5 4V6L8 10z" />
              <path d="M16 9c1.5 1.5 1.5 4.5 0 6" />
              <path class="wave" d="M19 6c3 3 3 9 0 12" />
            </svg>
            <span data-sound-label>sounds off</span>
          </button>
        </nav>
      </div>
      <div class="wrap progress-row" aria-hidden="true">
        <div class="pencil-progress" data-progress>
          <span class="pp-eraser"></span>
          <span class="pp-ferrule"></span>
          <span class="pp-body"></span>
          <svg width="26" height="12" viewBox="0 0 26 12">
            <polygon points="0,0 18,4.5 18,7.5 0,12" fill="#E8CFA4" />
            <polygon points="18,4.5 26,6 18,7.5" fill="#1F1F1E" />
          </svg>
        </div>
        <span class="progress-label">SCROLL · SHARPEN</span>
      </div>
    </header>
  );
};

export const SiteFooter = () => (
  <footer class="site-footer">
    <div class="wrap footer-row">
      <span>© {new Date().getFullYear()} Noah · Every line drawn by hand.</span>
      <a href="#top" class="to-top">
        <svg width="30" height="22" viewBox="0 0 30 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6 h18 l6 5 l-6 5 h-18 z" />
          <circle cx="12" cy="11" r="3" />
        </svg>
        Sharpen &amp; back to top
      </a>
    </div>
  </footer>
);
