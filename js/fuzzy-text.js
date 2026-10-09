/* ── FUZZY TEXT ──
   React Bits' FuzzyText, rebuilt for a site with no framework. The effect is
   plain Canvas 2D — text drawn once to an offscreen canvas, then blitted back
   a slice at a time with a random offset per slice — so only the React
   lifecycle needed replacing.

   Usage:
     FuzzyText.mount(el, { hoverIntensity: .5 })
   or in markup, which mounts itself:
     <span data-fuzzy data-fuzzy-hover-intensity=".5">404</span>

   The element's own text is the source, and it stays in the DOM (visually
   hidden) so the page still reads correctly to a screen reader and to search
   — the original returns a bare canvas with the words nowhere in the markup.

   Four things differ from the source, all noted where they happen:
   the canvas is drawn at device pixel ratio; the vertical margin is real, so
   vertical displacement is not clipped; 'both' uses a second offscreen rather
   than a getImageData per column; and it stops when off screen or hidden. */
(function (global) {
  'use strict';

  var DEFAULTS = {
    fontSize: 'clamp(2rem, 8vw, 8rem)',
    fontWeight: 900,
    fontFamily: 'inherit',
    color: '#fff',
    enableHover: true,
    baseIntensity: 0.18,
    hoverIntensity: 0.5,
    fuzzRange: 30,
    fps: 60,
    direction: 'horizontal',
    transitionDuration: 0,
    clickEffect: false,
    glitchMode: false,
    glitchInterval: 2000,
    glitchDuration: 200,
    gradient: null,
    letterSpacing: 0,
    className: ''
  };

  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  function mount(target, options) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in (options || {})) if (options[k] !== undefined) o[k] = options[k];

    var text = (el.dataset.fuzzyText || el.textContent || '').trim();
    if (!text) return null;

    /* the words stay, just out of sight; the canvas is decoration over them */
    var sr = document.createElement('span');
    sr.textContent = text;
    sr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;' +
      'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;';
    var canvas = document.createElement('canvas');
    if (o.className) canvas.className = o.className;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.display = 'block';
    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var raf = 0, cancelled = false;
    var glitchT = 0, glitchEndT = 0, clickT = 0;
    var offscreen = document.createElement('canvas');
    var offCtx = offscreen.getContext('2d');
    /* 'both' shifts rows then columns; doing that with a getImageData per
       column, as the original does, is hundreds of readbacks a frame. A
       second offscreen takes the first pass instead and the second pass
       blits from it, which looks the same and costs almost nothing. */
    var mid = document.createElement('canvas');
    var midCtx = mid.getContext('2d');

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var offW = 0, tightH = 0, hMargin = 0, vMargin = 0;
    var hovering = false, clicking = false, glitching = false;
    var current = o.baseIntensity, targetI = o.baseIntensity;
    var lastFrame = 0, frameDur = 1000 / o.fps;
    var onScreen = true, pageVisible = !document.hidden, parked = false;
    var hit = { l: 0, t: 0, r: 0, b: 0 };

    function build() {
      var computedFamily = o.fontFamily === 'inherit'
        ? (getComputedStyle(el).fontFamily || 'sans-serif') : o.fontFamily;
      var sizeStr = typeof o.fontSize === 'number' ? o.fontSize + 'px' : o.fontSize;

      var numericSize;
      if (typeof o.fontSize === 'number') numericSize = o.fontSize;
      else {
        var probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;font-size:' + sizeStr;
        el.appendChild(probe);
        numericSize = parseFloat(getComputedStyle(probe).fontSize) || 32;
        probe.remove();
      }

      var font = o.fontWeight + ' ' + sizeStr + ' ' + computedFamily;
      offCtx.font = font;
      offCtx.textBaseline = 'alphabetic';

      /* letter spacing may be given in em, which has to be resolved against
         whatever the font size worked out to -- the hero name is tracked in
         em and its size is a clamp, so a fixed pixel value would be wrong at
         every width but one. */
      var spacing = o.letterSpacing;
      if (typeof spacing === 'string') {
        spacing = /em$/.test(spacing) ? parseFloat(spacing) * numericSize : parseFloat(spacing) || 0;
      }

      var total = 0, i;
      if (spacing !== 0) {
        for (i = 0; i < text.length; i++) total += offCtx.measureText(text[i]).width + spacing;
        total -= spacing;
      } else {
        total = offCtx.measureText(text).width;
      }

      var m = offCtx.measureText(text);
      var left = m.actualBoundingBoxLeft || 0;
      var right = spacing !== 0 ? total : (m.actualBoundingBoxRight || m.width);
      var ascent = m.actualBoundingBoxAscent || numericSize;
      var descent = m.actualBoundingBoxDescent || numericSize * 0.2;

      var boundW = Math.ceil(spacing !== 0 ? total : left + right);
      tightH = Math.ceil(ascent + descent);
      var buffer = 10;
      offW = boundW + buffer;

      /* drawn at device resolution, then shown at CSS size: the original
         leaves the canvas at CSS pixels, which is soft on a retina screen */
      offscreen.width = Math.ceil(offW * dpr);
      offscreen.height = Math.ceil(tightH * dpr);
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offCtx.clearRect(0, 0, offW, tightH);
      offCtx.font = font;
      offCtx.textBaseline = 'alphabetic';

      if (o.gradient && o.gradient.length >= 2) {
        var grad = offCtx.createLinearGradient(0, 0, offW, 0);
        o.gradient.forEach(function (c, j) { grad.addColorStop(j / (o.gradient.length - 1), c); });
        offCtx.fillStyle = grad;
      } else {
        offCtx.fillStyle = o.color;
      }

      var xOff = buffer / 2;
      if (spacing !== 0) {
        var x = xOff;
        for (i = 0; i < text.length; i++) {
          offCtx.fillText(text[i], x, ascent);
          x += offCtx.measureText(text[i]).width + spacing;
        }
      } else {
        offCtx.fillText(text, xOff - left, ascent);
      }

      hMargin = o.fuzzRange + 20;
      /* a real vertical margin: the original uses zero, so anything shifted
         up or down in the vertical and both modes is clipped off */
      vMargin = (o.direction === 'horizontal') ? 0 : o.fuzzRange + 10;

      canvas.width = Math.ceil((offW + hMargin * 2) * dpr);
      canvas.height = Math.ceil((tightH + vMargin * 2) * dpr);
      canvas.style.width = (offW + hMargin * 2) + 'px';
      canvas.style.height = (tightH + vMargin * 2) + 'px';
      mid.width = canvas.width; mid.height = canvas.height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      midCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* the margins exist only to give the fuzz somewhere to go; without
         pulling them back the glyphs sit inset from where the text was, which
         breaks the alignment of anything this replaces in place. */
      canvas.style.marginLeft = -hMargin + 'px';
      canvas.style.marginRight = -hMargin + 'px';
      canvas.style.marginTop = -vMargin + 'px';
      canvas.style.marginBottom = -vMargin + 'px';

      hit.l = hMargin + xOff; hit.t = vMargin;
      hit.r = hit.l + boundW; hit.b = hit.t + tightH;
    }

    function slices(source, target2, dx0, dy0, useX, useY) {
      var j, i2;
      if (useX) {
        for (j = 0; j < tightH; j++) {
          var dx = Math.floor(current * (Math.random() - 0.5) * o.fuzzRange);
          target2.drawImage(source, 0, j * dpr, source.width, dpr,
                            dx0 + dx, dy0 + j, offW, 1);
        }
      } else {
        for (i2 = 0; i2 < offW; i2++) {
          var dy = Math.floor(current * (Math.random() - 0.5) * o.fuzzRange);
          target2.drawImage(source, i2 * dpr, 0, dpr, source.height,
                            dx0 + i2, dy0 + dy, 1, tightH);
        }
      }
    }

    function frame(ts) {
      if (cancelled) return;
      raf = requestAnimationFrame(frame);
      if (ts - lastFrame < frameDur) return;
      lastFrame = ts;

      targetI = clicking ? 1 : glitching ? 1 : hovering ? o.hoverIntensity : o.baseIntensity;
      if (o.transitionDuration > 0) {
        var step = 1 / (o.transitionDuration / frameDur);
        if (current < targetI) current = Math.min(current + step, targetI);
        else if (current > targetI) current = Math.max(current - step, targetI);
      } else {
        current = targetI;
      }

      ctx.clearRect(0, 0, offW + hMargin * 2, tightH + vMargin * 2);
      if (o.direction === 'horizontal') {
        slices(offscreen, ctx, hMargin, vMargin, true, false);
      } else if (o.direction === 'vertical') {
        slices(offscreen, ctx, hMargin, vMargin, false, true);
      } else {
        midCtx.clearRect(0, 0, offW + hMargin * 2, tightH + vMargin * 2);
        slices(offscreen, midCtx, hMargin, vMargin, true, false);
        /* second pass reads the first from a canvas, not from pixel data */
        for (var i = 0; i < offW + hMargin * 2; i++) {
          var dy = Math.floor(current * (Math.random() - 0.5) * o.fuzzRange * 0.5);
          ctx.drawImage(mid, i * dpr, 0, dpr, mid.height, i, dy, 1, tightH + vMargin * 2);
        }
      }
    }

    function drawStill() {
      current = o.baseIntensity;
      ctx.clearRect(0, 0, offW + hMargin * 2, tightH + vMargin * 2);
      ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height,
                    hMargin, vMargin, offW, tightH);
    }

    function play() {
      if (parked) return;
      if (cancelled || raf || calm) return;
      if (!onScreen || !pageVisible) return;
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    function startGlitch() {
      if (!o.glitchMode || cancelled) return;
      glitchT = setTimeout(function () {
        glitching = true;
        glitchEndT = setTimeout(function () { glitching = false; startGlitch(); }, o.glitchDuration);
      }, o.glitchInterval);
    }

    function inside(x, y) { return x >= hit.l && x <= hit.r && y >= hit.t && y <= hit.b; }
    function onMove(e) {
      var r = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      hovering = inside(p.clientX - r.left, p.clientY - r.top);
    }
    function onLeave() { hovering = false; }
    function onClick() {
      clicking = true;
      clearTimeout(clickT);
      clickT = setTimeout(function () { clicking = false; }, 150);
    }

    /* Measuring before the webfont lands gives the fallback face's metrics
       and a canvas of the wrong size. The React original awaits this; leaving
       it out happened to work wherever the font was already cached, which is
       not the same as working. */
    function whenReady(fn) {
      if (!document.fonts || !document.fonts.load) { fn(); return; }
      var sizeStr = typeof o.fontSize === 'number' ? o.fontSize + 'px' : o.fontSize;
      var fam = o.fontFamily === 'inherit'
        ? (getComputedStyle(el).fontFamily || 'sans-serif') : o.fontFamily;
      /* load() wants a resolvable size; a clamp() is not one, so probe for px */
      var px = parseFloat(sizeStr);
      if (isNaN(px)) {
        var probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;font-size:' + sizeStr;
        el.appendChild(probe);
        px = parseFloat(getComputedStyle(probe).fontSize) || 32;
        probe.remove();
      }
      document.fonts.load(o.fontWeight + ' ' + px + 'px ' + fam)
        .catch(function () {})
        .then(function () { if (!cancelled) fn(); });
    }

    whenReady(function () {
      build();
      /* Draw the word once, whatever happens next. The animation loop is what
         normally puts it on the canvas, and play() refuses to start it when
         the element is off screen, the tab is in the background, or the thing
         has been parked -- so building without this leaves an empty canvas and
         the word simply missing. Open the site in a background tab and the
         hero had no name until you looked at it. When the loop does run, its
         first frame overwrites this immediately; the cost is one drawImage. */
      drawStill();
      if (!calm) play();
    });
    if (o.glitchMode && !calm) startGlitch();

    if (o.enableHover && !calm) {
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('mouseleave', onLeave);
      canvas.addEventListener('touchmove', onMove, { passive: true });
      canvas.addEventListener('touchend', onLeave);
    }
    if (o.clickEffect && !calm) canvas.addEventListener('click', onClick);

    /* nothing should be drawing off screen or in a background tab */
    var io = null;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (es) {
        onScreen = es[0] ? es[0].isIntersecting : true;
        onScreen ? play() : stop();
      });
      io.observe(canvas);
    }
    function onVis() { pageVisible = !document.hidden; pageVisible ? play() : stop(); }
    document.addEventListener('visibilitychange', onVis);

    var rt;
    function onResize() {
      clearTimeout(rt);
      /* and again after a rebuild, for the same reason: a resize while the tab
         is hidden used to clear the canvas and leave it cleared */
      rt = setTimeout(function () { build(); drawStill(); if (!calm) play(); }, 180);
    }
    addEventListener('resize', onResize);

    var inst = {
      el: canvas,
      /* The observer above only knows whether the canvas is on screen, which
         is not the same as whether anything can see it: on the homepage the
         hero is held at the top of the scroll and is covered rather than
         scrolled away, so it never stops intersecting. A caller that knows
         better can park it. */
      setParked: function (v) { parked = !!v; parked ? stop() : play(); },
      destroy: function () {
        cancelled = true;
        stop();
        clearTimeout(glitchT); clearTimeout(glitchEndT);
        clearTimeout(clickT); clearTimeout(rt);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        removeEventListener('resize', onResize);
        canvas.remove();
        el.textContent = text;
      }
    };
    mounted.push(inst);
    return inst;
  }

  var mounted = [];

  function auto() {
    var out = [];
    document.querySelectorAll('[data-fuzzy]').forEach(function (el) {
      if (el.dataset.fuzzyMounted) return;
      el.dataset.fuzzyMounted = '1';
      var d = el.dataset;
      out.push(mount(el, {
        /* a bare number in the attribute is pixels; anything else is passed
           through as CSS. Without this it reaches canvas as the string "128",
           which is not a valid font size, and the whole thing silently falls
           back to 10px sans-serif. */
        fontSize: d.fuzzySize
          ? (/^-?\d*\.?\d+$/.test(d.fuzzySize.trim()) ? parseFloat(d.fuzzySize) : d.fuzzySize)
          : undefined,
        fontWeight: d.fuzzyWeight ? num(d.fuzzyWeight, 900) : undefined,
        fontFamily: d.fuzzyFamily || undefined,
        color: d.fuzzyColor || undefined,
        baseIntensity: d.fuzzyBase !== undefined ? num(d.fuzzyBase, 0.18) : undefined,
        hoverIntensity: d.fuzzyHover !== undefined ? num(d.fuzzyHover, 0.5) : undefined,
        fuzzRange: d.fuzzyRange !== undefined ? num(d.fuzzyRange, 30) : undefined,
        fps: d.fuzzyFps !== undefined ? num(d.fuzzyFps, 60) : undefined,
        direction: d.fuzzyDirection || undefined,
        transitionDuration: d.fuzzyTransition !== undefined ? num(d.fuzzyTransition, 0) : undefined,
        clickEffect: d.fuzzyClick === 'true' ? true : undefined,
        glitchMode: d.fuzzyGlitch === 'true' ? true : undefined,
        letterSpacing: d.fuzzySpacing !== undefined ? num(d.fuzzySpacing, 0) : undefined,
        gradient: d.fuzzyGradient ? d.fuzzyGradient.split(',') : undefined,
        enableHover: d.fuzzyEnableHover === 'false' ? false : undefined
      }));
    });
    return out;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  global.FuzzyText = {
    mount: mount, auto: auto, DEFAULTS: DEFAULTS,
    /* Scoped on purpose. Parking everything on the page took the contact
       email's fuzz with it: it is the same effect, far down the page, and it
       has nothing to do with whatever is covering the hero. */
    park: function (root, v) {
      mounted.forEach(function (m) {
        if (!root || root.contains(m.el)) m.setParked(v);
      });
    }
  };
})(window);
