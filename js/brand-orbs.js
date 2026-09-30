/* ── BRAND ORBS ──
   Brand Orbs V2 on a site with no framework and no build step.

   The published component is React, and its import cannot run here, so this
   is the same thing with the host boundary rewritten: the authored Canvas 2D
   engine is untouched in assets/brand-orbs/engine.js, and each orb is one
   sandboxed iframe with a single canvas in it, exactly as the package builds.

   Usage:
     BrandOrbs.mount(el, { variant:'instagram', size:'small' })
   which returns a handle with setSpeed, setPaused and destroy.

   Give the target a size of its own: the orb fills it, and the two presets
   are tuned at 20px and 56px, so stretching either with CSS is a mistake. */
(function (global) {
  'use strict';

  /* rk is ours: the monogram, added to the engine by tools/build-brand-orbs.mjs.
     The other twenty-three ship with the package. */
  var VARIANTS = ["rk","claude","openai","codex","cursor","gemini","figma","framer","react",
    "swift","designcode","aura","dreamcut","ui","ux","css","ios","neuform","github",
    "x","instagram","threads","linkedin","email"];
  var SIZES = ["small","medium"];
  var LABELS = {
    rk:"Rahul Kuttappy",
    claude:"Claude Code", openai:"OpenAI", codex:"Codex", cursor:"Cursor", gemini:"Gemini",
    figma:"Figma", framer:"Framer", react:"React", swift:"Swift", designcode:"DesignCode",
    aura:"Aura", dreamcut:"DreamCut", ui:"UI", ux:"UX", css:"CSS", ios:"iOS",
    neuform:"Neuform", github:"GitHub", x:"X", instagram:"Instagram", threads:"Threads",
    linkedin:"LinkedIn", email:"Email"
  };
  var DEFAULTS = { variant:"rk", size:"medium", mode:"dark", speed:1, paused:false };

  /* The project pages sit a directory down, so assets are resolved from this
     script's own URL rather than from whoever is doing the mounting. */
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) return 'assets/brand-orbs/';
    return s.split('?')[0].replace(/js\/brand-orbs\.js$/, 'assets/brand-orbs/');
  })();

  /* The engine is fetched once and the frames are built as srcdoc, which is
     how the package does it. A sandboxed frame pointed at a real file has to
     navigate, and a navigation can be blocked -- it is blocked outright in
     some embedded browsers, where every such frame came back
     ERR_BLOCKED_BY_CLIENT and rendered nothing. An inline document makes no
     request at all, so there is nothing to block. Fetching the engine rather
     than inlining it in this file keeps it cacheable and off every page that
     never mounts an orb. */
  var enginePromise = null;
  function engine() {
    if (!enginePromise) {
      enginePromise = fetch(BASE + 'engine.js')
        .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
        /* a closing script tag inside the source would end the block early */
        .then(function (src) { return src.replace(/<\/script/gi, '<\\/script'); });
    }
    return enginePromise;
  }

  var SHIM = [
    '(function () {',
    '  var nativeNow = performance.now.bind(performance);',
    '  var last = nativeNow(), virtual = last;',
    '  var controls = { speed: 1, paused: false };',
    '  window.__BRAND_ORB_PAUSED = false;',
    '  performance.now = function () {',
    '    var real = nativeNow();',
    '    if (!controls.paused) virtual += (real - last) * controls.speed;',
    '    last = real; return virtual;',
    '  };',
    '  window.addEventListener("message", function (event) {',
    '    if (!event.data || event.data.type !== "brand-orbs-controls") return;',
    '    var next = event.data.controls || {};',
    '    if (Number.isFinite(next.speed)) controls.speed = Math.max(.1, Math.min(3, next.speed));',
    '    controls.paused = Boolean(next.paused);',
    '    window.__BRAND_ORB_PAUSED = controls.paused;',
    '    /* an absolute clock, so the orb can be scrubbed to a phase rather',
    '       than only slowed or stopped: a caller driving this from scroll can',
    '       hold it to exactly one cycle however fast the page is moved */',
    '    if (Number.isFinite(next.time)) { virtual = next.time; last = nativeNow(); }',
    '  });',
    '})();'
  ].join('\n');

  function buildDoc(variant, sizePx, light, clear, engineSrc) {
    var bg = clear ? 'transparent' : (light ? '#dad7cc' : '#050608');
    /* the authored light treatment: the engine only ever draws a dark orb */
    var filter = light ? 'invert(1) hue-rotate(180deg) contrast(1.04) saturate(.92)' : 'none';
    return '<!doctype html><html lang="en" data-theme="' + (light ? 'light' : 'dark') + '">' +
      '<head><meta charset="utf-8">' +
      '<style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:' + bg + ';}' +
      'body{display:grid;place-items:center;}' +
      'canvas{display:block;width:' + sizePx + 'px;height:' + sizePx + 'px;filter:' + filter + ';}</style>' +
      '<script>' + SHIM + '<\/script></head><body>' +
      '<canvas data-mode="' + variant + '" data-size="' + sizePx + '" aria-hidden="true"></canvas>' +
      '<script>' + engineSrc + '<\/script></body></html>';
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function resolveMode(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    var root = document.documentElement;
    var set = root.dataset.theme || root.dataset.scheme;
    if (set === 'light' || set === 'dark') return set;
    if (root.classList.contains('light')) return 'light';
    if (root.classList.contains('dark')) return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function mount(target, options) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;
    var o = options || {};

    var variant = VARIANTS.indexOf(o.variant) >= 0 ? o.variant : DEFAULTS.variant;
    var size    = SIZES.indexOf(o.size) >= 0 ? o.size : DEFAULTS.size;
    var mode    = resolveMode(o.mode || DEFAULTS.mode);
    var speed   = clamp(typeof o.speed === 'number' ? o.speed : DEFAULTS.speed, 0.1, 3);
    var paused  = Boolean(o.paused);

    var onScreen = true;
    var pageVisible = !document.hidden;

    var frame = document.createElement('iframe');
    var clear = o.bg === 'none' && mode !== 'light';
    var sizePx = size === 'small' ? 20 : 56;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('scrolling', 'no');
    frame.title = o.label || (LABELS[variant] + ' animated brand orb');
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:' +
      (clear ? 'transparent' : (mode === 'light' ? '#dad7cc' : '#050608')) + ';';

    /* Nothing should be drawing while it is off screen or the tab is in the
       background; the engine keeps its frame and picks up where it left off. */
    var atTime = null;                 /* set to drive the phase from outside */
    function push() {
      if (!frame.contentWindow) return;
      var c = { speed: speed, paused: paused || !onScreen || !pageVisible };
      if (atTime !== null) c.time = atTime;
      frame.contentWindow.postMessage({ type: 'brand-orbs-controls', controls: c }, '*');
    }

    frame.addEventListener('load', push);
    el.appendChild(frame);
    engine().then(function (src) {
      frame.srcdoc = buildDoc(variant, sizePx, mode === 'light', clear, src);
    }).catch(function () { /* the markup fallback stays put */ });

    var io = null;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        onScreen = entries[0] ? entries[0].isIntersecting : true;
        push();
      });
      io.observe(frame);
    }

    function onVisibility() { pageVisible = !document.hidden; push(); }
    document.addEventListener('visibilitychange', onVisibility);

    return {
      el: frame,
      variant: variant,
      setSpeed: function (v) { speed = clamp(v, 0.1, 3); push(); },
      setPaused: function (v) { paused = Boolean(v); push(); },
      /* milliseconds on the orb's own clock; one ring cycle is 1000/speed of
         the mark, which for the monogram's .32 is 3125ms */
      setTime: function (ms) { atTime = ms; push(); },
      destroy: function () {
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        frame.removeEventListener('load', push);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }
    };
  }

  /* Anything carrying data-orb is mounted on load, so markup alone is enough:
     <span class="orb" data-orb="instagram" data-orb-size="small"></span> */
  function auto() {
    var out = [];
    document.querySelectorAll('[data-orb]').forEach(function (el) {
      if (el.dataset.orbMounted) return;
      el.dataset.orbMounted = '1';
      out.push(mount(el, {
        variant: el.dataset.orb,
        size:    el.dataset.orbSize,
        mode:    el.dataset.orbMode,
        bg:      el.dataset.orbBg,
        speed:   el.dataset.orbSpeed ? parseFloat(el.dataset.orbSpeed) : undefined,
        label:   el.getAttribute('aria-label') || undefined
      }));
    });
    return out;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  global.BrandOrbs = {
    mount: mount, auto: auto,
    VARIANTS: VARIANTS, SIZES: SIZES, LABELS: LABELS, DEFAULTS: DEFAULTS
  };
})(window);
