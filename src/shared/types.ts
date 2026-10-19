export interface Face {
  personSlug: string;
  personName: string;
  /** Box as fractions (0–1) of the drawing's width/height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Drawing {
  id: number;
  slug: string;
  title: string;
  shelf: string;
  pageDate: string | null;
  quote: string | null;
  story: string | null;
  imageKey: string;
  width: number;
  height: number;
  alt: string;
  animation: 'lines' | 'hatch';
  timelapseKey: string | null;
  isNew: boolean;
  notebookOrder: number;
  faces: Face[];
  stages: string[];
}

export interface ChapterDrawing {
  drawing: Drawing;
  caption: string | null;
}

export interface Chapter {
  id: number;
  position: number;
  kicker: string;
  title: string;
  body: string;
  marginNote: string | null;
  stickyNote: string | null;
  photoKey: string | null;
  photoCaption: string | null;
  drawings: ChapterDrawing[];
}

export interface Person {
  slug: string;
  name: string;
  note: string | null;
  faceKey: string;
  /** Drawings this person appears on, newest first. */
  drawings: { slug: string; title: string }[];
}

export type Settings = Record<string, string>;

export interface Site {
  settings: Settings;
  /** Newest first. */
  drawings: Drawing[];
  chapters: Chapter[];
  people: Person[];
}
