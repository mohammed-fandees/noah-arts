-- Starter content built from the first pages Noah shared.
-- Text in [brackets] is a placeholder for her own words; she replaces it from the dashboard.

INSERT INTO settings (key, value) VALUES
  ('hero_kicker', 'My sketchbook · pencil on notebook paper'),
  ('hero_tagline', 'This is my sketchbook — and the story behind every page of it. Come in, it’s still being drawn.'),
  ('hero_image_key', 'hero-me.jpg'),
  ('hero_image_width', '330'),
  ('hero_image_height', '359'),
  ('hero_image_alt', 'Noah’s pencil self-portrait, labelled “Me” in her notebook'),
  ('hero_caption', 'that’s me ☺'),
  ('story_title', 'A life, drawn one line at a time.'),
  ('story_intro', '[A short intro in her own words — who she is, before you meet her drawings.]'),
  ('gallery_title', 'Every page, newest first.'),
  ('cast_title', 'Everyone I’ve drawn, by name.'),
  ('cast_intro', 'She names the faces on her pages; the site gathers them here. Tap someone to meet them on the page.'),
  ('process_title', 'From line to light.'),
  ('process_text', '[In her words: the guide line down the middle of the face first, then the eyes, then the hair — and the shading last.]'),
  ('process_drawing', 'glasses'),
  ('closing_title', 'The next page is still blank.'),
  ('closing_text', 'Every new drawing lands here first — the sketchbook grows whenever I finish one.'),
  ('instagram_url', ''),
  ('instagram_handle', '');

INSERT INTO drawings (id, slug, title, shelf, page_date, quote, story, image_key, width, height, alt, animation, is_new, notebook_order, published_at) VALUES
  (1, 'n-er-dy', 'N · Er · Dy', 'Doodles', NULL, NULL, NULL, 'nerdy.jpg', 609, 650,
     'A sulking chibi character beside the element tiles N, Er and Dy — “nerdy” — with a POW! burst', 'hatch', 0, 1, '2026-10-14 12:00:00'),
  (2, 'october-19', 'October 19', 'Full pages', 'October 19', NULL, '[The story behind this page, in her words.]', 'october-19.jpg', 565, 763,
     'A notebook page dated October 19 with four portraits: Vadim, Anshika, Robert and Lex', 'lines', 0, 2, '2026-10-15 12:00:00'),
  (3, 'aiko-keynes-me', 'Aiko, Keynes & me', 'Full pages', '14·7·26', NULL, NULL, 'aiko-keynes-me.jpg', 605, 697,
     'A notebook page of portraits: Aiko, John Maynard Keynes, a boy labelled CLO and a self-portrait labelled Me', 'lines', 0, 3, '2026-10-16 12:00:00'),
  (4, 'glasses', 'Untitled (glasses)', 'Portraits', NULL, NULL, NULL, 'glasses.jpg', 509, 556,
     'A pencil portrait of a boy with glasses, messy hair and a checked shirt', 'lines', 0, 4, '2026-10-17 12:00:00'),
  (5, 'john-denver', 'John Denver', 'Portraits', NULL, NULL, NULL, 'john-denver.jpg', 829, 600,
     'Two pencil portraits with glasses on a ruled page, one labelled John Denver, the other surprised (!!)', 'lines', 1, 5, '2026-10-18 12:00:00');

INSERT INTO chapters (id, position, kicker, title, body, margin_note, sticky_note) VALUES
  (1, 1, 'chapter one · [year]', 'The first pencil',
     '[In her words: the first thing she remembers drawing, who handed her the pencil, and why she never put it down.]', NULL, NULL),
  (2, 2, 'chapter two · [year]', 'Learning faces',
     '[The guide lines down the middle of every face, the pages filled with practice — and the moment the faces started looking back.]',
     '↳ [a little note in the margin]', NULL),
  (3, 3, 'chapter three · [year]', 'Everyone ends up in my notebook',
     '[Friends, characters, an economist from a textbook — and, sometimes, herself.]', NULL,
     '“[a line she wrote about drawing people]”'),
  (4, 4, 'chapter four · now', 'Lately',
     '[What she’s drawing these days, what she’s trying to get better at, and what’s next.]', NULL, NULL);

INSERT INTO chapter_drawings (chapter_id, drawing_id, position, caption) VALUES
  (1, 1, 1, 'N · Er · Dy = nerdy'),
  (2, 2, 1, 'October 19 — four faces, one page'),
  (3, 3, 1, 'Aiko, Keynes & me — 14·7·26'),
  (4, 5, 1, 'John Denver, and someone surprised !!'),
  (4, 4, 2, 'glasses again');

INSERT INTO people (id, slug, name, face_key, position) VALUES
  (1, 'me', 'Me', 'face-me.jpg', 1),
  (2, 'vadim', 'Vadim', 'face-vadim.jpg', 2),
  (3, 'anshika', 'Anshika', 'face-anshika.jpg', 3),
  (4, 'robert', 'Robert', 'face-robert.jpg', 4),
  (5, 'lex', 'Lex', 'face-lex.jpg', 5),
  (6, 'aiko', 'Aiko', 'face-aiko.jpg', 6),
  (7, 'keynes', 'John Maynard Keynes', 'face-keynes.jpg', 7),
  (8, 'john-denver', 'John Denver', 'face-johndenver.jpg', 8);

INSERT INTO faces (drawing_id, person_id, x, y, w, h) VALUES
  (2, 2, 0.106, 0.033, 0.407, 0.341),
  (2, 3, 0.566, 0.098, 0.425, 0.367),
  (2, 4, 0.088, 0.439, 0.425, 0.406),
  (2, 5, 0.566, 0.465, 0.425, 0.459),
  (3, 6, 0.033, 0.000, 0.430, 0.459),
  (3, 7, 0.545, 0.086, 0.397, 0.430),
  (3, 1, 0.421, 0.473, 0.463, 0.502),
  (5, 8, 0.024, 0.000, 0.362, 0.625);
