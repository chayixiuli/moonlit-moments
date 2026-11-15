(() => {
  'use strict';
  const messages = [
    ['给此刻的你', '你不必成为谁的月亮。\n做自己的星星，也很明亮。'],
    ['关于遇见', '有些相遇很轻，\n却让后来的风，都变得温柔。'],
    ['关于想念', '如果想念有声音，\n今晚的风，一定很热闹。'],
    ['关于陪伴', '最好的浪漫，是有人愿意\n和你一起，浪费一点时间。'],
    ['关于明天', '慢一点也没关系。\n花会开，明天也会有好事发生。'],
    ['关于浪漫', '把寻常的日子过得郑重，\n一顿晚饭，也能成为纪念日。'],
    ['晚安', '愿你睡去时心里有月光，\n醒来时，眼里有晴天。']
  ];
  const stars = [...document.querySelectorAll('.wish-star')];
  const collected = new Set();
  const message = document.querySelector('#star-message');
  function collect(index) {
    collected.add(index);
    stars.forEach((star, i) => { star.classList.toggle('selected', collected.has(i)); star.setAttribute('aria-pressed', String(collected.has(i))); });
    document.querySelector('#note-index').textContent = `星光 ${String(index + 1).padStart(2, '0')} / ${messages[index][0]}`;
    message.replaceChildren(...messages[index][1].split('\n').flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    document.querySelector('#collected-label').textContent = collected.size === messages.length ? '七颗星，一整夜的温柔。' : `已收藏 ${collected.size} / ${messages.length} 颗星光`;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) message.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:500});
    if (musicOn && audio?.state === 'running') bell([523.25,587.33,659.25,783.99,880,1046.5,1174.66][index], audio.currentTime, .035);
  }
  stars.forEach((star, index) => { star.setAttribute('aria-pressed', 'false'); star.addEventListener('click', () => collect(index)); });
  let last = -1;
  document.querySelector('#collect-star').addEventListener('click', () => {
    const unseen = messages.map((_, i) => i).filter(i => !collected.has(i));
    const candidates = unseen.length ? unseen : messages.map((_, i) => i).filter(i => i !== last);
    last = candidates[Math.floor(Math.random() * candidates.length)];
    collect(last);
  });
  const dialog = document.querySelector('#letter-dialog');
  document.querySelector('#open-letter').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-letter').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  const date = new Date();
  document.querySelector('#night-date').textContent = `${String(date.getMonth()+1).padStart(2,'0')} / ${String(date.getDate()).padStart(2,'0')} · 月色正好`;

  // Original, locally synthesized ambient sound; no external audio downloads.
  let audio, master, reverb, musicOn = false, scheduler, step = 0;
  const toggle = document.querySelector('#music-toggle');
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  function initAudio() {
    audio = new AudioContextClass();
    master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination);
    const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800; filter.connect(master);
    reverb = audio.createConvolver();
    const length = Math.floor(audio.sampleRate * 3.5), impulse = audio.createBuffer(2,length,audio.sampleRate);
    for (let c=0;c<2;c++) { const samples=impulse.getChannelData(c); for(let i=0;i<length;i++) samples[i]=(Math.random()*2-1)*Math.pow(1-i/length,3.5)*.55; }
    reverb.buffer=impulse; reverb.connect(filter);
  }
  function bell(frequency, time, level=.065) {
    const osc=audio.createOscillator(), gain=audio.createGain();
    osc.type='sine'; osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(level,time+.08); gain.gain.exponentialRampToValueAtTime(.0001,time+5.5);
    osc.connect(gain); gain.connect(master); gain.connect(reverb); osc.start(time); osc.stop(time+6);
  }
  const chords=[[130.81,164.81,196,293.66],[110,164.81,220,261.63],[87.31,130.81,174.61,261.63],[98,146.83,196,293.66]];
  function schedule() {
    if (!musicOn || document.hidden) return;
    const chord=chords[step++ % chords.length], time=audio.currentTime;
    chord.forEach((frequency,i)=>bell(frequency,time+i*.65,.038));
    bell(chord[2]*2,time+3.2,.026); bell(chord[1]*2,time+5.1,.022);
  }
  function updateMusicUI() {
    toggle.setAttribute('aria-pressed',String(musicOn)); toggle.setAttribute('aria-label',musicOn?'暂停夜间音乐':'开启夜间音乐');
    document.querySelector('#music-label').textContent=musicOn?'夜晚正在轻唱':'听见夜晚';
    document.querySelector('.music-state').textContent=musicOn?'ON':'OFF';
  }
  toggle.addEventListener('click',async()=>{
    toggle.disabled=true;
    try {
      if (!AudioContextClass) throw new Error('unsupported');
      if (!audio) initAudio();
      if (!musicOn) { await audio.resume(); musicOn=true; master.gain.cancelScheduledValues(audio.currentTime); master.gain.setTargetAtTime(.62,audio.currentTime,1.2); schedule(); scheduler=setInterval(schedule,8500); }
      else { musicOn=false; clearInterval(scheduler); master.gain.cancelScheduledValues(audio.currentTime); master.gain.setTargetAtTime(0,audio.currentTime,.3); }
      updateMusicUI();
    } catch { musicOn=false;clearInterval(scheduler);updateMusicUI();document.querySelector('#audio-status').textContent='当前浏览器暂时无法播放音乐，仍然可以欣赏星空和阅读晚安信。'; document.querySelector('#music-label').textContent='音乐暂不可用'; }
    finally { toggle.disabled=false; }
  });
  document.addEventListener('visibilitychange',async()=>{if(!audio)return;try{if(document.hidden)await audio.suspend();else if(musicOn)await audio.resume();}catch{document.querySelector('#audio-status').textContent='音乐已暂停，请重新点击音乐按钮。';musicOn=false;clearInterval(scheduler);updateMusicUI();}});

  const canvas=document.querySelector('#sky'), ctx=canvas.getContext('2d');
  function paintSky() {
    if (!ctx) return;
    const rect=canvas.getBoundingClientRect(), ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    let seed=1527;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const count=Math.round(rect.width*.19);
    for(let i=0;i<count;i++){const x=random()*rect.width,y=random()*rect.height*.74,r=random()*.9+.25;ctx.beginPath();ctx.fillStyle=`rgba(230,235,218,${random()*.5+.13})`;ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    // A quiet, distant trail in the upper sky.
    const x=rect.width*.40,y=rect.height*.16,gradient=ctx.createLinearGradient(x-65,y+23,x,y);gradient.addColorStop(0,'#d7ddce00');gradient.addColorStop(1,'#d7ddce70');ctx.strokeStyle=gradient;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-65,y+23);ctx.lineTo(x,y);ctx.stroke();
  }
  paintSky();window.addEventListener('resize',paintSky);
})();
