// Turns the hand-painted art in art/raw/ into game-ready PNGs in public/assets/game/.
//
//   npm run assets
//
// What it does:
//   1. Removes the plain white background with a flood fill from the image border, so white
//      inside the art (eye highlights, sparkles) is kept. Edge pixels get a soft alpha and are
//      "un-mixed" from white, so there is no white fringe.
//   2. Cuts the treasure and trap sheets into separate images (grid cell, then the item's bounding box).
//   3. Trims empty space, resizes to about 2x the in-game size and saves PNGs.
//   4. Cuts the sack out of each hero image (for the loot-growth overlay) and the tail tip out of the
//      dragon body (for the twitch), and writes the anchor points the game needs to
//      src/generated/artManifest.ts.
//   5. Writes assembled previews to art/preview/ so you can check the cuts and anchor points.
//
// Coordinates in CONFIG below are pixels in the RAW image (before mirroring or resizing).
// Replace an image, adjust its numbers here if needed, and re-run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'art', 'raw');
const OUT = path.join(ROOT, 'public', 'assets', 'game');
const PREVIEW = path.join(ROOT, 'art', 'preview');
const MANIFEST = path.join(ROOT, 'src', 'generated', 'artManifest.ts');

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

const CONFIG = {
  /** Background removal. d = how far a pixel is from pure white (0..255, max channel distance). */
  bg: {
    /** Pixels with d below this are fully transparent. */
    clearBelow: 10,
    /** The flood fill passes through pixels with d below this; they get a soft alpha (glows, smoke, AA edges). */
    passBelow: 120,
    /** Alpha threshold used to find bounding boxes (ignores faint specks). */
    bboxAlpha: 40,
    /** Empty pixels kept around each trimmed item (output px). */
    pad: 2,
  },

  /** Hero: all three directions are scaled to this texture height (2x of ~48 world px). */
  hero: {
    height: 96,
    files: { down: 'hero_down.png', up: 'hero_up.png', right: 'hero_right.png' },
    /**
     * Sack cut-out. seed = a pixel inside the sack, box = [x0, y0, x1, y1] limit,
     * anchor = strap point as a fraction of the sack's bounding box (the sack grows from here).
     */
    sack: {
      right: { seed: [420, 560], box: [250, 280, 565, 800], anchor: [0.8, 0.12] },
      down: { seed: [400, 520], box: [325, 310, 525, 700], anchor: [0.75, 0.12] },
      up: { seed: [620, 760], box: [420, 400, 815, 895], anchor: [0.5, 0.1] },
    },
    /** How far (raw px) the sack mask grows into the dark outline around it. */
    outlineGrow: 12,
  },

  /** Treasure sheet: 2 columns x 2 rows. width = output texture width. */
  treasure: {
    file: 'treasure_sheet.png',
    cols: 2,
    rows: 2,
    items: [
      { name: 'coin', width: 48 },
      { name: 'gem', width: 48 },
      { name: 'chest_closed', width: 104 },
      { name: 'chest_open', width: 104 },
    ],
  },

  /** Trap sheet: 3 columns x 2 rows. box = output texture size (item is fit inside, keeping its shape). */
  traps: {
    file: 'traps_sheet.png',
    cols: 3,
    rows: 2,
    items: [
      { name: 'spikes_up', box: 96 },
      { name: 'spikes_down', box: 96 },
      { name: 'crumble', box: 96 },
      { name: 'pit', box: 96 },
      { name: 'portal', box: 128 },
      { name: 'exit_door', box: 128 },
    ],
  },

  /** Dragon. The raw art faces LEFT; it is mirrored so the head faces RIGHT (the game's art frame). */
  dragon: {
    body: 'dragon_body.png',
    bodyWidth: 360,
    /** Centre of the neck stump on the body (where the head attaches). */
    bodyNeck: [100, 540],
    /** Tail tip cut: pixels of the tail left of cutX (raw) become a separate piece. */
    tail: { seed: [470, 860], box: [300, 748, 700, 990], cutX: 640, overlap: 28 },
    /** All heads share one crop so they stay the same size. width = output texture width. */
    headWidth: 200,
    heads: {
      sleep: {
        file: 'dragon_head_sleep.png',
        neck: [1285, 600],
        eyes: [[720, 520]],
        mouth: [380, 745],
        nostril: [300, 610],
      },
      stir: {
        file: 'dragon_head_stir.png',
        neck: [1290, 690],
        eyes: [[700, 580]],
        mouth: [340, 790],
        nostril: [240, 680],
      },
      roar: {
        file: 'dragon_head_roar.png',
        neck: [1245, 600],
        eyes: [[655, 465], [440, 410]],
        mouth: [380, 700],
        nostril: [290, 490],
      },
    },
  },

  /** Tileable textures: resized only (no background removal, no trim). size = output px. */
  tiles: [
    { file: 'floor.png', name: 'floor_tile', size: 384 },
    { file: 'wall.png', name: 'wall_tile', size: 384 },
  ],

  /** Single images: background removed, trimmed, resized to this width. */
  singles: [{ file: 'logo.png', name: 'logo', width: 600 }],
};

// ---------------------------------------------------------------------------------------------
// Image helpers. An "img" is { data: Uint8ClampedArray (RGBA), w, h }.
// ---------------------------------------------------------------------------------------------

async function load(file) {
  const { data, info } = await sharp(path.join(RAW, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}

function blank(w, h) {
  return { data: new Uint8ClampedArray(w * h * 4), w, h };
}

function hasTransparency(img) {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) return true;
  return false;
}

/** Flood fill from the border through near-white pixels; reached pixels get a soft alpha. */
function removeWhite(img) {
  if (hasTransparency(img)) return img;
  const { data, w, h } = img;
  const { clearBelow, passBelow } = CONFIG.bg;
  const n = w * h;
  const dist = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    dist[p] = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]);
  }
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const push = (p) => {
    if (seen[p] || dist[p] >= passBelow) return;
    seen[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  for (let p = 0; p < n; p++) {
    if (!seen[p]) continue;
    const i = p * 4;
    const t = Math.min(1, Math.max(0, (dist[p] - clearBelow) / (passBelow - clearBelow)));
    const a = t * t * (3 - 2 * t);
    if (a <= 0.004) {
      data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      continue;
    }
    // Un-mix from white: c = a * fg + (1 - a) * 255  ->  fg = (c - (1 - a) * 255) / a
    for (let c = 0; c < 3; c++) data[i + c] = (data[i + c] - (1 - a) * 255) / a;
    data[i + 3] = Math.round(a * 255);
  }
  return img;
}

/** Bounding box of pixels with alpha >= threshold inside [x0,y0,x1,y1). */
function bbox(img, x0 = 0, y0 = 0, x1 = img.w, y1 = img.h, threshold = CONFIG.bg.bboxAlpha) {
  let minX = x1;
  let minY = y1;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (img.data[(y * img.w + x) * 4 + 3] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('empty image region');
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Grows a box by `pad` raw px, clamped to the image. */
function padBox(img, b, pad) {
  const x = Math.max(0, b.x - pad);
  const y = Math.max(0, b.y - pad);
  return { x, y, w: Math.min(img.w, b.x + b.w + pad) - x, h: Math.min(img.h, b.y + b.h + pad) - y };
}

/**
 * Crops `box` from img, optionally mirrors, scales by `scale` and returns the PNG buffer, size,
 * and a function mapping raw points to output pixels.
 */
async function render(img, box, scale, mirror = false) {
  const outW = Math.max(1, Math.round(box.w * scale));
  const outH = Math.max(1, Math.round(box.h * scale));
  let pipe = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), {
    raw: { width: img.w, height: img.h, channels: 4 },
  }).extract({ left: box.x, top: box.y, width: box.w, height: box.h });
  if (mirror) pipe = pipe.flop();
  const raw = await pipe.resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer();
  const sx = outW / box.w;
  const sy = outH / box.h;
  const map = ([x, y]) => ({
    x: round2((mirror ? box.x + box.w - x : x - box.x) * sx),
    y: round2((y - box.y) * sy),
  });
  return { raw, w: outW, h: outH, map };
}

/** Fits an item inside a square box (keeps its shape, centred on a transparent canvas). */
async function renderContain(img, box, size) {
  const scale = Math.min(size / box.w, size / box.h);
  const r = await render(img, box, scale);
  const left = Math.floor((size - r.w) / 2);
  const top = Math.floor((size - r.h) / 2);
  const raw = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: r.raw, raw: { width: r.w, height: r.h, channels: 4 }, left, top }])
    .raw()
    .toBuffer();
  return { raw, w: size, h: size };
}

const outputs = [];

async function save(name, r) {
  const file = `${name}.png`;
  await sharp(r.raw, { raw: { width: r.w, height: r.h, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(OUT, file));
  const bytes = fs.statSync(path.join(OUT, file)).size;
  outputs.push({ name, file, w: r.w, h: r.h, bytes });
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function lum(data, i) {
  return 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
}

/** Region grow from seed through pixels that pass `test`, limited to box. Returns a mask (Uint8Array). */
function grow(img, seed, box, test) {
  const { w } = img;
  const [x0, y0, x1, y1] = box;
  const mask = new Uint8Array(img.w * img.h);
  const stack = [seed[1] * w + seed[0]];
  if (!test(stack[0] * 4)) throw new Error(`seed ${seed} does not match the region test`);
  mask[stack[0]] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
      const q = ny * w + nx;
      if (mask[q] || !test(q * 4)) continue;
      mask[q] = 1;
      stack.push(q);
    }
  }
  return mask;
}

/** Grows a mask by `radius` px into pixels that pass `test` (used to pick up the dark outline). */
function dilate(img, mask, radius, test) {
  const { w, h } = img;
  let cur = mask;
  for (let r = 0; r < radius; r++) {
    const next = cur.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (cur[p]) continue;
        if ((cur[p - 1] || cur[p + 1] || cur[p - w] || cur[p + w]) && test(p * 4)) next[p] = 1;
      }
    }
    cur = next;
  }
  return cur;
}

/** Copy of img with only the masked pixels. */
function masked(img, mask) {
  const out = blank(img.w, img.h);
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    out.data.set(img.data.subarray(p * 4, p * 4 + 4), p * 4);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------------------------

const manifest = { hero: {}, dragon: { heads: {} } };

async function processHero() {
  const H = CONFIG.hero;
  for (const [dir, file] of Object.entries(H.files)) {
    const img = removeWhite(await load(file));
    const box = padBox(img, bbox(img), 6);
    const scale = H.height / box.h;
    const r = await render(img, box, scale);
    await save(`hero_${dir}`, r);

    // Sack: orange/brown pixels connected to the seed, plus its dark outline.
    const S = H.sack[dir];
    const d = img.data;
    const sackish = (i) => d[i + 3] > 200 && d[i] >= 90 && d[i] >= d[i + 1] && d[i] - d[i + 2] >= 50;
    let mask = grow(img, S.seed, S.box, sackish);
    const [bx0, by0, bx1, by1] = S.box;
    mask = dilate(img, mask, H.outlineGrow, (i) => {
      const p = i / 4;
      const x = p % img.w;
      const y = (p - x) / img.w;
      return x >= bx0 - 8 && x < bx1 + 8 && y >= by0 - 8 && y < by1 + 8 && (lum(d, i) < 90 || d[i + 3] < 250);
    });
    const sackImg = masked(img, mask);
    const sb = bbox(sackImg, 0, 0, sackImg.w, sackImg.h, 1);
    const sr = await render(sackImg, box, scale);
    await save(`hero_sack_${dir}`, sr);
    const anchor = r.map([sb.x + sb.w * S.anchor[0], sb.y + sb.h * S.anchor[1]]);
    manifest.hero[dir] = { width: r.w, height: r.h, sackAnchor: anchor };
  }
}

/**
 * Grid lines for a sheet: near each nominal split, picks the row/column with the fewest opaque
 * pixels (the gap between items), so items that cross the halfway line are not cut.
 */
function gridLines(img, count, axis) {
  const len = axis === 'x' ? img.w : img.h;
  const other = axis === 'x' ? img.h : img.w;
  const profile = new Uint32Array(len);
  for (let a = 0; a < len; a++) {
    let c = 0;
    for (let b = 0; b < other; b++) {
      const x = axis === 'x' ? a : b;
      const y = axis === 'x' ? b : a;
      if (img.data[(y * img.w + x) * 4 + 3] >= CONFIG.bg.bboxAlpha) c++;
    }
    profile[a] = c;
  }
  const lines = [0];
  const cell = len / count;
  for (let k = 1; k < count; k++) {
    const from = Math.round(cell * (k - 0.3));
    const to = Math.round(cell * (k + 0.3));
    let best = from;
    for (let a = from; a <= to; a++) if (profile[a] < profile[best]) best = a;
    lines.push(best);
  }
  lines.push(len);
  return lines;
}

async function processSheet(S, fit) {
  const img = removeWhite(await load(S.file));
  const xs = gridLines(img, S.cols, 'x');
  const ys = gridLines(img, S.rows, 'y');
  for (let i = 0; i < S.items.length; i++) {
    const item = S.items[i];
    const col = i % S.cols;
    const row = Math.floor(i / S.cols);
    const cell = bbox(img, xs[col], ys[row], xs[col + 1], ys[row + 1]);
    const box = padBox(img, cell, 4);
    const r = fit === 'width' ? await render(img, box, item.width / box.w) : await renderContain(img, box, item.box);
    await save(item.name, r);
  }
}

async function processDragon() {
  const D = CONFIG.dragon;

  // Body + tail tip.
  const body = removeWhite(await load(D.body));
  const T = D.tail;
  const opaque = (i) => body.data[i + 3] > 0;
  const tailMask = grow(body, T.seed, T.box, opaque);
  const pieceMask = new Uint8Array(tailMask.length);
  for (let p = 0; p < tailMask.length; p++) {
    if (!tailMask[p]) continue;
    const x = p % body.w;
    if (x < T.cutX + T.overlap) pieceMask[p] = 1;
  }
  const piece = masked(body, pieceMask);
  // Pivot: centre of the tail where it is cut.
  let sumY = 0;
  let count = 0;
  for (let y = T.box[1]; y < T.box[3]; y++) {
    if (tailMask[y * body.w + T.cutX]) {
      sumY += y;
      count++;
    }
  }
  const pivotRaw = [T.cutX, count ? sumY / count : (T.box[1] + T.box[3]) / 2];
  // Erase the tip from the body (the piece overlaps the cut to hide the seam).
  for (let p = 0; p < tailMask.length; p++) {
    if (tailMask[p] && p % body.w < T.cutX) body.data[p * 4 + 3] = 0;
  }

  const bodyBox = padBox(body, union(bbox(body), bbox(piece)), 6);
  const bodyScale = D.bodyWidth / bodyBox.w;
  const br = await render(body, bodyBox, bodyScale, true);
  await save('dragon_body', br);

  const pb = padBox(piece, bbox(piece, 0, 0, piece.w, piece.h, 1), 3);
  const pr = await render(piece, pb, bodyScale, true);
  await save('dragon_tail_tip', pr);
  // Piece top-left (after mirroring its own box) in body texture px, and pivot inside the piece.
  const pieceTopLeft = br.map([pb.x + pb.w, pb.y]);
  const pivotInPiece = pr.map(pivotRaw);

  manifest.dragon.body = { width: br.w, height: br.h, neck: br.map(D.bodyNeck) };
  manifest.dragon.tail = {
    width: pr.w,
    height: pr.h,
    x: pieceTopLeft.x,
    y: pieceTopLeft.y,
    pivot: pivotInPiece,
  };

  // Heads: one shared crop box so they stay the same scale.
  const heads = {};
  let box = null;
  for (const [stage, H] of Object.entries(D.heads)) {
    const img = removeWhite(await load(H.file));
    heads[stage] = img;
    const b = bbox(img);
    box = box ? union(box, b) : b;
  }
  const first = Object.values(heads)[0];
  box = padBox(first, box, 6);
  const headScale = D.headWidth / box.w;
  for (const [stage, H] of Object.entries(D.heads)) {
    const r = await render(heads[stage], box, headScale, true);
    await save(`dragon_head_${stage}`, r);
    const neck = r.map(H.neck);
    const rel = (pt) => {
      const m = r.map(pt);
      return { x: round2(m.x - neck.x), y: round2(m.y - neck.y) };
    };
    manifest.dragon.heads[stage] = {
      width: r.w,
      height: r.h,
      neck,
      eyes: H.eyes.map(rel),
      mouth: rel(H.mouth),
      nostril: rel(H.nostril),
    };
  }
}

async function processTiles() {
  for (const t of CONFIG.tiles) {
    // Resize a 3x3 repeat and keep the middle, so the edges still tile seamlessly.
    const src = sharp(path.join(RAW, t.file)).removeAlpha();
    const meta = await src.metadata();
    const buf = await src.png().toBuffer();
    const big = await sharp({
      create: { width: meta.width * 3, height: meta.height * 3, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .composite(
        [0, 1, 2].flatMap((gy) => [0, 1, 2].map((gx) => ({ input: buf, left: gx * meta.width, top: gy * meta.height }))),
      )
      .png()
      .toBuffer();
    const raw = await sharp(big)
      .resize(t.size * 3, t.size * 3, { kernel: 'lanczos3', fit: 'fill' })
      .extract({ left: t.size, top: t.size, width: t.size, height: t.size })
      .ensureAlpha()
      .raw()
      .toBuffer();
    await save(t.name, { raw, w: t.size, h: t.size });
  }
}

async function processSingles() {
  for (const s of CONFIG.singles) {
    const img = removeWhite(await load(s.file));
    const box = padBox(img, bbox(img), 4);
    await save(s.name, await render(img, box, s.width / box.w));
  }
}

// ---------------------------------------------------------------------------------------------
// Previews (art/preview/, not shipped): assembled dragon with points, hero with a grown sack.
// ---------------------------------------------------------------------------------------------

function dot(x, y, color) {
  const svg = `<svg width="9" height="9"><circle cx="4.5" cy="4.5" r="3.5" fill="${color}" stroke="black" stroke-width="1"/></svg>`;
  return { input: Buffer.from(svg), left: Math.round(x - 4.5), top: Math.round(y - 4.5) };
}

async function writePreviews() {
  const file = (n) => path.join(OUT, `${n}.png`);
  const bg = { r: 40, g: 34, b: 52, alpha: 1 };
  const B = manifest.dragon.body;
  const T = manifest.dragon.tail;

  for (const [stage, H] of Object.entries(manifest.dragon.heads)) {
    const W = B.width + H.width;
    const Hh = Math.max(B.height, H.height) + 60;
    const bodyLeft = 10;
    const bodyTop = Math.round((Hh - B.height) / 2);
    const neckX = bodyLeft + B.neck.x;
    const neckY = bodyTop + B.neck.y;
    const headLeft = Math.round(neckX - H.neck.x);
    const headTop = Math.round(neckY - H.neck.y);
    const layers = [
      { input: file('dragon_body'), left: bodyLeft, top: bodyTop },
      { input: file('dragon_tail_tip'), left: Math.round(bodyLeft + T.x), top: Math.round(bodyTop + T.y) },
      { input: file(`dragon_head_${stage}`), left: Math.max(0, headLeft), top: Math.max(0, headTop) },
      dot(neckX, neckY, 'lime'),
      dot(bodyLeft + T.x + T.pivot.x, bodyTop + T.y + T.pivot.y, 'cyan'),
      ...H.eyes.map((e) => dot(neckX + e.x, neckY + e.y, 'yellow')),
      dot(neckX + H.mouth.x, neckY + H.mouth.y, 'orange'),
      dot(neckX + H.nostril.x, neckY + H.nostril.y, 'white'),
    ];
    await sharp({ create: { width: W + 40, height: Hh, channels: 4, background: bg } })
      .composite(layers)
      .png()
      .toFile(path.join(PREVIEW, `dragon_${stage}.png`));
  }

  // Hero: plain, and with the sack overlay at 1.5x around its anchor (both 3x zoomed).
  const zoom = 3;
  const grownScale = 1.5;
  const tiles = [];
  let x = 10;
  for (const [dir, h] of Object.entries(manifest.hero)) {
    const heroBuf = await sharp(file(`hero_${dir}`)).resize(h.width * zoom, h.height * zoom).toBuffer();
    const sw = Math.round(h.width * zoom * grownScale);
    const shh = Math.round(h.height * zoom * grownScale);
    const sackBuf = await sharp(file(`hero_sack_${dir}`)).resize(sw, shh).toBuffer();
    const ax = h.sackAnchor.x * zoom;
    const ay = h.sackAnchor.y * zoom;
    const top = 120;
    tiles.push({ input: heroBuf, left: x, top });
    tiles.push({ input: heroBuf, left: x + h.width * zoom + 20, top });
    const sx = Math.round(x + h.width * zoom + 20 + ax - ax * grownScale);
    const sy = Math.round(top + ay - ay * grownScale);
    tiles.push({ input: sackBuf, left: Math.max(0, sx), top: Math.max(0, sy) });
    tiles.push(dot(x + ax, top + ay, 'lime'));
    x += h.width * zoom * 2 + 80;
  }
  await sharp({ create: { width: x + 40, height: Math.round(96 * zoom * grownScale) + 200, channels: 4, background: bg } })
    .composite(tiles)
    .png()
    .toFile(path.join(PREVIEW, 'hero_sack.png'));
}

// ---------------------------------------------------------------------------------------------

function writeManifest() {
  const files = outputs.map((o) => `    ${o.name}: { file: '${o.file}', width: ${o.w}, height: ${o.h} },`).join('\n');
  const src = `// GENERATED by scripts/process-assets.mjs (npm run assets). Do not edit by hand.
// Sizes and anchor points are in texture pixels of the files in public/assets/game/.

export const ART_FILES = {
${files}
} as const;

export type ArtName = keyof typeof ART_FILES;

export const ART_ANCHORS = ${JSON.stringify(manifest, null, 2)} as const;
`;
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, src);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PREVIEW, { recursive: true });
  const t0 = Date.now();

  await processHero();
  await processSheet(CONFIG.treasure, 'width');
  await processSheet(CONFIG.traps, 'contain');
  await processDragon();
  await processTiles();
  await processSingles();
  await writePreviews();
  writeManifest();

  const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
  console.log(`\nWrote ${outputs.length} files to public/assets/game/ in ${((Date.now() - t0) / 1000).toFixed(1)}s:\n`);
  for (const o of outputs) console.log(`  ${o.file.padEnd(26)} ${`${o.w}x${o.h}`.padStart(9)}  ${kb(o.bytes).padStart(9)}`);
  const total = outputs.reduce((s, o) => s + o.bytes, 0);
  console.log(`\n  total ${kb(total)}`);
  console.log(`\nAnchors: src/generated/artManifest.ts   Previews: art/preview/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
