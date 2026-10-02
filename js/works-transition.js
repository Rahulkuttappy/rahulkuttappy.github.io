/* ── Hero → Selected Works ────────────────────────────────────────────────
   The hero is held at the top of the stage while the frame it draws opens
   out to full bleed. What the opening reveals is the works list, scaled
   fractionally down into place, with a blueprint of its own rules drawn over
   it by the four orbs that were already sitting on the frame.

   The whole thing is scrubbed from the scroll: there is no timeline of its
   own, so it runs forward and backward and stops wherever the reader stops.

   Prototyped as a scratch page, _hero-transition.html, which is no longer in
   the tree -- `git show 0a20f73:_hero-transition.html` has the last of it.
   The working notes for each decision were kept there and the ones that still
   matter have been carried into the comments below. This is the same
   choreography attached to the real hero and the real list.
   ────────────────────────────────────────────────────────────────────────── */
(function(){
'use strict';

const stage = document.getElementById('xstage');
const over  = document.getElementById('xover');
const frame = document.getElementById('xframe');
const heroL = document.getElementById('xhero');
const works = document.getElementById('works');
const worksIn = document.getElementById('worksIn');
const fx    = document.getElementById('xtrail');
const orbEl = document.getElementById('xorb');
if(!stage || !over || !frame || !heroL || !works || !worksIn || !fx || !orbEl) return;

const grid  = frame.querySelector('.hero-grid');
const dots  = grid ? [...grid.querySelectorAll('.hg-dot')] : [];        /* tl tr bl br */
const lines = ['.hg-t','.hg-r','.hg-b','.hg-l'].map(s=>grid && grid.querySelector(s));
const hdr   = works.querySelector('.works-hdr');
const hed   = works.querySelector('.works-hed');
const toggle= works.querySelector('.view-toggle');
const wgrid = document.getElementById('wgrid');
if(!grid || dots.length < 4 || !lines[3] || !hed || !wgrid) return;

const fctx = fx.getContext('2d');
let cards = [...wgrid.querySelectorAll('.wc')];

const lerp    = (a,b,k)=>a+(b-a)*k;
const clamp01 = v => v<0?0:v>1?1:v;

/* how much scroll the transition is spread across, as a share of the window */
const SPAN = 1.6;

let W=0, H=0, TR=0, box=null, base=null, dpr=1;
let hLines=[], vLines=[], visibleRows=0, lastP=0;
let running=false, painting=false, trigger=null, fontsWatched=false, heroCovered=false;

/* how long the staggers get to run in total, however many rules there are */
const BIRTH_SPAN = .20, JOIN_SPAN = .18;
/* where the last rule has finished connecting -- the frame has to be able to
   show a rule by here or it is never seen */
const DRAWN_BY = .80;
let tierBirth = .05, tierJoin = .045;


/* ── the heading ──────────────────────────────────────────────────────────
   The section's own heading, left as it is. It was briefly drawn instead: an
   SVG outline that inked itself on letter by letter, then a wipe that flooded
   the letterforms. At the prototype's size the outline read as the edge of
   the fill; at the 64px this heading is actually set in it read as a second
   heading in red sitting behind the white one, and its box sat the rows and
   the count out of line with it. What animates here is the count and the
   view toggle, both of which the heading already had. */
let countEl = null;

function buildTitle(){
  if(!countEl) countEl = hed.querySelector('em');
}

function paintTitle(p){
  /* the tally runs up as the rows are outlined and lands on the real figure */
  if(countEl){
    const k = clamp01((p - .52) / .18);
    countEl.textContent = '(' + String(Math.round(k*cards.length)).padStart(2,'0') + ')';
  }
  /* the heading arrives with the section rather than ahead of it */
  hed.style.opacity = String(clamp01((p - .46) / .12));
  if(toggle) toggle.style.opacity = String(clamp01((p - .72) / .10));
}


/* ── the monogram ─────────────────────────────────────────────────────────
   One full cycle of the ring, scrubbed rather than left to real time: the
   mark pulses at .32, so a cycle is 1000/.32 milliseconds, and mapping the
   hold onto that means the loop completes exactly once however fast the page
   is scrolled instead of being cut short by a flick of the wheel. */
const ORB_CYCLE_MS = 1000 / .32;
let midOrb = null;

function paintOrb(p){
  /* It does not move. A wipe travels across it left to right to bring it in,
     and another follows to take it away, so the mark itself is only ever
     still -- scaling it in and out fought the stillness of everything else on
     the frame. */
  const inK  = clamp01((p - .12) / .10);
  const outK = clamp01((p - .34) / .08);
  orbEl.style.clipPath = 'inset(0 ' + ((1-inK)*100).toFixed(1) + '% 0 ' + (outK*100).toFixed(1) + '%)';
  const show = (inK > 0 && outK < 1) ? 1 : 0;
  orbEl.style.opacity = String(show);
  if(midOrb){
    /* The mark is gone at .42; the innermost tier does not start connecting
       until .46 and still has to cross half the frame to reach the centre, so
       the earliest a rule can lie over it is about .52 whatever the window
       is. It is never drawn through. */
    midOrb.setTime(clamp01((p - .12) / .22) * ORB_CYCLE_MS);
    midOrb.setPaused(!show);
  }
}


/* ── measuring ────────────────────────────────────────────────────────────*/
function measure(){
  W = frame.clientWidth; H = frame.clientHeight;
  TR = Math.round(H * SPAN);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  fx.width = Math.round(W*dpr); fx.height = Math.round(H*dpr);
  fctx.setTransform(dpr,0,0,dpr,0,0);
  fctx.lineCap='butt'; fctx.lineJoin='miter';
  box  = {l:lines[3].offsetLeft, r:lines[1].offsetLeft, t:lines[0].offsetTop, b:lines[2].offsetTop};
  base = lines.map((el,i)=>({
    cx: el.offsetLeft + el.offsetWidth/2,
    cy: el.offsetTop  + el.offsetHeight/2,
    vert: !!(i%2)
  }));
  /* the stage has to be long enough for the transition and then the whole
     list: the hero's own hundred is already in the flow, so only the
     remainder is added */
  stage.style.paddingBottom = Math.max(0, TR - H) + 'px';
  /* Title first. Turning the heading into an SVG changes the header's height,
     and the rules are measured from where the rows sit -- built the other way
     round, every rule is recorded a few pixels above where the row borders
     finally land, and the blueprint sits just off the list. */
  buildTitle();
  buildGrid();
  /* Bebas arriving resizes the heading, which moves every row under it, so
     the rules are measured again once the face is in rather than against the
     fallback's metrics. */
  if(!fontsWatched && document.fonts && document.fonts.ready){
    fontsWatched = true;
    document.fonts.ready.then(relayout).catch(()=>{});
  }
}

function relayout(){
  if(!running) return;
  measure();
  if(window.ScrollTrigger && ScrollTrigger.refresh) ScrollTrigger.refresh();
  apply(lastP);
}

/* ── the blueprint ────────────────────────────────────────────────────────
   A grid, not a scatter. Every row edge contributes a horizontal and the
   list's two sides contribute the verticals, so the rows come out as the
   cells between them. A line only ever moves along its own axis, and the
   dots live where two lines cross, so a dot can only ever travel on the
   grid. */
function buildGrid(){
  /* Measured where the transition puts the list, not where the flow leaves
     it. Untouched, the list sits a whole viewport lower -- below the hero --
     and every rule would be recorded that far down the frame. */
  const prev = worksIn.style.transform;
  worksIn.style.transform = 'none';
  works.style.top = (-H) + 'px';
  const vr = frame.getBoundingClientRect();
  const wr = worksIn.getBoundingClientRect();
  const xs = new Set(), ys = new Set();

  /* Only the rows the frame can show. A rule for a row below the fold would
     be drawn outside the frame, or clipped away and counted as drawn while
     never appearing -- the transition reveals the top of the list, not all of
     it. */
  /* Sub-pixel, because rounding to whole pixels is the last half pixel of
     drift between a rule and the border under it. Adjacent rows share an
     edge, but not to the decimal, so rounding used to be what merged them and
     without it every rule quietly doubled. They are merged by proximity
     instead. */
  /* Measured against the frame at the moment the drawing finishes, not
     against the window. The frame is only full bleed at the very end, and by
     then everything is already fading out -- so a row that merely fits on
     screen can still have its rule drawn below the frame's bottom edge and
     clipped away for the whole of the sequence. It was scheduled, it took up
     a tier, and it was never once visible. */
  const zoomAt = lerp(1.18, 1, DRAWN_BY);
  const bAt    = lerp(box.b, H, DRAWN_BY);
  const shown = cards.filter(c=>{
    const r = c.getBoundingClientRect();
    if(r.height <= 0) return false;
    const edge = H/2 + ((r.bottom - vr.top) - H/2) * zoomAt;
    return edge <= bAt + 1;
  });
  visibleRows = shown.length;
  shown.forEach(c=>{
    const r = c.getBoundingClientRect();
    ys.add(r.top    - vr.top);
    ys.add(r.bottom - vr.top);
    xs.add(r.left   - vr.left);
    xs.add(r.right  - vr.left);
    /* deliberately not the title's own left edge: the titles are right
       aligned in an auto column, so every row starts somewhere different and
       the blueprint turns into a spreadsheet */
  });

  /* The targets are worked out as a scale about the middle of the frame, but
     a CSS scale() runs about the element's own centre. Those two only
     coincide by accident, which is why the rules landed on the row borders
     most of the time and drifted off them the rest. */
  worksIn.style.transformOrigin =
    (W/2 - (wr.left - vr.left)) + 'px ' + (H/2 - (wr.top - vr.top)) + 'px';
  worksIn.style.transform = prev;

  /* anything within a pixel and a half is the same edge seen twice */
  const merge = set => {
    const out = [];
    [...set].sort((a,b)=>a-b).forEach(v=>{
      if(!out.length || v - out[out.length-1] > 1.5) out.push(v);
      else out[out.length-1] = (out[out.length-1] + v) / 2;
    });
    return out;
  };
  const cy = H/2, cx = W/2;
  /* each new line peels off whichever frame edge it is nearer, so nothing
     ever crosses the frame to get where it is going */
  hLines = merge(ys).map(y => ({ y, fromTop:  y < cy }));
  vLines = merge(xs).map(x => ({ x, fromLeft: x < cx }));

  /* A stable scatter per line. Distance from the edge is mirror symmetric --
     the leftmost and rightmost share it exactly -- so on its own every line
     has a twin doing the same thing at the same moment and the grid moves in
     pairs. An integer hash rather than sin(i*k): with a single small
     multiplier, mirrored indices land on almost the same value, which is how
     a dozen supposedly distinct offsets still came out within four
     thousandths of each other. */
  const skew = (i, salt) => {
    let v = Math.imul(i + salt*101 + 1, 2654435761) >>> 0;
    v ^= v >>> 15; v = Math.imul(v, 2246822519) >>> 0;
    v ^= v >>> 13;
    return (v >>> 8) / 16777216;
  };
  const mark = (arr, salt) => {
    const n = arr.length;
    arr.forEach((ln,i)=>{
      ln.order = Math.min(i, n-1-i);            /* 0 at the outside */
      ln.skew  = skew(i, salt);
      /* the two axes are offset from each other, so a horizontal and a
         vertical never arrive on the same beat either */
      ln.axis  = salt === 1 ? 0 : .022;
    });
  };
  mark(hLines, 1); mark(vLines, 7);

  /* Connecting runs innermost first, so the outermost line is the last to
     close rather than the first. The depth it is measured against has to be
     the grid's, not each axis's own: with only two verticals every vertical
     is both outermost and innermost at once, so measured per axis they come
     out in the first tier and finish long before the reveal. */
  const deepest = Math.max(1, ...[...hLines, ...vLines].map(ln=>ln.order));
  /* The tiers are spread across a fixed span rather than given a fixed step
     each. With a step, more rows means more tiers means a longer sequence,
     and the last line is still being drawn after the list itself has
     appeared. Dividing a span by the depth keeps the whole choreography the
     same length whatever the section holds. */
  tierBirth = BIRTH_SPAN / deepest;
  tierJoin  = JOIN_SPAN  / deepest;

  [...hLines, ...vLines].forEach(ln=>{
    ln.joinOrder = deepest - ln.order;
    ln.birth     = ln.order * tierBirth + ln.skew * .03;
  });
  /* The topmost rule is the heading's own separator, which the section
     already draws under its title. It reads as belonging to the heading
     rather than to the grid, so it connects first and the rest of the drawing
     follows it. */
  if(hLines.length) hLines[0].joinOrder = -1;
}

/* The hairlines cross the whole frame rather than stopping at the corners,
   which is how the hero draws them: four full-bleed lines with a dot where
   each pair crosses. They only ever move, never shorten. */
function paintFrame(l,r,t,b){
  const pts = [{x:l,y:t},{x:r,y:t},{x:l,y:b},{x:r,y:b}];
  pts.forEach((p,i)=>{
    gsap.set(dots[i], {x: p.x - (dots[i].offsetLeft + dots[i].offsetWidth/2),
                       y: p.y - (dots[i].offsetTop  + dots[i].offsetHeight/2)});
  });
  gsap.set(lines[0], {x:0, y:t - base[0].cy, rotation:0, scaleX:1});   /* top    */
  gsap.set(lines[1], {x:r - base[1].cx, y:0, rotation:0, scaleY:1});   /* right  */
  gsap.set(lines[2], {x:0, y:b - base[2].cy, rotation:0, scaleX:1});   /* bottom */
  gsap.set(lines[3], {x:l - base[3].cx, y:0, rotation:0, scaleY:1});   /* left   */
}

const ease = v => v<.5 ? 4*v*v*v : 1 - Math.pow(-2*v+2,3)/2;    /* in-out cubic */

/* Where the list sits, and how much of it the frame is showing. Separate
   from the drawing because the page needs this much as soon as it is laid
   out -- otherwise the list stands a whole viewport lower until the hero has
   finished its entrance, and then jumps. The drawing has to wait for that
   entrance; the layout does not. */
function layout(p){
  if(!box) return;
  const l = lerp(box.l, 0, p), r = lerp(box.r, W, p);
  const t = lerp(box.t, 0, p), b = lerp(box.b, H, p);
  /* The list is held at the top of the frame for the whole of the opening and
     let go at the end, so the scroll that drives the transition is not also
     scrolling the list past it. Offset rather than transform: the header bar
     is sticky, and a transformed ancestor would give it something else to
     stick to. */
  works.style.top = (Math.min(p,1) * TR - H) + 'px';
  /* The clip goes on the section and the scale on the wrapper inside it.
     Both on one element and clip-path, which is applied in the element's own
     coordinates and then transformed along with it, is dragged out past the
     frame by the same 18% -- the section shows through above and to the left
     of the hairlines that are meant to be holding it in. */
  works.style.clipPath = p >= 1 ? 'none'
    : 'inset(' + t + 'px ' + (W-r) + 'px ' + (H-b) + 'px ' + l + 'px)';
  worksIn.style.transform = p >= 1 ? 'none' : 'scale(' + lerp(1.18, 1, p) + ')';
  works.style.opacity = String(Math.min(1, p*3.2));
  /* Clipped away is still clickable. The list sits above the hero and at the
     start it is a full-size, invisible sheet of links lying exactly over the
     hero's own words -- clicking the name opened a project. It only takes
     clicks once it is the thing on screen. */
  works.style.pointerEvents = p >= 1 ? '' : 'none';
  stage.classList.toggle('xs-running', p < 1);
  /* Nothing to play to behind a section that now covers it. The hero is held
     at the top of the scroll rather than scrolled past, so everything in it
     that pauses itself when it goes off screen never does: both video clips
     keep decoding and the two fuzzed words keep redrawing under the whole
     page. They are told. */
  const covered = p >= 1;
  heroL.style.visibility = covered ? 'hidden' : '';
  if(covered !== heroCovered){
    heroCovered = covered;
    if(window.HeroVideo) HeroVideo.set(!covered);
    if(window.FuzzyText && FuzzyText.parkAll) FuzzyText.parkAll(covered);
  }
  /* The hero's dust drifts across a canvas the size of the window, eighty
     motes redrawn every frame. It is there for the hero at rest; the moment
     the frame starts opening there is a second full-window canvas being drawn
     on and a whole section being scaled and clipped, and the three together
     cost about eight frames a second. So the drift stops as soon as the
     transition is moving and the field, still on screen, simply fades. Frozen
     and fading out over a quarter of the transition, it is not something you
     can catch stopping -- and it is the difference between 52fps with a fifth
     of the frames long, and 60 with none. */
  const dust = document.getElementById('hdust');
  if(dust) dust.style.opacity = String(1 - clamp01((p - .04) / .26));
  if(window.HeroDust) HeroDust.set(p < .04);

  const resolve = clamp01((p - .80) / .2);
  cards.forEach((c,i)=>{
    c.style.opacity = String(clamp01((resolve - (i%3)*.04) / .88));
  });
  lastP = p;
  return {l,r,t,b};
}

function apply(p){
  /* Moving at all means the reader is past the hero, so the entrance gives
     up its claim on the frame and jumps to its finished state rather than
     carrying on underneath a transition that is already drawing. */
  if(!painting && p > .002 && window.HeroEntrance && !HeroEntrance.done){
    HeroEntrance.finish();
  }
  const rect = layout(p);
  if(!rect || !painting) return;
  const l = rect.l, r = rect.r, t = rect.t, b = rect.b;
  paintFrame(l,r,t,b);

  paintTitle(p);

  const panel = document.getElementById('hcontent');
  if(panel){
    panel.style.transform = 'scale(' + lerp(1, 1.35, p) + ')';
    panel.style.opacity   = String(Math.max(0, 1 - p*1.9));
  }

  fctx.clearRect(0,0,W,H);
  /* The canvas covers the whole frame while the list is clipped to the
     rectangle, so without this the drawing spills past the mask and dots and
     half-drawn lines appear out over the hero. */
  fctx.save();
  fctx.beginPath();
  fctx.rect(l, t, r-l, b-t);
  fctx.clip();

  const leave = clamp01((p - .82) / .18);

  /* Every line is carried by two dots that live on the frame itself and
     travel along it -- a horizontal's pair run down the left and right edges,
     a vertical's pair along the top and bottom. Nothing leaves the outer
     layer. Only once both have arrived does the line strike across between
     them, which is the moment the frame stops being a boundary and becomes a
     drawing. */
  /* A dot sets off as soon as it appears, rather than being born on its tier
     and then waiting for a run that starts on a different schedule. */
  const runOf  = ln => ease(clamp01((p - ln.birth - .02) / .20));
  const joinOf = ln => clamp01((p - .46 - ln.joinOrder*tierJoin - ln.skew*.03 - ln.axis) / .09);

  hLines.forEach(ln=>{
    ln.on   = clamp01((p - ln.birth) / .06) * (1 - leave);
    ln.run  = runOf(ln);
    ln.py   = lerp(ln.fromTop ? t : b, H/2 + (ln.y - H/2) * lerp(1.18,1,p), ln.run);
    ln.join = joinOf(ln);
  });
  vLines.forEach(ln=>{
    ln.on   = clamp01((p - ln.birth) / .06) * (1 - leave);
    ln.run  = runOf(ln);
    ln.px   = lerp(ln.fromLeft ? l : r, W/2 + (ln.x - W/2) * lerp(1.18,1,p), ln.run);
    ln.join = joinOf(ln);
  });

  fctx.strokeStyle = 'rgb(237,234,226)';
  fctx.lineWidth = 1;
  /* Each line is drawn in one direction, from the dot it starts at to the dot
     it ends at -- verticals down the page, horizontals across it. Growing
     from both ends and meeting in the middle read as the line appearing
     rather than being drawn. */
  hLines.forEach(ln=>{
    if(ln.on <= .01 || ln.join <= .01) return;
    fctx.globalAlpha = ln.on * .45;
    fctx.beginPath(); fctx.moveTo(l, ln.py); fctx.lineTo(lerp(l, r, ln.join), ln.py); fctx.stroke();
  });
  vLines.forEach(ln=>{
    if(ln.on <= .01 || ln.join <= .01) return;
    fctx.globalAlpha = ln.on * .45;
    fctx.beginPath(); fctx.moveTo(ln.px, t); fctx.lineTo(ln.px, lerp(t, b, ln.join)); fctx.stroke();
  });

  fctx.fillStyle = 'rgb(237,234,226)';
  /* The dots on the frame: two per line, always on an edge, sat one radius
     inside it rather than centred on it so the clip leaves them whole instead
     of shaving them in half. Faint while still running and full strength once
     home, so a dot in transit reads as on its way. */
  const R = 2;
  const lit = ln => ln.on * (.16 + .84 * ln.run * ln.run);
  hLines.forEach(ln=>{
    if(ln.on <= .01) return;
    fctx.globalAlpha = lit(ln);
    fctx.beginPath(); fctx.arc(l + R, ln.py, R, 0, Math.PI*2); fctx.fill();
    fctx.beginPath(); fctx.arc(r - R, ln.py, R, 0, Math.PI*2); fctx.fill();
  });
  vLines.forEach(ln=>{
    if(ln.on <= .01) return;
    fctx.globalAlpha = lit(ln);
    fctx.beginPath(); fctx.arc(ln.px, t + R, R, 0, Math.PI*2); fctx.fill();
    fctx.beginPath(); fctx.arc(ln.px, b - R, R, 0, Math.PI*2); fctx.fill();
  });

  /* and the crossings, which only exist once both lines have joined */
  vLines.forEach(v=>{
    hLines.forEach(h=>{
      const on = Math.min(v.on, h.on) * Math.min(v.join, h.join);
      if(on <= .02) return;
      fctx.globalAlpha = on;
      fctx.beginPath(); fctx.arc(v.px, h.py, 1.8, 0, Math.PI*2); fctx.fill();
    });
  });
  fctx.globalAlpha = 1;
  fctx.restore();

  /* The frame is the outermost layer of the drawing, not scaffolding under
     it, so it holds at full strength and leaves on the same beat as the rest
     rather than dimming away while the blueprint is still being made. */
  gsap.set(lines, {opacity: 1 - leave});
  gsap.set(dots,  {opacity: 1 - leave});

  paintOrb(p);
}


/* ── switching on ─────────────────────────────────────────────────────────
   Held back until the hero's own entrance has finished drawing the frame:
   the two write to the same four lines and the same four dots, and whichever
   ran second would win. */
function eligible(){
  return !!(window.gsap && window.ScrollTrigger)
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && window.matchMedia('(min-width: 861px)').matches;
}

/* Phase one: the stage takes its shape. Runs as soon as the page is laid
   out, so the list is already behind the frame rather than a viewport below
   it, and nothing moves when the entrance ends. */
function prepare(){
  if(running || !eligible()) return;
  running = true;
  stage.classList.add('xs-on');
  /* The rows keep the site's ordinary scroll reveal for everyone the
     transition is not running for. Here it would fight the resolve at the end
     of the drawing, so the class comes off -- before main.js goes looking for
     it, which is why this script is loaded first. */
  cards.forEach(c=>c.classList.remove('reveal'));
  measure();
  layout(0);
  /* Armed from the start rather than when the entrance finishes. It used to
     be created at the end of the hero's own animation, which left a two and a
     half second window on every refresh where the page scrolled and nothing
     was listening -- the reader arrived in the middle of a transition that
     had never been told it had begun. */
  trigger = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => '+=' + TR,
    scrub: true,
    onUpdate: self => apply(self.progress)
  });
}

/* Phase two: the drawing. Held back until the hero's own entrance has
   finished, because the two write to the same four lines and the same four
   dots and whichever ran second would win. */
function enable(){
  if(!running || painting) return;
  painting = true;
  if(window.BrandOrbs && !midOrb){
    midOrb = BrandOrbs.mount(orbEl, {variant:'rk', size:'medium', bg:'none'});
  }
  measure();
  apply(lastP);
  ScrollTrigger.refresh();
}

/* The nav's own link points at the list, whose box is still where it always
   was -- a whole viewport further down than where the transition leaves it.
   The link should land on the end of the transition, which is the first
   moment the list is whole.

   stopPropagation as well as preventDefault: Lenis handles anchors itself,
   from a listener on the document, and it does not check whether anyone has
   already dealt with the click. Without this the smooth scroll starts and is
   immediately overruled, and the link lands back at the top of the page. */
/* Lenis is declared with let in main.js, which makes a global binding but not
   a property of window -- so window.lenis is not the instance, and reaching
   for it falls through to window.scrollTo, which Lenis owns and promptly
   overrules. The binding itself is reachable; the typeof guard is for pages
   that do not have one, and the shape is checked because window.lenis is
   something else again -- truthy, and without a scrollTo. */
function smooth(){
  let it = null;
  try { if(typeof lenis !== 'undefined') it = lenis; } catch(e){}
  if(!it) it = window.lenis;
  return (it && typeof it.scrollTo === 'function') ? it : null;
}

function bindAnchor(){
  document.querySelectorAll('a[href="#works"]').forEach(a=>{
    a.addEventListener('click', e=>{
      if(!running) return;
      e.preventDefault();
      e.stopPropagation();
      const y = stage.getBoundingClientRect().top + window.scrollY + TR;
      if(smooth()) smooth().scrollTo(y);
      else window.scrollTo({top:y, behavior:'smooth'});
    });
  });
}
bindAnchor();

/* the grid view has a different geometry, so the blueprint is remeasured
   against whichever one is showing */
[document.getElementById('gbtn'), document.getElementById('lbtn')].forEach(b=>{
  if(b) b.addEventListener('click', ()=>setTimeout(relayout, 0));
});

let rt;
window.addEventListener('resize', ()=>{
  clearTimeout(rt);
  rt = setTimeout(()=>{
    if(!running) return;
    if(!eligible()){ disable(); return; }
    relayout();
  }, 180);
});

/* Narrowed past the breakpoint, or motion turned off mid-visit: everything
   the script wrote is handed back, and the page is the ordinary one the
   stylesheet describes. */
function disable(){
  if(!running) return;
  running = painting = false;
  if(trigger){ trigger.kill(); trigger = null; }
  stage.classList.remove('xs-on','xs-running');
  ['top','clipPath','opacity','pointerEvents'].forEach(k=>works.style[k]='');
  ['transform','transformOrigin'].forEach(k=>worksIn.style[k]='');
  heroL.style.visibility = '';
  heroCovered = false;
  if(window.HeroVideo) HeroVideo.set(true);
  if(window.FuzzyText && FuzzyText.parkAll) FuzzyText.parkAll(false);
  stage.style.paddingBottom = '';
  const dust = document.getElementById('hdust');
  if(dust) dust.style.opacity = '';
  if(window.HeroDust) HeroDust.set(true);
  cards.forEach(c=>c.style.opacity = '');
  hed.style.opacity = '';
  if(toggle) toggle.style.opacity = '';
  if(countEl) countEl.textContent = '(' + String(cards.length).padStart(2,'0') + ')';
  orbEl.style.opacity = '0';
  if(midOrb) midOrb.setPaused(true);
  fctx.clearRect(0,0,W,H);
  const panel = document.getElementById('hcontent');
  if(panel){ panel.style.transform=''; panel.style.opacity=''; }
}

window.WorksTransition = { prepare, enable, disable, relayout, eligible };
prepare();
})();
