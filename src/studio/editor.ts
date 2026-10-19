import { canvasOf, cleanPage, cropBox, loadFile, loadUrl, quadSize, resizeTo, rotate, toJpeg, warp, type Box, type Pt } from './image';

interface EditorData {
  drawing: null | {
    id: number;
    imageUrl: string;
    faces: { name: string; x: number; y: number; w: number; h: number }[];
  };
  people: string[];
}

interface Face extends Box {
  name: string;
}

const $ = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);

/** The "Add a drawing" editor: photo → straighten → clean → name faces → publish. */
export function initEditor(form: HTMLFormElement) {
  const data: EditorData = JSON.parse(document.getElementById('editor-data')?.textContent || '{}');
  const existing = data.drawing;
  const known = new Set(data.people.map((n) => n.toLowerCase()));

  const photoInput = $<HTMLInputElement>(form, '[data-photo-input]')!;
  const drop = $<HTMLElement>(form, '[data-drop]')!;
  const cropBoxEl = $<HTMLElement>(form, '[data-crop]')!;
  const cropCanvas = $<HTMLCanvasElement>(form, '[data-crop-canvas]')!;
  const cleanStep = $<HTMLElement>(form, '[data-clean-step]')!;
  const compare = $<HTMLElement>(form, '[data-compare]')!;
  const cleanToggle = $<HTMLInputElement>(form, '[data-clean-toggle]')!;
  const strength = $<HTMLInputElement>(form, '[data-strength]')!;
  const facesStage = $<HTMLElement>(form, '[data-faces-stage]')!;
  const faceList = $<HTMLOListElement>(form, '[data-face-list]')!;
  const heroSet = $<HTMLFieldSetElement>(form, '[data-hero]')!;
  const status = $<HTMLElement>(form, '[data-status]')!;
  const submit = $<HTMLButtonElement>(form, '[data-submit]')!;

  let source: HTMLCanvasElement | null = null; // the photo, rotated
  let rotation = 0;
  let corners: Pt[] = [];
  let straight: HTMLCanvasElement | null = null; // straightened, before clean-up
  let result: HTMLCanvasElement | null = null; // what gets published
  let base: HTMLCanvasElement | null = null; // the current picture of an existing drawing
  let faces: Face[] = existing ? existing.faces.map((f) => ({ ...f })) : [];

  const say = (msg: string, isError = false) => {
    status.textContent = msg;
    status.classList.toggle('is-error', isError);
  };
  const picture = () => result ?? base;

  // ---------- 1. Photo + corners ----------

  const resetCorners = () => {
    if (!source) return;
    const m = Math.round(Math.min(source.width, source.height) * 0.02);
    corners = [
      { x: m, y: m },
      { x: source.width - m, y: m },
      { x: source.width - m, y: source.height - m },
      { x: m, y: source.height - m }
    ];
  };

  let scale = 1; // display px per source px
  const drawCrop = () => {
    if (!source) return;
    const maxW = Math.min(760, cropBoxEl.clientWidth || 760);
    const maxH = window.innerHeight * 0.7;
    scale = Math.min(maxW / source.width, maxH / source.height);
    const dpr = window.devicePixelRatio || 1;
    cropCanvas.style.width = `${source.width * scale}px`;
    cropCanvas.style.height = `${source.height * scale}px`;
    cropCanvas.width = Math.round(source.width * scale * dpr);
    cropCanvas.height = Math.round(source.height * scale * dpr);
    const g = cropCanvas.getContext('2d')!;
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    g.drawImage(source, 0, 0);
    g.beginPath();
    g.rect(0, 0, source.width, source.height);
    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 3; i >= 0; i--) g.lineTo(corners[i].x, corners[i].y);
    g.closePath();
    g.fillStyle = 'rgba(31,31,30,0.55)';
    g.fill('evenodd');
    g.lineWidth = 2 / scale;
    g.strokeStyle = '#F2B81C';
    g.beginPath();
    corners.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.stroke();
    for (const p of corners) {
      g.beginPath();
      g.arc(p.x, p.y, 11 / scale, 0, Math.PI * 2);
      g.fillStyle = '#F2B81C';
      g.fill();
      g.lineWidth = 2 / scale;
      g.strokeStyle = '#1F1F1E';
      g.stroke();
    }
  };

  let dragging = -1;
  const toSource = (e: PointerEvent): Pt => {
    const r = cropCanvas.getBoundingClientRect();
    return {
      x: Math.min(source!.width, Math.max(0, (e.clientX - r.left) / scale)),
      y: Math.min(source!.height, Math.max(0, (e.clientY - r.top) / scale))
    };
  };
  cropCanvas.addEventListener('pointerdown', (e) => {
    if (!source) return;
    const p = toSource(e);
    let best = -1;
    let bestD = 36 / scale;
    corners.forEach((c, i) => {
      const dd = Math.hypot(c.x - p.x, c.y - p.y);
      if (dd < bestD) {
        best = i;
        bestD = dd;
      }
    });
    if (best >= 0) {
      dragging = best;
      cropCanvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  cropCanvas.addEventListener('pointermove', (e) => {
    if (dragging < 0) return;
    corners[dragging] = toSource(e);
    drawCrop();
  });
  cropCanvas.addEventListener('pointerup', () => {
    if (dragging < 0) return;
    dragging = -1;
    schedule();
  });

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    say('Cleaning up the page…');
    timer = window.setTimeout(processPhoto, 30);
  };

  const processPhoto = () => {
    if (!source) return;
    const size = quadSize(corners);
    straight = warp(source, corners, size.width, size.height);
    result = cleanToggle.checked ? cleanPage(straight, Number(strength.value) / 100) : straight;
    renderCompare();
    renderFaces();
    say('');
  };

  const usePhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) return say('That file is not an image.', true);
    say('Opening the photo…');
    try {
      source = await loadFile(file);
    } catch {
      return say('This photo could not be opened. Try a JPEG or PNG.', true);
    }
    rotation = 0;
    resetCorners();
    cropBoxEl.hidden = false;
    cleanStep.hidden = false;
    drawCrop();
    processPhoto();
  };

  photoInput.addEventListener('change', () => photoInput.files?.[0] && usePhoto(photoInput.files[0]));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) void usePhoto(file);
  });
  form.querySelectorAll<HTMLButtonElement>('[data-rotate]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!source) return;
      const dir = Number(b.dataset.rotate) as 1 | -1;
      source = rotate(source, dir);
      rotation = (rotation + dir + 4) % 4;
      resetCorners();
      drawCrop();
      schedule();
    })
  );
  $<HTMLButtonElement>(form, '[data-reset-corners]')?.addEventListener('click', () => {
    if (!source) return;
    corners = [
      { x: 0, y: 0 },
      { x: source.width, y: 0 },
      { x: source.width, y: source.height },
      { x: 0, y: source.height }
    ];
    drawCrop();
    schedule();
  });
  window.addEventListener('resize', drawCrop);

  // ---------- 2. Clean-up compare ----------

  cleanToggle.addEventListener('change', schedule);
  strength.addEventListener('change', schedule);

  const renderCompare = () => {
    if (!straight || !result) return;
    const before = canvasOf(straight.width, straight.height);
    before.getContext('2d')!.drawImage(straight, 0, 0);
    const after = canvasOf(result.width, result.height);
    after.getContext('2d')!.drawImage(result, 0, 0);
    before.className = 'cmp-before';
    after.className = 'cmp-after';
    const handle = document.createElement('span');
    handle.className = 'cmp-handle';
    const labels = document.createElement('span');
    labels.className = 'cmp-labels';
    labels.innerHTML = '<span>your photo</span><span>cleaned</span>';
    compare.replaceChildren(before, after, handle, labels);
    compare.style.setProperty('--split', '50%');
  };
  compare.addEventListener('pointermove', (e) => {
    const r = compare.getBoundingClientRect();
    compare.style.setProperty('--split', `${Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))}%`);
  });

  // ---------- 3. Faces ----------

  let draft: { x0: number; y0: number; el: HTMLElement } | null = null;

  const renderFaces = () => {
    const pic = picture();
    if (!pic) return;
    $<HTMLElement>(facesStage, '[data-faces-placeholder]')?.remove();
    let view = $<HTMLCanvasElement>(facesStage, 'canvas');
    if (!view) {
      view = document.createElement('canvas');
      facesStage.prepend(view);
    }
    view.width = pic.width;
    view.height = pic.height;
    view.getContext('2d')!.drawImage(pic, 0, 0);
    facesStage.querySelectorAll('.box').forEach((b) => b.remove());
    faces.forEach((f, i) => {
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'box';
      Object.assign(box.style, { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` });
      box.innerHTML = '<span></span>';
      box.firstElementChild!.textContent = f.name || `face ${i + 1}`;
      box.setAttribute('aria-label', `Face ${i + 1}: ${f.name || 'unnamed'}`);
      box.addEventListener('click', () => faceList.querySelectorAll('input')[i]?.focus());
      facesStage.appendChild(box);
    });
    renderFaceList();
    renderHeroChoices();
  };

  const renderFaceList = () => {
    faceList.replaceChildren(
      ...faces.map((f, i) => {
        const li = document.createElement('li');
        const input = document.createElement('input');
        input.value = f.name;
        input.placeholder = 'who is this?';
        input.setAttribute('list', 'people-list');
        input.setAttribute('aria-label', `Name of face ${i + 1}`);
        input.maxLength = 60;
        input.addEventListener('input', () => {
          f.name = input.value.trim();
          const label = facesStage.querySelectorAll('.box span')[i];
          if (label) label.textContent = f.name || `face ${i + 1}`;
          renderHeroChoices();
        });
        const tag = document.createElement('span');
        tag.className = 'tag';
        const updateTag = () => (tag.textContent = f.name && !known.has(f.name.toLowerCase()) ? 'new to the cast' : '');
        input.addEventListener('input', updateTag);
        updateTag();
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'link danger';
        remove.textContent = 'remove';
        remove.addEventListener('click', () => {
          faces.splice(i, 1);
          renderFaces();
        });
        li.append(input, tag, remove);
        return li;
      })
    );
  };

  const stagePoint = (e: PointerEvent) => {
    const r = facesStage.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  facesStage.addEventListener('pointerdown', (e) => {
    if (!picture() || (e.target as Element).closest('.box')) return;
    const p = stagePoint(e);
    const el = document.createElement('div');
    el.className = 'box is-draft';
    facesStage.appendChild(el);
    draft = { x0: p.x, y0: p.y, el };
    facesStage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  facesStage.addEventListener('pointermove', (e) => {
    if (!draft) return;
    const p = stagePoint(e);
    Object.assign(draft.el.style, {
      left: `${Math.min(p.x, draft.x0) * 100}%`,
      top: `${Math.min(p.y, draft.y0) * 100}%`,
      width: `${Math.abs(p.x - draft.x0) * 100}%`,
      height: `${Math.abs(p.y - draft.y0) * 100}%`
    });
  });
  facesStage.addEventListener('pointerup', (e) => {
    if (!draft) return;
    const p = stagePoint(e);
    const box = { x: Math.min(p.x, draft.x0), y: Math.min(p.y, draft.y0), w: Math.abs(p.x - draft.x0), h: Math.abs(p.y - draft.y0) };
    draft.el.remove();
    draft = null;
    if (box.w > 0.03 && box.h > 0.03) {
      faces.push({ name: '', ...box });
      renderFaces();
      const inputs = faceList.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    }
  });

  // ---------- 6. Hero choices ----------

  const renderHeroChoices = () => {
    const current = (form.elements.namedItem('hero') as RadioNodeList | null)?.value ?? '';
    heroSet.querySelectorAll('[data-face-hero]').forEach((n) => n.remove());
    faces.forEach((f, i) => {
      const label = document.createElement('label');
      label.className = 'check';
      label.dataset.faceHero = '';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'hero';
      input.value = `face-${i}`;
      input.checked = current === input.value;
      label.append(input, ` Yes — just ${f.name || `face ${i + 1}`}`);
      heroSet.appendChild(label);
    });
  };

  // ---------- Publish ----------

  const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = field('title');
    const alt = field('alt');
    if (!existing && !result) return say('Choose a photo of the drawing first.', true);
    if (!title) return say('Give it a title.', true);
    if (!field('shelf')) return say('Choose a shelf (e.g. Portraits).', true);
    if (!alt) return say('Describe the drawing in a sentence — it’s what screen readers say.', true);
    const unnamed = faces.findIndex((f) => !f.name);
    if (unnamed >= 0) return say(`Face ${unnamed + 1} needs a name (or remove it).`, true);

    submit.disabled = true;
    say('Preparing the pictures…');
    try {
      const fd = new FormData();
      let pic = picture();
      if (!pic && existing) pic = base = await loadUrl(existing.imageUrl);
      if (result) fd.append('image', await toJpeg(result), 'drawing.jpg');

      // A face picture for everyone new to the cast.
      const seen = new Set<string>();
      const faceMeta = [];
      for (const [i, f] of faces.entries()) {
        const key = f.name.toLowerCase();
        let crop: string | undefined;
        if (!known.has(key) && !seen.has(key) && pic) {
          crop = `face-${i}`;
          fd.append(crop, await toJpeg(cropBox(pic, f, 0.8, 320)), `${crop}.jpg`);
        }
        seen.add(key);
        faceMeta.push({ name: f.name, x: f.x, y: f.y, w: f.w, h: f.h, crop });
      }

      // Stage photos: straightened with the same corners when framed like the main photo.
      const stageFiles = Array.from(form.querySelector<HTMLInputElement>('[data-stages]')?.files ?? []);
      let stages: 'keep' | 'replace' | 'remove' = form.querySelector<HTMLInputElement>('[data-remove-stages]')?.checked ? 'remove' : 'keep';
      if (stageFiles.length && pic) {
        stages = 'replace';
        for (const [i, file] of stageFiles.slice(0, 12).entries()) {
          say(`Cleaning stage photo ${i + 1} of ${stageFiles.length}…`);
          let c = await loadFile(file);
          for (let r = 0; r < rotation; r++) c = rotate(c, 1);
          let quad = [{ x: 0, y: 0 }, { x: c.width, y: 0 }, { x: c.width, y: c.height }, { x: 0, y: c.height }];
          if (source && Math.abs(c.width / c.height - source.width / source.height) < 0.03) {
            const k = c.width / source.width;
            quad = corners.map((p) => ({ x: p.x * k, y: p.y * k }));
          }
          const size = quadSize(quad);
          let stage = warp(c, quad, size.width, size.height);
          if (cleanToggle.checked) stage = cleanPage(stage, Number(strength.value) / 100);
          fd.append(`stage-${i}`, await toJpeg(resizeTo(stage, pic.width, pic.height)), `stage-${i}.jpg`);
        }
      }
      const video = form.querySelector<HTMLInputElement>('[data-timelapse]')?.files?.[0];
      if (video) fd.append('timelapse', video, video.name);

      // Home page picture.
      const heroChoice = (form.elements.namedItem('hero') as RadioNodeList).value;
      let hero: { width: number; height: number } | null = null;
      if (heroChoice && pic) {
        const faceIndex = heroChoice.startsWith('face-') ? Number(heroChoice.slice(5)) : -1;
        const crop =
          faceIndex >= 0
            ? cropBox(pic, faces[faceIndex], 0.92, 660, 1.35)
            : cropBox(pic, { x: 0, y: 0, w: 1, h: 1 }, pic.width / pic.height, Math.min(900, pic.width));
        hero = { width: crop.width, height: crop.height };
        fd.append('hero', await toJpeg(crop), 'hero.jpg');
      }

      const chapter = field('chapter_id');
      fd.append(
        'meta',
        JSON.stringify({
          title,
          shelf: field('shelf'),
          pageDate: field('page_date'),
          quote: field('quote'),
          story: field('story'),
          alt,
          animation: (form.elements.namedItem('animation') as RadioNodeList).value,
          isNew: (form.elements.namedItem('is_new') as HTMLInputElement).checked,
          width: result?.width,
          height: result?.height,
          chapterId: chapter ? Number(chapter) : null,
          chapterCaption: field('chapter_caption'),
          faces: faceMeta,
          stages,
          stageCount: stageFiles.length,
          hero,
          removeTimelapse: form.querySelector<HTMLInputElement>('[data-remove-timelapse]')?.checked ?? false
        })
      );

      say('Publishing…');
      const res = await fetch(existing ? `/studio/api/drawings/${existing.id}` : '/studio/api/drawings', { method: 'POST', body: fd });
      const body = (await res.json().catch(() => ({ ok: false, error: `The server answered ${res.status}.` }))) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error || 'Saving failed.');
      window.location.href = `/studio/drawings?saved=${encodeURIComponent(title)}`;
    } catch (err) {
      say(err instanceof Error ? err.message : 'Saving failed.', true);
      submit.disabled = false;
    }
  });

  // Existing drawing: show its current picture for the faces step.
  if (existing) {
    loadUrl(existing.imageUrl)
      .then((c) => {
        base = c;
        if (!result) renderFaces();
      })
      .catch(() => say('Could not load the current picture.', true));
  }
}
