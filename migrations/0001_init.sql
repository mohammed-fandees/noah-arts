-- The sketchbook's content. Everything here is edited from Noah's dashboard (next step).

-- Free-form text blocks used around the site (hero tagline, intros, links…).
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Chapters of her story, shown in order along the story line.
CREATE TABLE chapters (
  id            INTEGER PRIMARY KEY,
  position      INTEGER NOT NULL,
  kicker        TEXT NOT NULL,          -- e.g. "chapter one · 2019"
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  margin_note   TEXT,
  sticky_note   TEXT,
  photo_key     TEXT,                   -- optional personal photo in R2
  photo_caption TEXT
);

-- One uploaded drawing (a cleaned photo of a notebook page or a single sketch).
CREATE TABLE drawings (
  id             INTEGER PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  shelf          TEXT NOT NULL,         -- gallery filter: "Portraits", "Full pages", "Doodles"…
  page_date      TEXT,                  -- the date as written on the page, if any
  quote          TEXT,
  story          TEXT,
  image_key      TEXT NOT NULL,         -- R2 key of the cleaned image
  width          INTEGER NOT NULL,
  height         INTEGER NOT NULL,
  alt            TEXT NOT NULL,
  animation      TEXT NOT NULL DEFAULT 'lines' CHECK (animation IN ('lines', 'hatch')),
  timelapse_key  TEXT,                  -- optional time-lapse video in R2
  is_new         INTEGER NOT NULL DEFAULT 0,
  notebook_order INTEGER NOT NULL DEFAULT 0,
  published_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX drawings_published ON drawings (published_at DESC);

-- Real process photos for a drawing, in order. When present they replace the automatic reveal.
CREATE TABLE stages (
  id         INTEGER PRIMARY KEY,
  drawing_id INTEGER NOT NULL REFERENCES drawings (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  image_key  TEXT NOT NULL
);

-- Drawings shown inside a chapter.
CREATE TABLE chapter_drawings (
  chapter_id INTEGER NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  drawing_id INTEGER NOT NULL REFERENCES drawings (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  caption    TEXT,
  PRIMARY KEY (chapter_id, drawing_id)
);

-- "The cast": everyone she has named on her pages.
CREATE TABLE people (
  id       INTEGER PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  note     TEXT,
  face_key TEXT NOT NULL,               -- R2 key of the cropped face (4:5)
  position INTEGER NOT NULL DEFAULT 0
);

-- A named face on a drawing. Box coordinates are fractions (0–1) of the image size.
CREATE TABLE faces (
  id         INTEGER PRIMARY KEY,
  drawing_id INTEGER NOT NULL REFERENCES drawings (id) ON DELETE CASCADE,
  person_id  INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL
);
CREATE INDEX faces_drawing ON faces (drawing_id);
CREATE INDEX faces_person ON faces (person_id);
