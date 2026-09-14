gsap.registerPlugin(ScrollTrigger);

/* ── A reload sends you home ──
   Asked for deliberately. Note this means refreshing a project page will
   not show you that page again, which is worth remembering while editing.
   First visits, shared links and crawlers are untouched: only a genuine
   reload redirects. */
(function(){
  try{
    const nav=performance.getEntriesByType('navigation')[0];
    if(!nav||nav.type!=='reload') return;
    const path=location.pathname;
    const atHome=/\/(index\.html)?$/.test(path);
    if(atHome) return;
    const home=path.includes('/work/') ? '../index.html' : 'index.html';
    location.replace(home);
  }catch(e){}
})();

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

/* ── Hero: opening clip, then a looping one ──
   The first video plays once and hands over to the second, which loops for
   good. The keep-alive below tracks whichever clip is current, otherwise it
   would fight the handover by restarting the one we just retired.

   iOS pauses autoplaying video for a lot of reasons: backgrounding the tab,
   an incoming call, another app taking the audio session, or scrolling it out
   of view. Nothing restarts it on its own. Low Power Mode blocks playback
   outright and play() just rejects, hence the attempt cap: the poster frame
   stands in. */
const heroVideo=document.getElementById('heroVideo');
const heroVideo2=document.getElementById('heroVideo2');
if(heroVideo){
  let active=heroVideo;
  let inView=true, attempts=0;
  const MAX_ATTEMPTS=30;

  [heroVideo,heroVideo2].forEach(v=>{
    if(!v) return;
    v.muted=true;                       /* re-assert: autoplay needs it */
    v.setAttribute('playsinline','');
    v.setAttribute('webkit-playsinline','');
    v.disablePictureInPicture=true;
  });

  function resumeHero(reset){
    if(reset) attempts=0;
    if(!inView||document.hidden||!active.paused) return;
    if(attempts++>MAX_ATTEMPTS) return;
    const p=active.play();
    if(p&&p.catch) p.catch(()=>{});
  }

  if(heroVideo2){
    /* let the opening clip have the bandwidth, then fetch the other */
    heroVideo.addEventListener('playing',()=>{ heroVideo2.load(); },{once:true});

    /* The pair alternate forever. Only the second carries the fade class, so
       handing forward means fading it in over the first, and handing back
       means fading it out to reveal the first already running underneath.
       The outgoing clip is paused only after the crossfade has covered it. */
    function handOver(next,prev,fadeIn){
      active=next;
      attempts=0;
      try{ next.currentTime=0; }catch(e){}
      const p=next.play();
      if(p&&p.catch) p.catch(()=>{
        /* if the other clip will not start, keep the current one going */
        active=prev; prev.loop=true; resumeHero(true);
      });
      heroVideo2.classList.toggle('is-on',fadeIn);
      setTimeout(()=>{ if(active===next && !prev.paused) prev.pause(); },1100);
    }

    heroVideo.addEventListener('ended',()=>handOver(heroVideo2,heroVideo,true));
    heroVideo2.addEventListener('ended',()=>handOver(heroVideo,heroVideo2,false));
  }else{
    heroVideo.loop=true;
  }

  [heroVideo,heroVideo2].forEach(v=>{
    if(!v) return;
    v.addEventListener('pause',()=>{ if(v===active) setTimeout(()=>resumeHero(false),140); });
    v.addEventListener('playing',()=>{ if(v===active) attempts=0; });
    v.addEventListener('stalled',()=>{ if(v===active) resumeHero(true); });
  });
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) resumeHero(true); });
  window.addEventListener('pageshow',()=>resumeHero(true));
  ['touchstart','pointerdown','click'].forEach(ev=>
    window.addEventListener(ev,()=>resumeHero(true),{passive:true}));

  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>{
      inView=es[0].isIntersecting;
      if(inView) resumeHero(true);
      else if(!active.paused) active.pause();
    },{threshold:0.01}).observe(heroVideo);
  }
}

/* ── Mobile menu ──
   The link list is the same element the desktop nav uses; on small screens
   CSS turns it into a full screen panel and this toggles it. No scroll lock:
   body overflow would give the page a second scroll container and break the
   sticky section headers. */
const navToggle=document.getElementById('navToggle');
if(navToggle){
  const closeNav=()=>{
    document.body.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded','false');
  };
  navToggle.addEventListener('click',e=>{
    e.stopPropagation();
    const open=document.body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded',open?'true':'false');
  });
  document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',closeNav));
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeNav(); });
  /* Rotating the phone back to a wide layout should not strand the panel */
  window.addEventListener('resize',()=>{ if(window.innerWidth>768) closeNav(); });
}

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

/* ── Background music: playlist with transport ── */
const bgm=document.getElementById('bgm');
const audioDock=document.getElementById('audioDock');
const vizCanvas=document.getElementById('vizCanvas');
const audioToggle=document.getElementById('audioToggle');
const audioVol=document.getElementById('audioVol');
const apPrev=document.getElementById('apPrev');
const apNext=document.getElementById('apNext');
const apIdx=document.getElementById('apIdx');
const apTitle=document.getElementById('apTitle');
const AUDIO_KEY='rk_audio';

const TRACKS=[
  {file:'singularity.m4a',  name:'Singularity'},
  {file:'warm-soul.m4a',    name:'Warm Soul'},
  {file:'my-existence.m4a', name:'My Existence'},
  {file:'bleak.m4a',        name:'Bleak'}
];
const AUDIO_BASE=(audioDock&&audioDock.dataset.audioBase)||'assets/audio/';
let trackIndex=0;
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
      want:audioWant, vol:bgm.volume, t:bgm.currentTime||0, i:trackIndex
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

function pad2(n){ return String(n).padStart(2,'0'); }
function paintTransport(){
  if(apIdx)   apIdx.textContent=pad2(trackIndex+1)+'/'+pad2(TRACKS.length);
  if(apTitle) apTitle.textContent=TRACKS[trackIndex].name;
  if(audioDock) audioDock.classList.toggle('playing', !!bgm && !bgm.paused);
  if(audioToggle) audioToggle.setAttribute('aria-label', (bgm&&!bgm.paused)?'Pause':'Play');
}

/* Only points the element at a file. Loading waits for a play request,
   which is what keeps preload=none meaningful. */
function loadTrack(i,{autoplay=false,at=0}={}){
  if(!bgm) return;
  trackIndex=(i+TRACKS.length)%TRACKS.length;
  bgm.src=AUDIO_BASE+TRACKS[trackIndex].file;
  if(at) bgm.addEventListener('loadedmetadata',()=>{ try{bgm.currentTime=at;}catch(e){} },{once:true});
  paintTransport();
  if(autoplay) playAudio();
  else saveAudioState();
}

function playAudio(userInitiated){
  if(!bgm) return;
  if(userInitiated!==false) audioWant=true;
  if(!bgm.getAttribute('src')) bgm.src=AUDIO_BASE+TRACKS[trackIndex].file;
  setupAnalyser();
  if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
  const p=bgm.play();
  if(p&&p.catch) p.catch(()=>{ armAutoplayRetry(); });
  paintTransport();
  saveAudioState();
}
function pauseAudio(){
  if(!bgm) return;
  audioWant=false;
  bgm.pause();
  paintTransport();
  saveAudioState();
}
function step(dir){
  const wasPlaying = bgm && !bgm.paused;
  loadTrack(trackIndex+dir,{autoplay:wasPlaying||audioWant});
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
  trackIndex = (typeof st.i==='number' && st.i>=0 && st.i<TRACKS.length) ? st.i : 0;
  if(audioVol) audioVol.value=String(bgm.volume);
  paintTransport();

  if(audioToggle) audioToggle.addEventListener('click',()=>{ bgm.paused ? playAudio() : pauseAudio(); });
  if(apPrev) apPrev.addEventListener('click',()=>step(-1));
  if(apNext) apNext.addEventListener('click',()=>step(1));
  /* run on into the next track rather than looping one forever */
  bgm.addEventListener('ended',()=>step(1));

  /* Pressing the visualizer reveals the transport, which then tucks itself
     away again. Every interaction restarts the countdown, so tapping through
     tracks or dragging the volume never yanks the panel out from under you,
     and it will not close while the pointer is resting on it. */
  const vizBtn=document.getElementById('vizBtn');
  if(vizBtn){
    const AUTO_HIDE=3200;
    let hideTimer=null;
    const closeDock=()=>{ clearTimeout(hideTimer); audioDock.classList.remove('open'); };
    const holdOpen=()=>clearTimeout(hideTimer);
    const scheduleHide=()=>{
      clearTimeout(hideTimer);
      if(!audioDock.classList.contains('open')) return;
      hideTimer=setTimeout(()=>{
        /* a pointer parked on the panel counts as still in use */
        if(audioDock.matches(':hover')) return scheduleHide();
        audioDock.classList.remove('open');
      },AUTO_HIDE);
    };

    vizBtn.addEventListener('click',e=>{
      e.stopPropagation();
      const open=audioDock.classList.toggle('open');
      open ? scheduleHide() : clearTimeout(hideTimer);
    });

    const panel=document.getElementById('audioPanel');
    if(panel){
      ['pointerdown','click','input','change','keydown'].forEach(ev=>
        panel.addEventListener(ev,scheduleHide));
      panel.addEventListener('pointerenter',holdOpen);
      panel.addEventListener('pointerleave',scheduleHide);
    }

    document.addEventListener('click',e=>{ if(!audioDock.contains(e.target)) closeDock(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeDock(); });
  }
  if(audioVol){
    audioVol.addEventListener('input',()=>{
      bgm.volume=parseFloat(audioVol.value);
      if(bgm.volume>0&&bgm.paused&&audioWant) playAudio();
      saveAudioState();
    });
  }
  bgm.addEventListener('play',paintTransport);
  bgm.addEventListener('pause',paintTransport);
  let lastSave=0;
  bgm.addEventListener('timeupdate',()=>{
    const now=Date.now();
    if(!bgm.paused&&now-lastSave>1500){ lastSave=now; saveAudioState(); }
  });
  window.addEventListener('pagehide',saveAudioState);
  window.addEventListener('beforeunload',saveAudioState);

  /* Resume across page navigations */
  if(audioWant){
    loadTrack(trackIndex,{at:st.t||0});
    audioDock.classList.add('show');
    playAudio(false);
  }else if(st.vol!==undefined){
    audioDock.classList.add('show');
  }

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

/* ── Cursor: glowing orb with a tapered streak ──
   Three things make this smooth rather than steppy:
   the easing is delta-time based so it behaves the same at 60 and 120Hz;
   the trail samples the eased position once per frame instead of pushing
   raw mousemove events, which vary with pointer speed and leave gaps; and
   the streak is a stroked curve through those points rather than a row of
   separate dots. The radius eases on hover too, instead of snapping. */
const fx=document.getElementById('cursorFX');
const fxCtx=fx.getContext('2d');
let fxMx=innerWidth/2,fxMy=innerHeight/2,fxSx=fxMx,fxSy=fxMy;
let fxHover=false,fxR=9,fxAlpha=0;
const trail=[];
const TRAIL_MAX=26;

function resizeFX(){
  fx.width=innerWidth*devicePixelRatio;
  fx.height=innerHeight*devicePixelRatio;
  fx.style.width=innerWidth+'px';
  fx.style.height=innerHeight+'px';
  fxCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeFX();
window.addEventListener('resize',resizeFX);

document.addEventListener('mousemove',e=>{ fxMx=e.clientX;fxMy=e.clientY;fxAlpha=1; },{passive:true});
document.addEventListener('mouseleave',()=>{ fxAlpha=0; });

document.querySelectorAll('a,button,.photo-item,input').forEach(el=>{
  el.addEventListener('mouseenter',()=>{fxHover=true;});
  el.addEventListener('mouseleave',()=>{fxHover=false;});
});

let fxLast=performance.now();
function cursorLoop(now){
  /* clamp dt so a backgrounded tab does not fling the orb across the screen */
  const dt=Math.min((now-fxLast)/1000,0.05); fxLast=now;
  const ease=r=>1-Math.pow(1-r,dt*60);

  const k=ease(0.16);
  fxSx+=(fxMx-fxSx)*k;
  fxSy+=(fxMy-fxSy)*k;
  fxR+=((fxHover?15:9)-fxR)*ease(0.12);

  trail.push({x:fxSx,y:fxSy});
  if(trail.length>TRAIL_MAX) trail.shift();

  fxCtx.clearRect(0,0,innerWidth,innerHeight);
  if(fxAlpha<=0){ requestAnimationFrame(cursorLoop); return; }

  /* tapered streak: one curve, width and opacity falling off toward the tail */
  if(trail.length>2){
    fxCtx.lineCap='round';fxCtx.lineJoin='round';
    for(let i=1;i<trail.length;i++){
      const t=i/trail.length;
      const p0=trail[i-1],p1=trail[i];
      fxCtx.beginPath();
      fxCtx.moveTo(p0.x,p0.y);
      fxCtx.lineTo(p1.x,p1.y);
      fxCtx.lineWidth=Math.max(0.4,t*3.2);
      fxCtx.strokeStyle='rgba(237,234,226,'+(t*t*0.3*fxAlpha)+')';
      fxCtx.stroke();
    }
  }

  const glow=fxR*2.4;
  const grad=fxCtx.createRadialGradient(fxSx,fxSy,0,fxSx,fxSy,glow);
  grad.addColorStop(0,'rgba(237,234,226,'+(0.9*fxAlpha)+')');
  grad.addColorStop(.35,'rgba(122,27,24,'+(0.65*fxAlpha)+')');
  grad.addColorStop(1,'rgba(122,27,24,0)');
  fxCtx.beginPath();
  fxCtx.arc(fxSx,fxSy,glow,0,Math.PI*2);
  fxCtx.fillStyle=grad;
  fxCtx.fill();

  fxCtx.beginPath();
  fxCtx.arc(fxSx,fxSy,fxR*.35,0,Math.PI*2);
  fxCtx.fillStyle='rgba(255,255,255,'+(0.95*fxAlpha)+')';
  fxCtx.fill();

  requestAnimationFrame(cursorLoop);
}
requestAnimationFrame(cursorLoop);

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

/* ── Films: click to play, one handler for YouTube, Vimeo and own files ──
   Nothing autoplays on load. The poster is swapped for the player only once
   the visitor presses it, and an unfilled slot says so rather than embedding
   something broken. */
document.querySelectorAll('.film .film-media').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const film=btn.closest('.film');
    const type=(film.dataset.type||'').toLowerCase();
    const id=(film.dataset.id||'').trim();
    const src=(film.dataset.src||'').trim();
    const title=(film.querySelector('.film-title')||{}).textContent||'Film';

    const frame=document.createElement('div');
    frame.className='film-frame';

    const unset=v=>!v||v==='REPLACE_ME';
    if((type==='youtube'||type==='vimeo') ? unset(id) : unset(src)){
      frame.classList.add('film-missing');
      frame.textContent='Not linked yet';
      btn.replaceWith(frame);
      return;
    }

    /* The visitor asked for this, so playing over the background track
       would just be two things at once. */
    if(typeof bgm!=='undefined' && bgm && !bgm.paused){
      bgm.pause();
      if(typeof paintTransport==='function') paintTransport();
    }

    if(type==='youtube'){
      const f=document.createElement('iframe');
      f.src='https://www.youtube.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title=title;
      f.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen=true;
      frame.appendChild(f);
    }else if(type==='vimeo'){
      const f=document.createElement('iframe');
      f.src='https://player.vimeo.com/video/'+encodeURIComponent(id)+'?autoplay=1&title=0&byline=0&portrait=0';
      f.title=title;
      f.allow='autoplay; fullscreen; picture-in-picture';
      f.allowFullscreen=true;
      frame.appendChild(f);
    }else{
      const v=document.createElement('video');
      v.src=src;v.controls=true;v.autoplay=true;v.playsInline=true;v.preload='metadata';
      frame.appendChild(v);
    }
    btn.replaceWith(frame);
  });
});

/* Keep the films count honest without hand-editing it */
const fCount=document.getElementById('fCount');
if(fCount){
  const n=document.querySelectorAll('.film').length;
  fCount.textContent='';
  const em=document.createElement('em');
  em.textContent=String(n);
  fCount.append(em, n===1 ? ' film' : ' films');
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

  /* Posts can also be placed by hand in the markup. If any are there they
     stand as-is, and an absent or failing live feed must not wipe them. */
  const igHasStatic=!!igGrid.querySelector('.ig-item');

  if(!igEndpoint){
    if(!igHasStatic) igFallback('Feed not connected yet');
  }else{
    fetch(igEndpoint,{mode:'cors'})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(json=>{
        const posts=igNormalise(json);
        if(posts.length) igRender(posts);
        else if(!igHasStatic) igFallback('Nothing to show right now');
      })
      .catch(()=>{ if(!igHasStatic) igFallback('Feed unavailable'); });
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

/* ── About hero: fade and parallax ──
   Mirrors the home hero: the portrait drifts and scales slightly slower
   than the page while the whole block fades out as it leaves. */
const abHeroPhoto=document.querySelector('.abhero-photo');
if(abHeroPhoto && window.gsap && window.ScrollTrigger){
  gsap.fromTo('.abhero-photo img',
    {yPercent:-4,scale:1.1},
    {yPercent:10,scale:1.16,ease:'none',
     scrollTrigger:{trigger:'#abhero',start:'top top',end:'bottom top',scrub:1}});
  gsap.to('#abhero',
    {opacity:.15,ease:'none',
     scrollTrigger:{trigger:'#abhero',start:'40% top',end:'bottom top',scrub:1}});
  /* the statement lifts a touch faster, which is what sells the depth */
  gsap.to('.abhero-inner',
    {yPercent:-9,ease:'none',
     scrollTrigger:{trigger:'#abhero',start:'top top',end:'bottom top',scrub:1}});
}

/* ── The mark: dithered wave ──
   Same Bayer matrix as the loader bar and the headings. The logo is drawn
   into a small pixel grid, then a wave travels through it thinning the
   stipple as it passes, so the mark breathes against the page instead of
   sitting on it. */
const markCanvas=document.getElementById('markCanvas');
if(markCanvas && markCanvas.getContext){
  const mctx=markCanvas.getContext('2d',{willReadFrequently:true});
  const M_BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const M_BLK=2;
  const calmMark=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let MW=0,MH=0,msrc=null,mout=null,mVisible=true,mRaf=0;

  const logo=new Image();
  logo.onload=()=>{ buildMark(); startMark(); };
  logo.src='assets/images/logo.png';

  function buildMark(){
    const cssW=markCanvas.clientWidth||176;
    MW=Math.max(24,Math.round(cssW/M_BLK));
    MH=Math.max(12,Math.round(MW*logo.naturalHeight/logo.naturalWidth));
    markCanvas.width=MW;markCanvas.height=MH;
    markCanvas.style.height=(MH*M_BLK)+'px';
    mctx.clearRect(0,0,MW,MH);
    mctx.drawImage(logo,0,0,MW,MH);
    msrc=mctx.getImageData(0,0,MW,MH);
    mout=mctx.createImageData(MW,MH);
  }

  /* pointer, in grid coordinates, with an eased strength so the glow
     arrives and leaves rather than snapping on */
  let mPx=-99,mPy=-99,mHeat=0,mHeatTarget=0;
  const M_RADIUS=9;
  markCanvas.addEventListener('pointermove',e=>{
    const r=markCanvas.getBoundingClientRect();
    mPx=((e.clientX-r.left)/r.width)*MW;
    mPy=((e.clientY-r.top)/r.height)*MH;
    mHeatTarget=1;
    startMark();
  });
  markCanvas.addEventListener('pointerleave',()=>{ mHeatTarget=0; startMark(); });

  function drawMark(t){
    if(!msrc) return;
    const a=msrc.data,o=mout.data;
    o.fill(0);
    mHeat+=(mHeatTarget-mHeat)*0.12;
    /* wave sweeps diagonally, pausing between passes */
    const s=calmMark ? -99 : ((t*0.00016)%1.8)-0.35;
    const hot=mHeat>0.01;
    const r2=M_RADIUS*M_RADIUS;
    for(let y=0;y<MH;y++){
      for(let x=0;x<MW;x++){
        const i=(y*MW+x)*4;
        const alpha=Math.min(1,(a[i+3]/255)*1.4);
        if(alpha<=0.02) continue;
        const d=(x/MW)*0.8+(y/MH)*0.2-s;
        const wave=Math.exp(-(d*d)/0.05);
        let level=alpha*(1-0.8*wave);

        /* under the pointer the mark fills back in as well as reddening,
           so the cursor reads as light falling on it */
        let heat=0;
        if(hot){
          const dx=x-mPx, dy=y-mPy;
          const dd=(dx*dx+dy*dy)/r2;
          if(dd<1){ heat=(1-dd)*(1-dd)*mHeat; level+=heat*0.55; }
        }
        if(level<=(M_BAYER[y&3][x&3]+0.5)/16) continue;
        if(heat>0.02){
          o[i]=237+(206-237)*heat;
          o[i+1]=234+(46-234)*heat;
          o[i+2]=226+(38-226)*heat;
        }else{ o[i]=237;o[i+1]=234;o[i+2]=226; }
        o[i+3]=255;
      }
    }
    mctx.putImageData(mout,0,0);
  }

  function markLoop(t){ mRaf=0; if(!mVisible) return; drawMark(t);
    if(!calmMark || mHeat>0.01 || mHeatTarget>0) mRaf=requestAnimationFrame(markLoop); }
  function startMark(){ if(!mRaf&&mVisible) mRaf=requestAnimationFrame(markLoop); }

  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>{
      mVisible=es[0].isIntersecting;
      if(mVisible) startMark(); else if(mRaf){cancelAnimationFrame(mRaf);mRaf=0;}
    },{rootMargin:'100px'}).observe(markCanvas);
  }
  let mT;
  window.addEventListener('resize',()=>{clearTimeout(mT);mT=setTimeout(()=>{if(logo.complete){buildMark();startMark();}},180);});
}

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

/* ── Scale nav (next project) ──
   The ruler slides under a fixed marker; the project under the marker is
   shown above it. Drag or swipe with inertia, trackpad sideways scroll,
   arrow keys, or click a tall tick. Enter or the label opens the centred
   project through the normal page transition, since the label is a plain
   link that the transition code already watches. Only vertical page scroll
   is left alone, so the section never traps the page. */
(function(){
  const wks=document.getElementById('wknext');
  if(!wks||!wks.classList.contains('wks')) return;

  const PROJECTS=[
    {slug:"spunk-your-creek.html",  title:"SPUNK YOUR CREEK",                  type:"Dance Battle · Showcase",   year:"2023", thumb:"assets/images/projects/eilin.jpg"},
    {slug:"ards.html",              title:"ARDS",                              type:"Music Video",               year:"2024", thumb:"assets/images/projects/ards.jpg"},
    {slug:"amg-sl-roadster.html",   title:"AMG SL ROADSTER",                   type:"Commercial",                year:"2023", thumb:"assets/images/projects/amg-sl-roadster.jpg"},
    {slug:"pearl-noir.html",        title:"PEARL NOIR",                        type:"Fashion BTS",               year:"2024", thumb:"assets/images/projects/pearl-noir.jpg"},
    {slug:"knari-ss24.html",        title:"KNARI",                             type:"Brand Promo",               year:"2024", thumb:"assets/images/projects/knari-ss24.jpg"},
    {slug:"miles-masterclass.html", title:"MILES MASTERCLASS",                 type:"Trailer Series",            year:"2026", thumb:"assets/images/projects/miles/joe-oringel.jpg"},
    {slug:"gala-night.html",        title:"SIGNATURE ESTATES X HARPER'S BAZAAR", type:"Event Film · Colour Grade", year:"2026", thumb:"assets/images/gala/gala-01.jpg"},
    {slug:"hyrox.html",             title:"HYROX",                             type:"Sports · Event Coverage",   year:"2026", thumb:"assets/images/hyrox/hyrox-01.jpg"},
    {slug:"concert.html",           title:"CONCERT",                           type:"Live Music · Photography",  year:"2026", thumb:"assets/images/projects/concert/concert-04.jpg"},
    {slug:"brand-showreels.html",   title:"BRAND SHOWREELS",                   type:"Showreel · Edit",           year:"2026", thumb:"assets/images/projects/showreels/ffm-fashion.jpg"},
    {slug:"wedding-films.html",     title:"WEDDING FILMS",                     type:"Wedding · Documentary",     year:"2026", thumb:"assets/images/projects/wedding/haldi-highlights.jpg"},
    {slug:"abida-onam.html",        title:"ONAM'23 W/ABIDA",                   type:"Food Show · Episode",       year:"2023", thumb:"assets/images/projects/abida/abida-01.jpg"}
  ];
  const N=PROJECTS.length;
  const MINOR=12, SPACING=MINOR*8, PAD=SPACING*24;   /* PAD a multiple of 96 keeps every tick rhythm aligned */
  const BASE='../';
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage=document.getElementById('wksStage');
  const track=document.getElementById('wksTrack');
  const labelEl=document.getElementById('wksLabel');
  const titleEl=document.getElementById('wksTitle');
  const metaEl=document.getElementById('wksMeta');
  const idxEl=document.getElementById('wksIdx');
  const live=document.getElementById('wksLive');
  const hint=document.getElementById('wksHint');
  const bgImgs=wks.querySelectorAll('.wks-bg img');
  if(!stage||!track||!labelEl) return;

  if(hint && window.matchMedia('(pointer: coarse)').matches) hint.textContent='Swipe:[on]';

  const here=Math.max(0,PROJECTS.findIndex(p=>p.slug===wks.dataset.current));
  const pad2=n=>String(n).padStart(2,'0');
  const clampIdx=v=>Math.min(N-1,Math.max(0,v));

  /* build the ruler: minor and mid ticks are CSS gradients, projects are buttons */
  track.style.width=(PAD*2+(N-1)*SPACING+1)+'px';
  const fill=document.createElement('span');
  fill.className='wks-fill'; fill.style.left=PAD+'px';
  track.appendChild(fill);
  const ticks=PROJECTS.map((p,i)=>{
    const b=document.createElement('button');
    b.type='button'; b.tabIndex=-1; b.dataset.i=i;
    b.className='wks-tick'+(i===here?' is-here':'');
    b.style.left=(PAD+i*SPACING)+'px';
    b.setAttribute('aria-label',p.title);
    track.appendChild(b);
    return b;
  });

  let pos=(here+1)%N, target=pos, centred=-1, anim=0;

  /* backdrop: two layers crossfade, and a stale load can never win */
  let bgFront=0, bgShown=-1, bgTimer=0, bgToken=0;
  function queueBg(c,delay){
    if(!bgImgs.length) return;
    clearTimeout(bgTimer);
    bgTimer=setTimeout(()=>{
      if(c===bgShown) return;
      const token=++bgToken;
      const next=bgImgs[1-bgFront], cur=bgImgs[bgFront];
      const show=()=>{
        if(token!==bgToken) return;
        next.classList.add('is-on'); cur.classList.remove('is-on');
        bgFront=1-bgFront; bgShown=c;
      };
      const src=BASE+PROJECTS[c].thumb;
      if(next.getAttribute('src')===src && next.complete) show();
      else { next.onload=show; next.src=src; }
    },delay);
  }

  let liveTimer=0;
  function setCentred(c){
    if(centred>=0) ticks[centred].classList.remove('is-centred');
    centred=c; ticks[c].classList.add('is-centred');
    const p=PROJECTS[c], isHere=c===here;
    titleEl.textContent=p.title;
    metaEl.textContent=p.type+' · '+p.year+' · ';
    const b=document.createElement('b'); b.textContent=isHere?'You are here':'Open →';
    metaEl.appendChild(b);
    labelEl.setAttribute('href',p.slug);
    labelEl.classList.toggle('is-here',isHere);
    labelEl.setAttribute('aria-disabled',isHere?'true':'false');
    idxEl.textContent='Index:['+pad2(c+1)+'/'+pad2(N)+']';
    clearTimeout(liveTimer);
    liveTimer=setTimeout(()=>{ if(live) live.textContent=p.title+', '+(c+1)+' of '+N+(isHere?', current page':''); },300);
    queueBg(c, dragging?170:40);
  }

  function render(){
    const x=PAD+pos*SPACING;
    track.style.transform='translate3d('+(stage.clientWidth/2-x).toFixed(2)+'px,0,0)';
    fill.style.width=Math.max(0,x-PAD)+'px';
    const c=clampIdx(Math.round(pos));
    if(c!==centred) setCentred(c);
  }

  function animateTo(t){
    cancelAnimationFrame(anim);
    target=clampIdx(t);
    if(reduce){ pos=target; render(); return; }
    const from=pos, d=target-from;
    if(Math.abs(d)<0.001){ pos=target; render(); return; }
    const dur=Math.min(900,280+Math.abs(d)*90), t0=performance.now();
    const step=now=>{
      const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,4);
      pos=from+d*e; render();
      if(k<1) anim=requestAnimationFrame(step);
    };
    anim=requestAnimationFrame(step);
  }

  /* drag: capture only after real movement, so a plain click on the
     label still reaches the link */
  let dragging=false, moved=false, startX=0, startPos=0, lastX=0, lastT=0, vel=0;
  stage.addEventListener('pointerdown',e=>{
    if(e.button!==0) return;
    dragging=true; moved=false;
    startX=lastX=e.clientX; startPos=pos; lastT=performance.now(); vel=0;
  });
  stage.addEventListener('pointermove',e=>{
    if(typeof fxHover!=='undefined') fxHover=true;
    if(!dragging) return;
    const dx=e.clientX-startX;
    if(!moved){
      if(Math.abs(dx)<=5) return;
      moved=true; cancelAnimationFrame(anim);
      stage.classList.add('is-dragging');
      try{ stage.setPointerCapture(e.pointerId); }catch(_){}
    }
    let p=startPos-dx/SPACING;
    if(p<0) p*=0.35; else if(p>N-1) p=(N-1)+(p-(N-1))*0.35;   /* rubber band past the ends */
    const now=performance.now(), dt=Math.max(1,now-lastT);
    vel=0.75*vel+0.25*((-(e.clientX-lastX)/SPACING)/dt*1000);
    lastX=e.clientX; lastT=now;
    pos=p; render();
  });
  const endDrag=()=>{
    if(!dragging) return;
    dragging=false; stage.classList.remove('is-dragging');
    if(moved) animateTo(Math.round(pos+Math.max(-4,Math.min(4,vel*0.16))));
  };
  stage.addEventListener('pointerup',endDrag);
  stage.addEventListener('pointercancel',endDrag);
  stage.addEventListener('mouseleave',()=>{ if(typeof fxHover!=='undefined') fxHover=false; });

  /* a drag must not also count as a click on the label or a tick */
  stage.addEventListener('click',e=>{
    if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; }
  },true);

  stage.querySelector('.wks-rail').addEventListener('click',e=>{
    const t=e.target.closest('.wks-tick');
    if(t){ animateTo(+t.dataset.i); return; }
    const r=stage.getBoundingClientRect();
    animateTo(Math.round(pos+(e.clientX-(r.left+r.width/2))/SPACING));
  });

  stage.addEventListener('keydown',e=>{
    const from=Math.round(target);
    let t=null;
    if(e.key==='ArrowRight') t=from+1;
    else if(e.key==='ArrowLeft') t=from-1;
    else if(e.key==='Home') t=0;
    else if(e.key==='End') t=N-1;
    else if((e.key==='Enter'||e.key===' ') && e.target===stage){
      e.preventDefault();
      if(centred!==here) labelEl.click();
      return;
    }
    if(t!==null){ e.preventDefault(); animateTo(t); }
  });

  /* trackpad sideways scroll scrubs; vertical scroll is passed through */
  let wheelTimer=0;
  stage.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    pos=Math.min(N-0.7,Math.max(-0.3,pos+e.deltaX/SPACING));
    render();
    clearTimeout(wheelTimer);
    wheelTimer=setTimeout(()=>animateTo(Math.round(pos)),140);
  },{passive:false});

  window.addEventListener('resize',render);
  render();
})();
