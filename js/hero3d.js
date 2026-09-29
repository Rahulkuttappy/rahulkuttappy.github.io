/* ── HERO: THE LENS ──────────────────────────────────────────────────────
   A shallow camera lens assembly sitting in the hero's negative space: a
   barrel, two machined rings, a rotary shutter that opens on load, and the
   mark floating at the centre catching one slow sweep of light.

   It runs only where it earns its place. main.js decides that (wide screen,
   a real pointer, motion allowed) and injects Three before this file, so a
   phone, a reduced-motion visitor or a blocked CDN simply never loads it and
   the hero stays exactly as it was.

   No post-processing: the page already lays animated film grain over this
   canvas, which does the atmospheric work for nothing. */
(function(){
  if(!window.THREE) return;
  const canvas = document.getElementById('hero3d');
  const hero   = document.getElementById('hero');
  if(!canvas || !hero) return;

  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'high-performance'});
  }catch(e){ return; }                 /* no WebGL: the hero is fine without it */

  const BRAND = {
    off:  0xEDEAE2,
    red:  0xC4362E,   /* the site's red, lifted for light rather than paint */
    metal:0x101010
  };

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const rig = new THREE.Group();        /* everything the pointer nudges */
  scene.add(rig);

  const lens = new THREE.Group();       /* the assembly itself */
  lens.rotation.set(-0.12, 0.34, 0.06); /* seen slightly from above and to the left */
  rig.add(lens);

  /* ── materials ── */
  const metal = new THREE.MeshStandardMaterial({
    color:BRAND.metal, metalness:.92, roughness:.34, transparent:true, opacity:0
  });
  const metalDark = new THREE.MeshStandardMaterial({
    color:0x080808, metalness:.7, roughness:.55, transparent:true, opacity:0
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color:0x0b0b0b, metalness:.85, roughness:.4, side:THREE.DoubleSide,
    transparent:true, opacity:0
  });
  const fadeable = [metal, metalDark, bladeMat];

  /* ── barrel and rings ── */
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(2.05, 2.05, 1.5, 64, 1, true), metalDark
  );
  barrel.rotation.x = Math.PI/2;
  barrel.position.z = -0.8;
  lens.add(barrel);

  const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.075, 12, 80), metal);
  const ringMid   = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.045, 10, 70), metal);
  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.03, 8, 60), metal);
  ringMid.position.z = -0.18;
  ringInner.position.z = 0.1;
  lens.add(ringOuter, ringMid, ringInner);

  /* Knurling on the focus ring: short bars around the barrel, one instanced
     mesh rather than forty of them, so it stays a single draw call. */
  const KNURL = 44;
  const knurl = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 0.3, 0.05), metal, KNURL
  );
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for(let i=0;i<KNURL;i++){
    const a = (i/KNURL)*Math.PI*2;
    e.set(0, 0, a); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a)*2.42, Math.sin(a)*2.42, -0.2), q, new THREE.Vector3(1,1,1));
    knurl.setMatrixAt(i, m4);
  }
  knurl.instanceMatrix.needsUpdate = true;
  lens.add(knurl);

  /* ── the shutter ──
     Eight blades on a shared hub. Closed, they overlap across the opening;
     opening swings each one back on its own pivot, which is how a real iris
     behaves and why it reads as a mechanism rather than a spinning disc. */
  const BLADES = 8;
  const hub = new THREE.Group();
  hub.position.z = -0.1;
  lens.add(hub);

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(1.75, 0.04);
  bladeShape.quadraticCurveTo(2.0, 0.85, 1.12, 1.42);
  bladeShape.lineTo(0.06, 0.42);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth:0.035, bevelEnabled:false, curveSegments:6
  });

  const pivots = [];
  for(let i=0;i<BLADES;i++){
    const pivot = new THREE.Object3D();
    pivot.rotation.z = (i/BLADES)*Math.PI*2;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0.55, -0.62, i*0.004);   /* stagger, so they stack like real blades */
    pivot.add(blade);
    hub.add(pivot);
    pivots.push(blade);
  }

  /* ── the mark ──
     Three stacked copies of the logo, each dimmer and further back, read as
     depth without needing a path to extrude. The sweep is an additive plane
     masked to the same alpha, so light appears to cross the metal. */
  const markGroup = new THREE.Group();
  markGroup.position.z = 0.55;
  lens.add(markGroup);

  const loader = new THREE.TextureLoader();
  let sweepMat = null;
  loader.load('assets/images/logo.png', tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const W = 1.5, H = W * (256/400);
    for(let i=0;i<3;i++){
      const m = new THREE.MeshBasicMaterial({
        map:tex, transparent:true, opacity:0,
        color:i===0 ? BRAND.off : 0x2a2a2a, depthWrite:false
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m);
      plate.position.z = -i*0.045;
      plate.userData.base = i===0 ? 0.92 : 0.5 - i*0.16;
      markGroup.add(plate);
      fadeable.push(m);
    }
    sweepMat = new THREE.MeshBasicMaterial({
      map:tex, transparent:true, opacity:0, color:BRAND.off,
      blending:THREE.AdditiveBlending, depthWrite:false
    });
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(W, H), sweepMat);
    sweep.position.z = 0.02;
    markGroup.add(sweep);
  });

  /* ── dust in the light ── */
  const MOTES = 120;
  const dustPos = new Float32Array(MOTES*3);
  for(let i=0;i<MOTES;i++){
    dustPos[i*3]   = (Math.random()-0.5)*14;
    dustPos[i*3+1] = (Math.random()-0.5)*9;
    dustPos[i*3+2] = (Math.random()-0.5)*6 + 1;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color:BRAND.off, size:0.035, transparent:true, opacity:0, depthWrite:false
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  rig.add(dust);

  /* ── light: one cool key, one red rim, almost no fill ── */
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-4, 3.5, 6);
  const rim = new THREE.PointLight(BRAND.red, 38, 22, 2);
  rim.position.set(3.4, -1.6, -2.2);
  const fill = new THREE.AmbientLight(0x404040, 0.55);
  scene.add(key, rim, fill);

  /* ── layout: the lens sits right of centre, where the panel fades out ── */
  function layout(){
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h, false);     /* false: the CSS box is pinned above */
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    const wide = w/h > 1.1;
    lens.position.set(wide ? 4.6 : 2.4, wide ? 0.35 : 1.9, 0);
    lens.scale.setScalar(wide ? 1 : 0.78);
  }

  /* ── state ── */
  let iris = 0;          /* 0 shut, 1 open */
  let entrance = 0;      /* 0 → 1 over the opening beat */
  let sweepT = -1;       /* the light crossing the mark, once */
  let exit = 0;          /* scroll: how far the hero has left */
  let px = 0, py = 0, tx = 0, ty = 0;
  let raf = 0, visible = true, started = 0;

  const CLOSED = { rot:-0.92, x:0.55,  y:-0.62 };
  const OPEN   = { rot: 0.46, x:1.28,  y:-1.32 };
  const lerp = (a,b,t)=>a+(b-a)*t;
  const easeOut = t => 1-Math.pow(1-t, 3);

  function frame(now){
    raf = 0;
    if(!started) started = now;
    const t = (now-started)/1000;

    /* entrance: the assembly settles, then the shutter opens */
    entrance = Math.min(1, t/0.9);
    const eIn = easeOut(entrance);
    iris = Math.max(0, Math.min(1, (t-0.55)/1.15));
    const eIris = easeOut(iris);

    fadeable.forEach(m=>{
      const base = m === bladeMat ? 1 : (m.userData && m.userData.base) || 1;
      m.opacity = eIn * (m.map ? 1 : 1) * base;
    });
    markGroup.children.forEach(ch=>{
      if(ch.material && ch.material !== sweepMat && ch.userData.base!==undefined){
        ch.material.opacity = eIn * ch.userData.base * (0.35 + 0.65*eIris);
      }
    });
    dustMat.opacity = eIn * 0.5;

    /* the sweep crosses once, after the shutter is open */
    if(sweepMat){
      if(sweepT < 0 && iris > 0.85) sweepT = 0;
      if(sweepT >= 0 && sweepT < 1){
        sweepT += 0.012;
        const s = Math.sin(Math.PI * Math.min(1, sweepT));
        sweepMat.opacity = s * 0.5;
        markGroup.position.x = (sweepT-0.5) * 0.06;
      }else if(sweepT >= 1){
        sweepMat.opacity = 0;
        markGroup.position.x = 0;
      }
    }

    /* blades swing back on their pivots; exit closes them again */
    const open = eIris * (1-exit);
    pivots.forEach((b,i)=>{
      b.rotation.z = lerp(CLOSED.rot, OPEN.rot, open);
      b.position.x = lerp(CLOSED.x,   OPEN.x,   open);
      b.position.y = lerp(CLOSED.y,   OPEN.y,   open);
      b.position.z = i*0.004;
    });

    /* pointer: a degree or two, damped, with the rings lagging behind */
    px += (tx-px)*0.045;
    py += (ty-py)*0.045;
    rig.rotation.y = px*0.10;
    rig.rotation.x = -py*0.07;
    lens.rotation.z = 0.06 + px*0.03 + Math.sin(t*0.22)*0.012;
    ringOuter.rotation.z =  t*0.05 - px*0.05;
    ringMid.rotation.z   = -t*0.07 + px*0.04;
    knurl.rotation.z     =  t*0.03;
    hub.rotation.z       = -t*0.02 + eIris*0.22;

    /* scroll: dolly in a little and let the hero go */
    camera.position.z = 13 - exit*2.4;
    rig.position.y    = exit*1.4;
    rig.position.z    = exit*1.2;

    /* dust drifts up through the beam and wraps */
    const p = dustGeo.attributes.position.array;
    for(let i=0;i<MOTES;i++){
      p[i*3+1] += 0.0016 + (i%5)*0.0004;
      if(p[i*3+1] > 4.6) p[i*3+1] = -4.6;
    }
    dustGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    if(visible) raf = requestAnimationFrame(frame);
  }

  function start(){ if(!raf && visible) raf = requestAnimationFrame(frame); }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf = 0; } }

  /* pointer lives on the window, but the canvas never takes events: the nav,
     the links and text selection are untouched */
  window.addEventListener('pointermove', ev=>{
    tx = (ev.clientX/window.innerWidth - 0.5)*2;
    ty = (ev.clientY/window.innerHeight - 0.5)*2;
  }, {passive:true});

  /* nothing renders while the hero is off screen or the tab is hidden */
  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>{
      visible = es[0].isIntersecting;
      visible ? start() : stop();
    }, {threshold:0.01}).observe(hero);
  }
  document.addEventListener('visibilitychange', ()=>{
    visible = !document.hidden && hero.getBoundingClientRect().bottom > 0;
    visible ? start() : stop();
  });

  let rt;
  window.addEventListener('resize', ()=>{ clearTimeout(rt); rt = setTimeout(layout, 160); });

  /* scroll hands `exit` over; ScrollTrigger if it is here, plain scroll if not */
  if(window.gsap && window.ScrollTrigger && ScrollTrigger.create){
    ScrollTrigger.create({
      trigger:'#hero', start:'top top', end:'bottom top', scrub:true,
      onUpdate:s=>{ exit = s.progress; }
    });
  }else{
    window.addEventListener('scroll', ()=>{
      exit = Math.min(1, window.scrollY / Math.max(1, hero.offsetHeight));
    }, {passive:true});
  }

  /* give everything back if the page is being left */
  window.addEventListener('pagehide', ()=>{
    stop();
    scene.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
      if(o.material){
        const list = Array.isArray(o.material) ? o.material : [o.material];
        list.forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); });
      }
    });
    renderer.dispose();
  });

  layout();
  start();
  canvas.classList.add('is-live');
})();
