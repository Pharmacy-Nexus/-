
(() => {
  const data = window.NOVEL_DATA;
  const $ = (s) => document.querySelector(s);
  const state = {
    index: Number(localStorage.getItem('wa5-current') || 0),
    sound: localStorage.getItem('wa5-sound') === 'on',
    ambient: null,
    audioCtx: null,
    font: localStorage.getItem('wa5-font') || 'medium',
    theme: localStorage.getItem('wa5-theme') || 'night'
  };
  const landing=$('#landing'), app=$('#app'), drawer=$('#drawer'), backdrop=$('#drawerBackdrop'), settings=$('#settings');
  document.body.dataset.theme=state.theme;

  function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
  function openApp(index=state.index){ landing.hidden=true; app.hidden=false; renderChapter(index,false); window.scrollTo(0,0); }
  $('#startReading').onclick=()=>openApp(0);
  const saved=localStorage.getItem('wa5-current');
  if(saved && Number(saved)>0){$('#resumeReading').hidden=false;$('#resumeReading').onclick=()=>openApp(Number(saved));}
  $('#discoverBtn').onclick=()=>openApp(0);

  function chapterNumber(item){ if(item.title.startsWith('استهلال')) return 'ب'; if(item.title.startsWith('خاتمة')) return 'خ'; const m=item.title.match(/الفصل\s+([^:]+)/); return m ? item.order : item.order; }
  function buildList(filter=''){
    const nav=$('#chapterList');nav.innerHTML='';let lastSection='';
    data.items.forEach((item,idx)=>{
      const hay=(item.title+' '+item.era+' '+item.section).toLowerCase(); if(filter && !hay.includes(filter.toLowerCase())) return;
      if(item.section!==lastSection){const h=document.createElement('div');h.className='section-label';h.textContent=item.section;nav.appendChild(h);lastSection=item.section;}
      const b=document.createElement('button');b.className='chapter-item'+(idx===state.index?' active':'');b.dataset.index=idx;
      b.innerHTML=`<span class="num">${idx===0?'ب':idx===data.items.length-1?'خ':idx}</span><span class="label"><strong>${item.title}</strong><small>${item.era} · ${item.scene}</small></span><span class="mins">${item.minutes} د</span>`;
      b.onclick=()=>{renderChapter(idx);closeDrawer()};nav.appendChild(b);
    });
  }
  buildList();
  $('#chapterSearch').oninput=e=>buildList(e.target.value.trim());
  function openDrawer(){drawer.classList.add('open');backdrop.classList.add('show')}
  function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('show')}
  $('#menuBtn').onclick=openDrawer;$('#closeDrawer').onclick=closeDrawer;backdrop.onclick=closeDrawer;

  function renderChapter(idx,scroll=true){
    idx=Math.max(0,Math.min(data.items.length-1,idx));state.index=idx;localStorage.setItem('wa5-current',idx);const c=data.items[idx];
    $('#topChapter').textContent=c.title;$('#sceneTitle').textContent=c.title;$('#sceneEra').textContent=c.era;$('#scenePlace').textContent=c.scene;$('#sceneSymbol').textContent=c.icon;$('#sceneLead').textContent=c.firstLine;
    const hero=$('#sceneHero');hero.className='scene-hero theme-'+c.theme;
    $('#chapterSection').textContent=c.section;$('#chapterTitle').textContent=c.title;$('#chapterEra').textContent=c.era;$('#chapterTime').textContent=`قراءة ${c.minutes} دقائق`;$('#chapterWords').textContent=`${c.wordCount.toLocaleString('ar-EG')} كلمة`;$('#chapterBody').innerHTML=c.html;
    const prev=$('#prevChapter'),next=$('#nextChapter');prev.disabled=idx===0;next.disabled=idx===data.items.length-1;
    prev.querySelector('strong').textContent=idx>0?data.items[idx-1].title:'بداية الرواية';next.querySelector('strong').textContent=idx<data.items.length-1?data.items[idx+1].title:'انتهت الرواية';
    buildList($('#chapterSearch').value.trim());document.title=`${c.title} — الوريث الخامس`;
    if(scroll) window.scrollTo({top:0,behavior:'smooth'});
    stopAmbient();if(state.sound){setTimeout(()=>startAmbient(c.sound),450)}
  }
  $('#prevChapter').onclick=()=>state.index>0&&renderChapter(state.index-1);$('#nextChapter').onclick=()=>state.index<data.items.length-1&&renderChapter(state.index+1);

  function updateProgress(){
    if(app.hidden) return; const doc=document.documentElement; const max=doc.scrollHeight-innerHeight; const p=max>0?scrollY/max*100:0; $('#pageProgress').style.width=p+'%';
  }
  addEventListener('scroll',updateProgress,{passive:true});

  $('#settingsBtn').onclick=()=>settings.classList.toggle('open');$('#closeSettings').onclick=()=>settings.classList.remove('open');
  document.querySelectorAll('[data-font]').forEach(b=>{if(b.dataset.font===state.font)b.classList.add('active');else b.classList.remove('active');b.onclick=()=>{document.querySelectorAll('[data-font]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.font=b.dataset.font;localStorage.setItem('wa5-font',state.font);document.documentElement.style.setProperty('--font-size',state.font==='small'?'18px':state.font==='large'?'24px':'21px')}});
  document.documentElement.style.setProperty('--font-size',state.font==='small'?'18px':state.font==='large'?'24px':'21px');
  document.querySelectorAll('[data-reading-theme]').forEach(b=>{b.classList.toggle('active',b.dataset.readingTheme===state.theme);b.onclick=()=>{state.theme=b.dataset.readingTheme;document.body.dataset.theme=state.theme;localStorage.setItem('wa5-theme',state.theme);document.querySelectorAll('[data-reading-theme]').forEach(x=>x.classList.toggle('active',x===b))}});
  $('#resetProgress').onclick=()=>{localStorage.removeItem('wa5-current');renderChapter(0);toast('تم مسح تقدّم القراءة')};

  function ensureAudio(){if(!state.audioCtx)state.audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(state.audioCtx.state==='suspended')state.audioCtx.resume();return state.audioCtx}
  function noiseBuffer(seconds=2){const ctx=ensureAudio(),buffer=ctx.createBuffer(1,ctx.sampleRate*seconds,ctx.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return buffer}
  function oneShot(type){
    const ctx=ensureAudio(),now=ctx.currentTime,g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.17,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+1.1);
    if(type==='camera'){const o=ctx.createOscillator();o.type='square';o.frequency.setValueAtTime(230,now);o.frequency.exponentialRampToValueAtTime(65,now+.08);o.connect(g);o.start(now);o.stop(now+.12);const src=ctx.createBufferSource();src.buffer=noiseBuffer(.18);src.connect(g);src.start(now+.02);src.stop(now+.2)}
    else if(type==='stone'){const o=ctx.createOscillator();o.type='triangle';o.frequency.setValueAtTime(96,now);o.frequency.exponentialRampToValueAtTime(38,now+.8);o.connect(g);o.start();o.stop(now+1.1)}
    else if(type==='steps'){[0,.34,.72].forEach((t,n)=>{const o=ctx.createOscillator(),gg=ctx.createGain();o.frequency.value=75-n*6;gg.gain.setValueAtTime(.0001,now+t);gg.gain.exponentialRampToValueAtTime(.12,now+t+.01);gg.gain.exponentialRampToValueAtTime(.0001,now+t+.16);o.connect(gg);gg.connect(ctx.destination);o.start(now+t);o.stop(now+t+.18)})}
    else if(type==='paper'){const src=ctx.createBufferSource(),f=ctx.createBiquadFilter();src.buffer=noiseBuffer(.7);f.type='bandpass';f.frequency.value=1800;f.Q.value=.55;src.connect(f);f.connect(g);src.start();src.stop(now+.72)}
    else if(type==='water'){const src=ctx.createBufferSource(),f=ctx.createBiquadFilter();src.buffer=noiseBuffer(1.1);f.type='lowpass';f.frequency.value=580;src.connect(f);f.connect(g);src.start();src.stop(now+1.05)}
    else {const src=ctx.createBufferSource(),f=ctx.createBiquadFilter();src.buffer=noiseBuffer(1.2);f.type='lowpass';f.frequency.value=390;src.connect(f);f.connect(g);src.start();src.stop(now+1.15)}
  }
  function startAmbient(type){
    stopAmbient();const ctx=ensureAudio(),gain=ctx.createGain();gain.gain.value=.035;gain.connect(ctx.destination);const nodes=[];
    if(type==='pulse'){const o=ctx.createOscillator();o.type='sine';o.frequency.value=48;const p=ctx.createGain();p.gain.value=0;o.connect(p);p.connect(gain);o.start();let alive=true;const beat=()=>{if(!alive)return;const n=ctx.currentTime;p.gain.cancelScheduledValues(n);p.gain.setValueAtTime(.0001,n);p.gain.exponentialRampToValueAtTime(.7,n+.025);p.gain.exponentialRampToValueAtTime(.0001,n+.17);setTimeout(beat,900)};beat();nodes.push({stop:()=>{alive=false;o.stop()}})}
    else {const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();src.buffer=noiseBuffer(4);src.loop=true;filter.type='lowpass';filter.frequency.value=type==='rain'?1600:type==='water'?700:420;src.connect(filter);filter.connect(gain);src.start();nodes.push(src)}
    if(type==='camera')oneShot('camera');if(type==='stone')oneShot('stone');if(type==='paper')oneShot('paper');
    state.ambient={gain,nodes};$('#soundBtn').textContent='●';$('#sceneSound').innerHTML='إيقاف أجواء الفصل <span>●</span>';
  }
  function stopAmbient(){if(state.ambient){try{state.ambient.nodes.forEach(n=>n.stop())}catch(e){}try{state.ambient.gain.disconnect()}catch(e){}state.ambient=null}$('#soundBtn').textContent=state.sound?'●':'◌';$('#sceneSound').innerHTML='تشغيل أجواء الفصل <span>◌</span>'}
  function toggleSound(){state.sound=!state.sound;localStorage.setItem('wa5-sound',state.sound?'on':'off');if(state.sound){startAmbient(data.items[state.index].sound);toast('تم تشغيل المؤثرات البيئية — بلا موسيقى')}else{stopAmbient();toast('تم إيقاف المؤثرات')}}
  $('#soundBtn').onclick=toggleSound;$('#sceneSound').onclick=toggleSound;
  document.querySelectorAll('[data-sfx]').forEach(b=>b.onclick=()=>oneShot(b.dataset.sfx));

  let touchX=0;document.addEventListener('touchstart',e=>touchX=e.changedTouches[0].screenX,{passive:true});document.addEventListener('touchend',e=>{if(app.hidden)return;const d=e.changedTouches[0].screenX-touchX;if(Math.abs(d)>90){if(d>0&&state.index<data.items.length-1)renderChapter(state.index+1);if(d<0&&state.index>0)renderChapter(state.index-1)}},{passive:true});
  document.addEventListener('keydown',e=>{if(app.hidden)return;if(e.key==='ArrowLeft'&&state.index<data.items.length-1)renderChapter(state.index+1);if(e.key==='ArrowRight'&&state.index>0)renderChapter(state.index-1);if(e.key==='Escape'){closeDrawer();settings.classList.remove('open')}});

  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
