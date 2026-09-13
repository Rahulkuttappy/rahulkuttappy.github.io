gsap.registerPlugin(ScrollTrigger);

/* Always land at the top of the page (unless an anchor was requested) */
if('scrollRestoration' in history) history.scrollRestoration='manual';
window.addEventListener('pageshow',()=>{ if(!location.hash) window.scrollTo(0,0); });
if(!location.hash) window.scrollTo(0,0);

/* Logo click returns to the top */
const navLogoLink=document.getElementById('navLogoLink');
if(navLogoLink){
  navLogoLink.addEventListener('click',e=>{
    e.preventDefault();
    window.scrollTo({top:0,behavior:'smooth'});
  });
}

/* Clock */
function tick(){const c=document.getElementById('clock'); if(c) c.textContent=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Kolkata'});}
tick();setInterval(tick,1000);

/* ── Page transitions ── */
const pageFade=document.getElementById('pageFade');
if(pageFade){
  requestAnimationFrame(()=>requestAnimationFrame(()=>pageFade.classList.add('ready')));

  const isInternal=a=>{
    const href=a.getAttribute('href');
    if(!href) return false;
    if(a.target==='_blank') return false;
    if(href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')) return false;
    if(/^https?:\/\//i.test(href)) return false;
    return /\.html?($|[?#])/i.test(href)||href.endsWith('/');
  };

  document.querySelectorAll('a').forEach(a=>{
    if(!isInternal(a)) return;
    a.addEventListener('click',e=>{
      if(e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0) return;
      e.preventDefault();
      const dest=a.getAttribute('href');
      saveAudioState();
      pageFade.classList.remove('ready');
      pageFade.classList.add('leaving');
      setTimeout(()=>{window.location.href=dest;},430);
    });
  });

  /* Coming back via the browser's back button should not leave the veil up */
  window.addEventListener('pageshow',e=>{
    if(e.persisted){pageFade.classList.remove('leaving');pageFade.classList.add('ready');}
  });
}

/* ── Background music + dithered visualizer ── */
const bgm=document.getElementById('bgm');
const audioDock=document.getElementById('audioDock');
const vizCanvas=document.getElementById('vizCanvas');
const audioToggle=document.getElementById('audioToggle');
const audioVol=document.getElementById('audioVol');
const AUDIO_KEY='rk_audio';
let audioCtx=null,analyser=null,freqData=null;

function readAudioState(){
  try{ return JSON.parse(sessionStorage.getItem(AUDIO_KEY)||'{}'); }catch(e){ return {}; }
}
/* `want` is the user's intent and only changes when they ask for it.
   A browser blocking autoplay on a fresh page must not erase that. */
let audioWant=false;
function saveAudioState(){
  if(!bgm) return;
  try{
    sessionStorage.setItem(AUDIO_KEY,JSON.stringify({
      want: audioWant,
      vol: bgm.volume,
      t: bgm.currentTime||0
    }));
  }catch(e){}
}

function setupAnalyser(){
  if(audioCtx||!bgm) return;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return;
  try{
    audioCtx=new AC();
    const src=audioCtx.createMediaElementSource(bgm);
    analyser=audioCtx.createAnalyser();
    analyser.fftSize=128;
    analyser.smoothingTimeConstant=.78;
    freqData=new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
  }catch(e){ analyser=null; }
}

function updateToggleLabel(){
  if(!audioToggle||!bgm) return;
  audioToggle.textContent = (!bgm.paused) ? 'Sound On' : (audioWant ? 'Resume' : 'Sound Off');
}

function playAudio(userInitiated){
  if(!bgm) return;
  if(userInitiated!==false) audioWant=true;
  setupAnalyser();
  if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
  const p=bgm.play();
  if(p&&p.catch) p.catch(()=>{ armAutoplayRetry(); });
  updateToggleLabel();
  saveAudioState();
}
function pauseAudio(){
  if(!bgm) return;
  audioWant=false;
  bgm.pause();
  updateToggleLabel();
  saveAudioState();
}

/* Autoplay is blocked on a fresh document until the visitor interacts,
   so retry once on their first gesture. */
let retryArmed=false;
function armAutoplayRetry(){
  if(retryArmed||!bgm) return;
  retryArmed=true;
  const retry=()=>{
    if(!audioWant) return;
    setupAnalyser();
    if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
    const p=bgm.play();
    if(p&&p.catch) p.catch(()=>{});
  };
  ['pointerdown','keydown','wheel','touchstart'].forEach(ev=>
    window.addEventListener(ev,retry,{once:true,passive:true})
  );
}

if(bgm&&audioDock){
  const st=readAudioState();
  bgm.volume = typeof st.vol==='number' ? st.vol : 0.12;
  audioWant = !!st.want;
  if(audioVol) audioVol.value=String(bgm.volume);

  if(audioToggle){
    audioToggle.addEventListener('click',()=>{ bgm.paused ? playAudio() : pauseAudio(); });
  }

  /* Pressing the visualizer reveals the volume controls */
  const vizBtn=document.getElementById('vizBtn');
  if(vizBtn){
    vizBtn.addEventListener('click',e=>{
      e.stopPropagation();
      audioDock.classList.toggle('open');
    });
    document.addEventListener('click',e=>{
      if(!audioDock.contains(e.target)) audioDock.classList.remove('open');
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape') audioDock.classList.remove('open');
    });
  }
  if(audioVol){
    audioVol.addEventListener('input',()=>{
      bgm.volume=parseFloat(audioVol.value);
      if(bgm.volume>0&&bgm.paused&&audioWant) playAudio();
      saveAudioState();
    });
  }
  bgm.addEventListener('play',updateToggleLabel);
  bgm.addEventListener('pause',updateToggleLabel);
  let lastSave=0;
  bgm.addEventListener('timeupdate',()=>{
    const now=Date.now();
    if(!bgm.paused&&now-lastSave>1500){ lastSave=now; saveAudioState(); }
  });
  window.addEventListener('pagehide',saveAudioState);
  window.addEventListener('beforeunload',saveAudioState);

  /* Resume across page navigations */
  if(audioWant){
    if(st.t){ try{ bgm.currentTime=st.t; }catch(e){} }
    audioDock.classList.add('show');
    playAudio(false);
  }else if(st.vol!==undefined){
    audioDock.classList.add('show');
  }
  updateToggleLabel();

  /* No loader on this page (project/about pages): reveal the dock right away */
  if(!document.getElementById('loader')) audioDock.classList.add('show');
}

/* Dithered visualizer — ordered 4x4 Bayer dither over a frequency field */
if(vizCanvas){
  const vctx=vizCanvas.getContext('2d');
  const PW=40, PH=14;           /* internal pixel grid */
  vizCanvas.width=PW; vizCanvas.height=PH;
  const BAYER=[
    [ 0, 8, 2,10],
    [12, 4,14, 6],
    [ 3,11, 1, 9],
    [15, 7,13, 5]
  ];
  const idle=new Array(PW).fill(0);
  let phase=0;

  function drawViz(){
    vctx.clearRect(0,0,PW,PH);
    const playing = bgm && !bgm.paused;
    let heights;

    if(playing&&analyser&&freqData){
      analyser.getByteFrequencyData(freqData);
      heights=[];
      const nBins=freqData.length;
      for(let x=0;x<PW;x++){
        const t=x/(PW-1);
        /* spread the useful band across the full width, then lift the highs
           so the bass does not swallow the left third */
        const bin=Math.min(nBins-1,Math.floor(Math.pow(t,0.7)*nBins*0.75));
        const boost=1+t*1.4;
        heights.push(Math.min(1.1,(freqData[bin]/255)*boost));
      }
    }else{
      /* gentle idle wave when paused */
      phase+=0.03;
      heights=idle.map((_,x)=>0.10+0.05*Math.sin(phase+x*0.35));
    }

    for(let x=0;x<PW;x++){
      const h=Math.max(0,Math.min(1,heights[x]));
      const topY=Math.round(PH-(h*PH));
      for(let y=0;y<PH;y++){
        if(y<topY) continue;
        /* intensity is strongest at the base, fading toward the bar top */
        const depth=(y-topY)/Math.max(1,(PH-topY));
        const intensity=0.35+depth*0.75;
        const threshold=(BAYER[y%4][x%4]+0.5)/16;
        if(intensity>threshold){
          const nearTop = y<=topY+1;
          vctx.fillStyle = nearTop ? 'rgba(160,40,32,0.95)' : 'rgba(237,234,226,0.82)';
          vctx.fillRect(x,y,1,1);
        }
      }
    }
    requestAnimationFrame(drawViz);
  }
  drawViz();
}

/* ── Cursor: glowing orb with fading streak trail ── */
const fx=document.getElementById('cursorFX');
const fxCtx=fx.getContext('2d');
let fxMx=innerWidth/2,fxMy=innerHeight/2,fxSx=fxMx,fxSy=fxMy;
let fxHover=false;
const trail=[];

function resizeFX(){
  fx.width=innerWidth*devicePixelRatio;
  fx.height=innerHeight*devicePixelRatio;
  fx.style.width=innerWidth+'px';
  fx.style.height=innerHeight+'px';
  fxCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeFX();
window.addEventListener('resize',resizeFX);

document.addEventListener('mousemove',e=>{
  fxMx=e.clientX;fxMy=e.clientY;
  trail.push({x:fxMx,y:fxMy,life:1});
  if(trail.length>40) trail.shift();
});

document.querySelectorAll('a,button,.photo-item').forEach(el=>{
  el.addEventListener('mouseenter',()=>{fxHover=true;});
  el.addEventListener('mouseleave',()=>{fxHover=false;});
});

function cursorLoop(){
  fxSx+=(fxMx-fxSx)*.18;
  fxSy+=(fxMy-fxSy)*.18;
  fxCtx.clearRect(0,0,innerWidth,innerHeight);

  for(let i=trail.length-1;i>=0;i--){
    const p=trail[i];
    p.life-=0.045;
    if(p.life<=0){trail.splice(i,1);continue;}
    fxCtx.beginPath();
    fxCtx.arc(p.x,p.y,2.4*p.life,0,Math.PI*2);
    fxCtx.fillStyle=`rgba(${'237,234,226'},${p.life*0.35})`;
    fxCtx.fill();
  }

  const r=fxHover?15:9;
  const grad=fxCtx.createRadialGradient(fxSx,fxSy,0,fxSx,fxSy,r*2.4);
  grad.addColorStop(0,'rgba(237,234,226,0.9)');
  grad.addColorStop(.35,`rgba(122,27,24,0.65)`);
  grad.addColorStop(1,'rgba(122,27,24,0)');
  fxCtx.beginPath();
  fxCtx.arc(fxSx,fxSy,r*2.4,0,Math.PI*2);
  fxCtx.fillStyle=grad;
  fxCtx.fill();

  fxCtx.beginPath();
  fxCtx.arc(fxSx,fxSy,r*.35,0,Math.PI*2);
  fxCtx.fillStyle='rgba(255,255,255,0.95)';
  fxCtx.fill();

  requestAnimationFrame(cursorLoop);
}
cursorLoop();

/* ── Scramble text reveal (futuristic decode effect) ── */
function scrambleReveal(el,finalText,opts={}){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>/[]{}#*';
  const stagger=opts.stagger??35;
  const speed=opts.speed??32;
  const letters=finalText.split('');
  el.innerHTML=letters.map(l=>`<span class="lc">${l===' '?'&nbsp;':l}</span>`).join('');
  const spans=el.querySelectorAll('.lc');
  spans.forEach((span,i)=>{
    if(letters[i]===' '){span.classList.add('in');return;}
    const maxIter=6+Math.floor(Math.random()*6);
    let iterations=0;
    setTimeout(()=>{
      const iv=setInterval(()=>{
        span.textContent=chars[Math.floor(Math.random()*chars.length)];
        iterations++;
        if(iterations>=maxIter){
          clearInterval(iv);
          span.textContent=letters[i];
          span.classList.add('in');
        }
      },speed);
    },i*stagger);
  });
}

/* ── Loader (digital text, no video, no autoplay dependency) — index.html only ── */
/* Shows once per browser session; skipped on subsequent visits to the home page */
const loaderEl=document.getElementById('loader');
const LOADER_SEEN_KEY='rk_seen_loader';

function revealHero(){
  const tl=gsap.timeline();
  tl.to('#hside',    {opacity:1,duration:.6,ease:'power2.out'})
    .to('#hcontent', {opacity:1,duration:.01}, '<')
    .to('.n1',       {y:'0%',duration:.9,ease:'power4.out'},   '<.1')
    .to('.n2',       {y:'0%',duration:.9,ease:'power4.out'},   '<.12')
    .to('#hrule',    {scaleX:1,duration:.5,ease:'power3.out'}, '-=.3')
    .to('.hero-bio', {opacity:1,duration:.6,ease:'power3.out'}, '-=.2')
    .to('#hscroll',  {opacity:1,duration:.5},                   '-=.2');
}

function showHeroInstantly(){
  gsap.set(['#hside','#hcontent','.hero-bio','#hscroll'],{opacity:1});
  gsap.set(['.n1','.n2'],{y:'0%'});
  gsap.set('#hrule',{scaleX:1});
}

if(loaderEl){
  let alreadySeen=false;
  try{ alreadySeen=sessionStorage.getItem(LOADER_SEEN_KEY)==='1'; }catch(e){}

  if(alreadySeen){
    loaderEl.remove();
    gsap.set('#nav',{opacity:1});
    showHeroInstantly();
  }else{
    const lenter=document.getElementById('lenter');
    const lpct=document.getElementById('lpct');
    const lpctWrap=lpct.parentElement;
    const loaderTextEl=document.getElementById('loaderText');

    /* Dithered progress bar: solid behind the head, breaking into ordered
       stipple across the leading edge, over a faint dotted track. */
    const lbar=document.getElementById('loaderBar');
    const LB_BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    let lbCtx=null,LB_W=0,LB_H=0,LB_BLK=2,lbImg=null;
    if(lbar&&lbar.getContext){
      lbCtx=lbar.getContext('2d');
      const r=lbar.getBoundingClientRect();
      LB_W=Math.max(24,Math.round((r.width||280)/LB_BLK));
      LB_H=Math.max(3,Math.round((r.height||12)/LB_BLK));
      lbar.width=LB_W;lbar.height=LB_H;
      lbar.style.width=(LB_W*LB_BLK)+'px';
      lbar.style.height=(LB_H*LB_BLK)+'px';
      lbImg=lbCtx.createImageData(LB_W,LB_H);
    }
    function drawLoaderBar(p,t){
      if(!lbCtx) return;
      const o=lbImg.data;
      const head=p*LB_W;
      for(let y=0;y<LB_H;y++){
        for(let x=0;x<LB_W;x++){
          const i=(y*LB_W+x)*4;
          const th=(LB_BAYER[y&3][x&3]+0.5)/16;
          /* fade the fill out over roughly six cells behind the head */
          let v=Math.max(0,Math.min(1,(head-x)/9));
          v*=0.93+0.07*Math.sin(t*0.006+x*0.7+y*1.3);
          if(v>th){
            const hot=Math.abs(x-head)<5;
            o[i]=hot?196:237;o[i+1]=hot?54:234;o[i+2]=hot?46:226;o[i+3]=255;
          }else{
            o[i]=237;o[i+1]=234;o[i+2]=226;
            o[i+3]=(LB_BAYER[y&3][x&3]<2)?30:0;   /* dotted track */
          }
        }
      }
      lbCtx.putImageData(lbImg,0,0);
    }

    if(loaderTextEl) scrambleReveal(loaderTextEl,'ARE YOU READY?');

    const showEnter=function(){
      lpct.textContent='100';
      drawLoaderBar(1,performance.now());
      lpctWrap.classList.add('hide');
      if(lbar) lbar.classList.add('hide');
      lenter.classList.add('show');
      const b1=document.getElementById('ebtn1');
      const b2=document.getElementById('ebtn2');
      if(b1) b1.addEventListener('click',()=>enterSite(true),{once:true});
      if(b2) b2.addEventListener('click',()=>enterSite(false),{once:true});
    };

    const LOADER_DURATION=2600;
    let loaderStart=null;
    function loaderProgress(ts){
      if(!loaderStart) loaderStart=ts;
      const elapsed=ts-loaderStart;
      const pct=Math.min(99,Math.round(elapsed/LOADER_DURATION*100));
      lpct.textContent=String(pct).padStart(2,'0');
      drawLoaderBar(pct/100,ts);
      if(elapsed<LOADER_DURATION) requestAnimationFrame(loaderProgress);
      else showEnter();
    }
    requestAnimationFrame(loaderProgress);

    function enterSite(withSound){
      try{ sessionStorage.setItem(LOADER_SEEN_KEY,'1'); }catch(e){}
      if(withSound) playAudio();
      if(audioDock) setTimeout(()=>audioDock.classList.add('show'),900);
      gsap.to('#loader',{opacity:0,duration:.65,ease:'power2.inOut',onComplete:()=>loaderEl.remove()});
      gsap.to('#nav',{opacity:1,duration:.8,delay:.3});
      setTimeout(revealHero,400);
    }
  }
}

/* Grid/List toggle — list is default — index.html only */
const wg=document.getElementById('wgrid');
const gbtn=document.getElementById('gbtn');
const lbtn=document.getElementById('lbtn');
if(wg&&gbtn&&lbtn){
  gbtn.addEventListener('click',function(){wg.classList.remove('lv');this.classList.add('active');lbtn.classList.remove('active');});
  lbtn.addEventListener('click',function(){wg.classList.add('lv');this.classList.add('active');gbtn.classList.remove('active');});
}

/* Scroll reveals — fade, rise and blur into focus */
gsap.utils.toArray('.reveal').forEach((el,i)=>{
  gsap.to(el,{opacity:1,y:0,filter:'blur(0px)',duration:1.1,ease:'power3.out',
    scrollTrigger:{trigger:el,start:'top 88%',toggleActions:'play none none none'},
    delay:(i%4)*.06});
});

/* Count-up stat numbers (e.g. "70+", "3K+") */
document.querySelectorAll('.stat-n').forEach(el=>{
  const match=el.textContent.trim().match(/^([\d.]+)(.*)$/);
  if(!match) return;
  const target=parseFloat(match[1]);
  const suffix=match[2];
  const isInt=Number.isInteger(target);
  const counter={val:0};
  el.textContent='0'+suffix;
  gsap.to(counter,{
    val:target,duration:1.6,ease:'power2.out',
    scrollTrigger:{trigger:el,start:'top 90%',toggleActions:'play none none none'},
    onUpdate:()=>{el.textContent=(isInt?Math.round(counter.val):counter.val.toFixed(1))+suffix;}
  });
});

/* Frosted nav once the page has scrolled past the hero */
const navEl=document.getElementById('nav');
if(navEl){
  const setNavFrost=()=>{
    if(window.scrollY>60) navEl.classList.add('scrolled');
    else navEl.classList.remove('scrolled');
  };
  setNavFrost();
  window.addEventListener('scroll',setNavFrost,{passive:true});
}

/* Custom scroll progress line + dot (replaces the native scrollbar) */
const sbFill=document.getElementById('sbFill');
const sbDot=document.getElementById('sbDot');
if(sbFill&&sbDot){
  const updateScrollbar=()=>{
    const scrollTop=window.scrollY;
    const docHeight=document.documentElement.scrollHeight-window.innerHeight;
    const pct=docHeight>0?Math.min(100,(scrollTop/docHeight)*100):0;
    sbFill.style.height=pct+'%';
    sbDot.style.top=pct+'%';
  };
  updateScrollbar();
  window.addEventListener('scroll',updateScrollbar,{passive:true});
  window.addEventListener('resize',updateScrollbar);
}

/* Hero parallax — foreground, background and overlay move at different rates */
gsap.to('#hcontent',{yPercent:-16,ease:'none',scrollTrigger:{trigger:'#hero',start:'top top',end:'bottom top',scrub:1}});
gsap.to('.hero-bg img, .hero-bg video',{yPercent:14,scale:1.14,ease:'none',scrollTrigger:{trigger:'#hero',start:'top top',end:'bottom top',scrub:1}});
gsap.to('#hside',{yPercent:-28,ease:'none',scrollTrigger:{trigger:'#hero',start:'top top',end:'bottom top',scrub:1}});

/* Hero image fades out as you scroll through it */
gsap.to('.hero-bg',{opacity:0,ease:'none',scrollTrigger:{trigger:'#hero',start:'top top',end:'bottom top',scrub:1}});

/* Magnetic elements */
document.querySelectorAll('.nav-cta,.f-back').forEach(el=>{
  el.addEventListener('mousemove',e=>{const r=el.getBoundingClientRect();gsap.to(el,{x:(e.clientX-(r.left+r.width/2))*.3,y:(e.clientY-(r.top+r.height/2))*.3,duration:.3,ease:'power2.out'});});
  el.addEventListener('mouseleave',()=>gsap.to(el,{x:0,y:0,duration:.6,ease:'elastic.out(1,.4)'}));
});

/* ── MILES Masterclass modal (no autoplay) — index.html only ── */
const milesModal=document.getElementById('milesModal');
const milesFrame=document.getElementById('milesFrame');
const milesTrigger=document.getElementById('wc-miles');
const milesThumbs=document.querySelectorAll('.modal-thumb');

function openOverlay(el){el.classList.add('open');el.setAttribute('aria-hidden','false');}
function closeOverlay(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');}

if(milesTrigger&&milesModal&&milesFrame){
  milesTrigger.addEventListener('click',e=>{
    e.preventDefault();
    milesFrame.src='https://www.youtube.com/embed/WOD94SZI0lo?rel=0';
    openOverlay(milesModal);
  });
  milesThumbs.forEach(btn=>{
    btn.addEventListener('click',()=>{
      milesThumbs.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      milesFrame.src=`https://www.youtube.com/embed/${btn.dataset.video}?rel=0`;
    });
  });
}

/* ── Lightbox: generalized for multiple image galleries ── */
const lightbox=document.getElementById('lightbox');
const lbImg=document.getElementById('lbImg');
let currentGallery=[];
let lbIndex=0;

function showLB(i){
  if(!lightbox) return;
  lbIndex=(i+currentGallery.length)%currentGallery.length;
  lbImg.src=currentGallery[lbIndex];
}
function openGallery(imgs,startIndex){
  if(!lightbox) return;
  currentGallery=imgs;
  showLB(startIndex);
  openOverlay(lightbox);
}

if(lightbox){
  /* Photography grid feeds the default gallery */
  const photoImgs=Array.from(document.querySelectorAll('.photo-item img')).map(img=>img.src);
  document.querySelectorAll('.photo-item').forEach((item,i)=>{
    item.addEventListener('click',()=>openGallery(photoImgs,i));
  });

  /* Project cards with their own gallery (data-gallery="a.jpg,b.jpg,...") */
  document.querySelectorAll('[data-gallery]').forEach(el=>{
    el.addEventListener('click',e=>{
      e.preventDefault();
      const imgs=el.dataset.gallery.split(',');
      openGallery(imgs,0);
    });
  });

  document.getElementById('lbPrev').addEventListener('click',()=>showLB(lbIndex-1));
  document.getElementById('lbNext').addEventListener('click',()=>showLB(lbIndex+1));
}

/* Shared close/escape handling */
function closeAllOverlays(){
  if(milesModal){closeOverlay(milesModal); if(milesFrame) milesFrame.src='';}
  if(lightbox) closeOverlay(lightbox);
}
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeAllOverlays));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeAllOverlays();
  if(lightbox&&lightbox.classList.contains('open')){
    if(e.key==='ArrowLeft') showLB(lbIndex-1);
    if(e.key==='ArrowRight') showLB(lbIndex+1);
  }
});

/* ── Footer plexus network animation (low opacity) ── */
const plexusCanvas=document.getElementById('plexus');
if(plexusCanvas){
  const pCtx=plexusCanvas.getContext('2d');
  const footerEl=plexusCanvas.closest('footer');
  let pNodes=[];

  function resizePlexus(){
    const rect=footerEl.getBoundingClientRect();
    plexusCanvas.width=rect.width*devicePixelRatio;
    plexusCanvas.height=rect.height*devicePixelRatio;
    plexusCanvas.style.width=rect.width+'px';
    plexusCanvas.style.height=rect.height+'px';
    pCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    const count=Math.max(14,Math.round(rect.width/70));
    pNodes=Array.from({length:count},()=>({
      x:Math.random()*rect.width,
      y:Math.random()*rect.height,
      vx:(Math.random()-.5)*.25,
      vy:(Math.random()-.5)*.25,
    }));
  }
  resizePlexus();
  window.addEventListener('resize',resizePlexus);

  function plexusLoop(){
    const w=plexusCanvas.clientWidth,h=plexusCanvas.clientHeight;
    pCtx.clearRect(0,0,w,h);
    pNodes.forEach(n=>{
      n.x+=n.vx;n.y+=n.vy;
      if(n.x<0||n.x>w) n.vx*=-1;
      if(n.y<0||n.y>h) n.vy*=-1;
    });
    for(let i=0;i<pNodes.length;i++){
      for(let j=i+1;j<pNodes.length;j++){
        const dx=pNodes[i].x-pNodes[j].x, dy=pNodes[i].y-pNodes[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<130){
          pCtx.beginPath();
          pCtx.moveTo(pNodes[i].x,pNodes[i].y);
          pCtx.lineTo(pNodes[j].x,pNodes[j].y);
          pCtx.strokeStyle=`rgba(237,234,226,${(1-dist/130)*0.18})`;
          pCtx.lineWidth=1;
          pCtx.stroke();
        }
      }
    }
    pNodes.forEach(n=>{
      pCtx.beginPath();
      pCtx.arc(n.x,n.y,1.6,0,Math.PI*2);
      pCtx.fillStyle='rgba(122,27,24,0.6)';
      pCtx.fill();
    });
    requestAnimationFrame(plexusLoop);
  }
  plexusLoop();
}

/* ── Garage: packshots tilt toward the cursor ── */
const tiltBoxes=document.querySelectorAll('[data-tilt]');
if(tiltBoxes.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  tiltBoxes.forEach(box=>{
    const bay=box.closest('.gbay')||box.parentElement;
    const REST_Y=20, REST_X=2;
    let raf=0,tx=REST_Y,ty=REST_X;
    const apply=()=>{ raf=0; box.style.setProperty('--ry',tx+'deg'); box.style.setProperty('--rx',ty+'deg'); };
    bay.addEventListener('pointermove',e=>{
      const r=bay.getBoundingClientRect();
      const px=(e.clientX-r.left)/r.width-0.5;   /* -0.5 … 0.5 */
      const py=(e.clientY-r.top)/r.height-0.5;
      /* Cursor right closes the box toward flat, cursor left opens the spine */
      tx=REST_Y-px*26;
      ty=REST_X-py*14;
      if(!raf) raf=requestAnimationFrame(apply);
    });
    bay.addEventListener('pointerleave',()=>{
      tx=REST_Y;ty=REST_X;
      if(!raf) raf=requestAnimationFrame(apply);
    });
  });
}

/* ── Garage: filter the shelf ── */
const gFilters=document.querySelectorAll('.gfilter');
if(gFilters.length){
  const bays=[...document.querySelectorAll('.gbay')];
  const shown=document.getElementById('gShown');
  gFilters.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const kind=btn.dataset.filter;
      gFilters.forEach(b=>{
        const on=b===btn;
        b.classList.toggle('active',on);
        b.setAttribute('aria-selected',on?'true':'false');
      });
      let n=0;
      bays.forEach(bay=>{
        const match = kind==='all' || bay.dataset.kind===kind;
        bay.classList.toggle('is-hidden',!match);
        if(match) n++;
      });
      if(shown) shown.textContent=n;
      if(window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });
}

/* ── Instagram feed ──
   Reads a plain JSON feed URL from data-endpoint. Field names differ between
   providers, so accept the common spellings rather than tie this to one.
   Nodes are built with the DOM, never innerHTML, so a caption containing
   markup cannot inject anything. */
const igGrid=document.getElementById('igGrid');
if(igGrid){
  const IG_PROFILE='https://www.instagram.com/rahul____kuttappy/';
  const IG_MAX=6;   /* Behold's free tier caps a feed at 6 posts */
  const igEndpoint=(igGrid.dataset.endpoint||'').trim();

  function igFallback(label){
    igGrid.classList.add('ig-empty');
    igGrid.textContent='';
    const a=document.createElement('a');
    a.className='ig-cta';a.href=IG_PROFILE;a.target='_blank';a.rel='noopener';
    const l=document.createElement('span');l.className='ig-cta-lbl';l.textContent=label;
    const g=document.createElement('span');g.className='ig-cta-go';g.textContent='Open Instagram →';
    a.append(l,g);igGrid.appendChild(a);
  }

  function igNormalise(json){
    const arr=Array.isArray(json)?json:(json.posts||json.data||json.media||[]);
    if(!Array.isArray(arr)) return [];
    const sized=p=>{
      /* Behold mirrors each post to its own CDN under `sizes`. Prefer those:
         the raw mediaUrl is an Instagram signed URL that expires. */
      const s=p.sizes||{};
      return (s.medium&&s.medium.mediaUrl)||(s.large&&s.large.mediaUrl)||
             (s.small&&s.small.mediaUrl)||p.thumbnailUrl||p.thumbnail_url||
             p.mediaUrl||p.media_url||p.image||'';
    };
    return arr.slice(0,IG_MAX).map(p=>({
      link:p.permalink||p.link||IG_PROFILE,
      img:sized(p),
      type:String(p.mediaType||p.media_type||'').toUpperCase(),
      caption:String(p.caption||p.text||'').replace(/\s+/g,' ').slice(0,110)
    })).filter(p=>/^https:\/\//.test(p.img));
  }

  function igRender(posts){
    igGrid.classList.remove('ig-empty');
    igGrid.textContent='';
    posts.forEach((p,i)=>{
      const a=document.createElement('a');
      a.className='ig-item';a.href=p.link;a.target='_blank';a.rel='noopener';
      a.style.animationDelay=(i*60)+'ms';
      const img=document.createElement('img');
      img.src=p.img;img.loading='lazy';img.decoding='async';
      img.alt=p.caption||'Instagram post';
      a.appendChild(img);
      if(p.type==='VIDEO'||p.type==='REELS'||p.type==='CAROUSEL_ALBUM'){
        const b=document.createElement('span');
        b.className='ig-badge';
        b.textContent=p.type==='CAROUSEL_ALBUM'?'Album':'Reel';
        a.appendChild(b);
      }
      igGrid.appendChild(a);
    });
    if(window.ScrollTrigger) ScrollTrigger.refresh();
  }

  if(!igEndpoint){
    igFallback('Feed not connected yet');
  }else{
    fetch(igEndpoint,{mode:'cors'})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(json=>{
        const posts=igNormalise(json);
        posts.length ? igRender(posts) : igFallback('Nothing to show right now');
      })
      .catch(()=>igFallback('Feed unavailable'));
  }
}

/* ── Casual image-lifting deterrents ──
   Scoped to media only, so right-clicking a link or text still behaves
   normally. This stops the easy save, nothing more. */
document.addEventListener('contextmenu',e=>{
  if(e.target.closest('img,video,.photo-item,.lightbox,.hero-bg,.wkhero-bg')) e.preventDefault();
});
document.addEventListener('dragstart',e=>{
  if(e.target.tagName==='IMG'||e.target.tagName==='VIDEO') e.preventDefault();
});

/* ── Dithered word (ordered 4x4 Bayer dissolve on [data-dither] text) ── */
const ditherWords=document.querySelectorAll('[data-dither]');
if(ditherWords.length){
  const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeDither(el){
    const word=(el.textContent||'').trim();
    if(!word) return null;
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) return null;
    el.appendChild(canvas);
    el.classList.add('is-dithered');

    let W=0,H=0,pad=0,blk=3,src=null,out=null,visible=true,raf=0;

    /* An empty zero-size inline-block sits on the text baseline, so its
       top edge tells us exactly where to draw the glyphs. */
    function baselineOffset(){
      const probe=document.createElement('span');
      probe.style.cssText='display:inline-block;width:0;height:0;overflow:hidden';
      el.insertBefore(probe,canvas);
      const y=probe.getBoundingClientRect().top-el.getBoundingClientRect().top;
      probe.remove();
      return y;
    }

    function build(){
      const rect=el.getBoundingClientRect();
      if(!rect.width||!rect.height){src=null;return;}
      const cs=getComputedStyle(el);
      const fontSize=parseFloat(cs.fontSize)||48;
      const base=baselineOffset();

      blk=Math.min(3,Math.max(2,Math.round(fontSize/72)));
      pad=Math.round(fontSize*0.34);
      W=Math.ceil((rect.width+pad*2)/blk);
      H=Math.ceil((rect.height+pad*2)/blk);

      canvas.width=W;canvas.height=H;
      canvas.style.width=(W*blk)+'px';
      canvas.style.height=(H*blk)+'px';
      canvas.style.left=(-pad)+'px';
      canvas.style.top=(-pad)+'px';

      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,W,H);
      ctx.font=`${cs.fontStyle} ${cs.fontWeight} ${fontSize/blk}px ${cs.fontFamily}`;
      if('letterSpacing' in ctx) ctx.letterSpacing=cs.letterSpacing;
      ctx.textAlign='left';
      ctx.textBaseline='alphabetic';
      ctx.fillStyle='#fff';
      /* Squeeze to the measured DOM width so the raster lands on the glyphs
         even where canvas metrics drift from the browser's own shaping. */
      const measured=ctx.measureText(word).width;
      const sx=measured>0?(rect.width/blk)/measured:1;
      ctx.save();
      ctx.translate(pad/blk,(pad+base)/blk);
      ctx.scale(sx,1);
      ctx.fillText(word,0,0);
      ctx.restore();

      src=ctx.getImageData(0,0,W,H);
      out=ctx.createImageData(W,H);
    }

    function draw(t){
      if(!src) return;
      const a=src.data,o=out.data;
      o.fill(0);
      /* Sweep travels across the word, then rests before the next pass. */
      const s=calm?-99:((t*0.00022)%1.75)-0.32;
      for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
          const i=(y*W+x)*4;
          /* Lift the antialiased rim so the letterforms stay crisp and only
             the true edge pixels break up into stipple. */
          const alpha=Math.min(1,(a[i+3]/255)*1.45);
          if(alpha<=0.02) continue;
          const d=(x/W)*0.78+(y/H)*0.22-s;
          const band=Math.exp(-(d*d)/0.045);
          const level=alpha*(1-0.88*band)*(0.97+0.03*Math.sin(t*0.004+x*0.4));
          if(level<=(BAYER[y&3][x&3]+0.5)/16) continue;
          const hot=band>0.42?1:0;
          o[i]=hot?178:237;
          o[i+1]=hot?52:234;
          o[i+2]=hot?44:226;
          o[i+3]=255;
        }
      }
      ctx.putImageData(out,0,0);
    }

    function loop(t){
      raf=0;
      if(!visible) return;
      draw(t);
      if(!calm) raf=requestAnimationFrame(loop);
    }
    function start(){ if(!raf&&visible) raf=requestAnimationFrame(loop); }

    if('IntersectionObserver' in window){
      new IntersectionObserver(es=>{
        visible=es[0].isIntersecting;
        if(visible) start(); else if(raf){cancelAnimationFrame(raf);raf=0;}
      },{rootMargin:'120px'}).observe(el);
    }

    return {rebuild(){build();draw(performance.now());start();}};
  }

  const instances=[...ditherWords].map(makeDither).filter(Boolean);
  const refresh=()=>instances.forEach(d=>d.rebuild());
  refresh();
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(refresh);
  let dtTimer;
  window.addEventListener('resize',()=>{clearTimeout(dtTimer);dtTimer=setTimeout(refresh,180);});
}
