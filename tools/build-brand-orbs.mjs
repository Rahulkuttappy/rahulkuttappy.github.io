/* Regenerates assets/brand-orbs/engine.js from the installed package.
 *
 *   node tools/build-brand-orbs.mjs
 *
 * The engine is carried verbatim; this applies exactly three things on top:
 *
 *   1. the pause hook the package's own React host applies at runtime, so the
 *      engine's visibility test also honours window.__BRAND_ORB_PAUSED;
 *   2. the RK monogram as a 24th mark, traced from assets/images/logo.png --
 *      the logo only exists as a raster, and MARK_PATHS holds path data;
 *   3. the matching entry in the engine's own variant registry.
 *
 * Everything else is left alone. Never hand-edit the generated engine: change
 * it here and re-run, or the next package update silently drops the logo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import html from '../node_modules/@designcodeio/threeui/lib-dist/shaders/brand-orbs/sources/brand-orbs-v2.html.js';

const OUT = new URL('../assets/brand-orbs/engine.js', import.meta.url);

/* The authored specimen document carries the engine as its last script block,
   which is the same one the package's host extracts. */
const engine = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].at(-1)[1];
const docHash = createHash('sha256').update(html).digest('hex');
const engHash = createHash('sha256').update(engine).digest('hex');

const once = (src, from, to, what) => {
  if (src.split(from).length - 1 !== 1) throw new Error(`expected exactly one ${what}`);
  return src.replace(from, to);
};

let out = engine;

/* 1. pause hook — note the closing paren belongs inside the condition */
out = once(out,
  'if (document.visibilityState !== "hidden")',
  'if (document.visibilityState !== "hidden" && !window.__BRAND_ORB_PAUSED)',
  'visibility hook');

/* 2. the monogram. Two contours traced from the logo's alpha at 200x128 and
      simplified, then scaled into the 400x256 box the artwork was drawn in.
      Checked against the original: 5708 of 102400 pixels differ, all of it
      antialiased edging and rounded corners flattened to straight lines, which
      is far below the grid pathDots samples the mask with. */
const RK_PATH = readFileSync(new URL('./rk-logo-path.txt', import.meta.url), 'utf8').trim();
out = once(out,
  '  const MARK_PATHS = {\n',
  '  const MARK_PATHS = {\n    rk: "' + RK_PATH + '",\n',
  'MARK_PATHS opening');

/* 3. the variant itself. vb 400 because the path is authored in the logo's own
      box rather than the 24-unit one the brand icons use; pathDots normalises
      against the mark's bounding box afterwards, so the wide aspect survives.
      diag runs the crest along the chevrons rather than across them.

      No accent. The brand red is #7A1B18, which is very dark, and the engine
      tints accented dots at nine tenths strength -- against a near-black orb
      that came out as low-contrast mud. The logo is off-white everywhere else
      on the site, so the dots are left as the engine's own near-white. */
out = once(out,
  '  const MODES = {\n',
  '  const MODES = {\n' +
  '    rk: { draw: mk({ key: "rk", n: 34, nMini: 15, motion: "ring", speed: .32,\n' +
  '                     fit: .96, vb: 400, v: .70 }), accent: null, speed: 1, staticT: 1.2 },\n',
  'MODES opening');

/* 4. a fourth motion for the generic mark renderer: the outward ring that
      gives the Aura orb its pulse. Aura is a bespoke draw function over its
      own geometry, so its motion cannot simply be pointed at another mark.
      The maths below is lifted from it unchanged -- a crest travelling out
      from the centre, driven by each dot's radial distance -- and added
      alongside scan, sweep and diag so any mark can use it. */
out = once(out,
  '    const wave = (((t * (cfg.speed ?? .4)) % 1 + 1) % 1) * 2.4 - 1.2;\n',
  '    const wave = (((t * (cfg.speed ?? .4)) % 1 + 1) % 1) * 2.4 - 1.2;\n' +
  '    const ring = (((t * (cfg.speed ?? .32)) % 1 + 1) % 1) * 2.2 - .2;\n',
  'drawMark wave line');

out = once(out,
  '      } else crest = Math.exp(-Math.pow((gx - gy) * .5 - wave, 2) / .05);',
  '      } else if (cfg.motion === "ring") {\n' +
  '        crest = Math.exp(-Math.pow(Math.hypot(gx, gy) - ring, 2) / .045);\n' +
  '      } else crest = Math.exp(-Math.pow((gx - gy) * .5 - wave, 2) / .05);',
  'drawMark motion chain');

const header =
`/* Brand Orbs V2 — the authored Canvas 2D dot engine from @designcodeio/threeui
   (shaders/brand-orbs/sources/brand-orbs-v2.html), carried over verbatim.

   Source document SHA-256 ${docHash}
   Upstream engine SHA-256 ${engHash}

   GENERATED — do not hand-edit. Rebuild with:
     node tools/build-brand-orbs.mjs
   which reapplies the runtime pause hook and adds the RK monogram as a 24th
   mark. Editing this file directly means losing both on the next rebuild. */
`;

writeFileSync(OUT, header + out);
console.log('engine written  :', (header + out).length, 'chars');
console.log('document sha256 :', docHash.slice(0, 16));
console.log('engine sha256   :', engHash.slice(0, 16));
console.log('rk path chars   :', RK_PATH.length);
