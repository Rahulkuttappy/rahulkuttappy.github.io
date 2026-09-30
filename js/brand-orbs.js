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

  var VARIANTS = ["claude","openai","codex","cursor","gemini","figma","framer","react",
    "swift","designcode","aura","dreamcut","ui","ux","css","ios","neuform","github",
    "x","instagram","threads","linkedin","email"];
  var SIZES = ["small","medium"];
  var LABELS = {
    claude:"Claude Code", openai:"OpenAI", codex:"Codex", cursor:"Cursor", gemini:"Gemini",
    figma:"Figma", framer:"Framer", react:"React", swift:"Swift", designcode:"DesignCode",
    aura:"Aura", dreamcut:"DreamCut", ui:"UI", ux:"UX", css:"CSS", ios:"iOS",
    neuform:"Neuform", github:"GitHub", x:"X", instagram:"Instagram", threads:"Threads",
    linkedin:"LinkedIn", email:"Email"
  };
  var DEFAULTS = { variant:"claude", size:"medium", mode:"dark", speed:1, paused:false };

  /* The project pages sit a directory down, so the host page is resolved from
     this script's own URL rather than from whoever is doing the mounting. */
  var HOST = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) return 'assets/brand-orbs/orb.html';
    return s.split('?')[0].replace(/js\/brand-orbs\.js$/, 'assets/brand-orbs/orb.html');
  })();

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
    frame.src = HOST + '?variant=' + encodeURIComponent(variant) +
                '&size=' + encodeURIComponent(size) +
                '&mode=' + encodeURIComponent(mode);
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('loading', 'eager');
    frame.setAttribute('scrolling', 'no');
    frame.title = o.label || (LABELS[variant] + ' animated brand orb');
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:' +
      (mode === 'light' ? '#dad7cc' : '#050608') + ';';

    /* Nothing should be drawing while it is off screen or the tab is in the
       background; the engine keeps its frame and picks up where it left off. */
    function push() {
      if (!frame.contentWindow) return;
      frame.contentWindow.postMessage({
        type: 'brand-orbs-controls',
        controls: { speed: speed, paused: paused || !onScreen || !pageVisible }
      }, '*');
    }

    frame.addEventListener('load', push);
    el.appendChild(frame);

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
