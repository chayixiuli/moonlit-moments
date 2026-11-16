(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const notes = {
  "tired": [
    [
      "给想充充电的你",
      "窗边的阳光刚刚好，\n一起舒服地窝一会儿。",
      "伸个懒腰，喝口温热的茶。\n让喜欢的音乐，陪你舒服地待一会儿。"
    ],
    [
      "给自己加一点喜欢",
      "今天的小安排，\n可以有一项叫「好好享受」。",
      "选一首喜欢的歌，找个舒服的姿势。\n这几分钟，就按你喜欢的方式过。"
    ],
    [
      "一份来自小家的邀请",
      "小猫已经窝好了，\n你的位置，也一直留着。",
      "靠一靠软垫，看看窗外。\n有阳光的地方，很适合发一会儿呆。"
    ]
  ],
  "sad": [
    [
      "送你一个软乎乎的抱抱",
      "先收下一个抱抱，\n再来一点暖暖的陪伴。",
      "这里有热茶、小花，还有两个小家伙。\n喜欢哪一样，就先和它待一会儿。"
    ],
    [
      "给想被惦记的你",
      "这张纸条，\n是专门留给你的小小偏爱。",
      "把喜欢的点心放进今天，\n也给自己留一句好听的话。"
    ],
    [
      "想把这句话说给你",
      "见到你，真好。\n今天也想和你分享一点甜。",
      "找一个聊得来的朋友，发个「在吗」。\n聊聊近况，分享一件小事，都很好。"
    ]
  ],
  "busy": [
    [
      "给想放放空的你",
      "让脑袋放个小假，\n一起看一会儿云吧。",
      "看看云朵怎么飘，再跟着呼吸几次。\n按自己的节奏，舒服地待一会儿。"
    ],
    [
      "一张慢悠悠的小纸条",
      "风在吹，茶正香，\n今天也有值得停一停的风景。",
      "把目光移向窗边，找一种喜欢的颜色。\n像散步一样，慢慢看一看身边。"
    ],
    [
      "给今天留一点小空闲",
      "想走走，就去走走。\n想坐坐，这里也有位置。",
      "伸伸手臂，活动一下肩膀。\n顺便想想，晚饭吃点什么好吃的。"
    ]
  ],
  "happy": [
    [
      "给想来点甜的你",
      "今天的小快乐，\n可以从一口喜欢的味道开始。",
      "一杯奶茶、一块饼干，或一颗甜草莓。\n选一个喜欢的，认真享受第一口。"
    ],
    [
      "一份快乐小邀请",
      "发现好东西的时候，\n记得也给自己留一份。",
      "一首新歌，一张好看的照片，\n都值得放进今天的收藏夹。"
    ],
    [
      "送你一个小小的盼头",
      "给平常的一天，\n添一点「我喜欢」。",
      "路过花店时看看花，散步时换条小路。\n说不定，刚好遇见一件可爱的小事。"
    ]
  ]
};
  let selectedMood = 'tired', noteIndex = 0;
  function lines(element,text) {
    element.replaceChildren(...text.split('\n').flatMap((line,index)=>index?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));
  }
  function renderNote() {
    const note=notes[selectedMood][noteIndex];$('#paper-label').textContent=note[0];lines($('#paper-title'),note[1]);lines($('#paper-advice'),note[2]);
    document.querySelectorAll('[data-mood]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mood===selectedMood)));
    if(!reducedMotion) $('.paper-content').animate([{opacity:.15,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:350});
  }
  document.querySelectorAll('[data-mood]').forEach(button=>button.addEventListener('click',()=>{selectedMood=button.dataset.mood;noteIndex=0;renderNote();}));
  $('#another-note').addEventListener('click',()=>{noteIndex=(noteIndex+1)%notes[selectedMood].length;renderNote();});

  let growth=0,watering=false,waterTimer;
  const plantDescriptions=['一颗等待浇水的小种子','刚刚长出嫩叶的小芽','长出花苞的小花','一朵已经盛开的奶油色小花'];
  const gardenMessages=['一颗小种子，等你一起养大。','小芽探出头啦，和你打个招呼。','花苞藏着什么颜色？马上就知道啦。','花开啦！这一朵，送给今天的你。'];
  function renderPlant(){
    $('#plant-stage').dataset.growth=String(growth);$('#plant-picture').setAttribute('aria-label',plantDescriptions[growth]);$('#garden-status').textContent=gardenMessages[growth];$('#water-label').textContent=growth===3?'再种一朵小花':'给小花浇点水';$('#growth-count').textContent=growth===3?'收获一朵小开心':growth===0?'小种子准备好啦。':`已浇水 ${growth} / 3 次`;
  }
  $('#water-flower').addEventListener('click',()=>{
    if(watering)return;if(growth===3){growth=0;renderPlant();return;}
    watering=true;$('#plant-stage').classList.add('watering');$('#water-flower').disabled=true;$('#water-label').textContent='小花正在喝水…';
    waterTimer=setTimeout(()=>{growth++;$('#plant-stage').classList.remove('watering');renderPlant();watering=false;$('#water-flower').disabled=false;},reducedMotion?150:850);
  });
  const littleNotes={tea:'茶泡好啦。捧在手里暖一暖，再慢慢喝第一口。',cat:'小狗往旁边挪了挪，小猫抬头看了看：你来啦，一起窝一会儿吧。',sun:'阳光刚好照到窗边，适合伸个懒腰，再给自己拍张喜欢的照片。'};
  document.querySelectorAll('[data-little]').forEach(button=>{button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{document.querySelectorAll('[data-little]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));$('#little-message').textContent=littleNotes[button.dataset.little];});});

  const breathDialog=$('#breath-dialog');let breathing=false,breathTimer,breathStep=0;
  function stopBreath(message='好呀，舒服地待一会儿。'){breathing=false;clearTimeout(breathTimer);$('#breath-cloud').className='breath-cloud';$('#breath-cue').textContent=message;$('#breath-toggle').textContent='再歇一会儿';}
  function nextBreath(){
    if(!breathing)return;if(breathStep===6){stopBreath('好啦，接着享受今天的小美好。');return;}
    const inhale=breathStep%2===0;$('#breath-cue').textContent=inhale?'轻轻吸气…':'慢慢呼气…';$('#breath-cloud').className=`breath-cloud ${inhale?'inhale':'exhale'}`;breathStep++;breathTimer=setTimeout(nextBreath,4000);
  }
  $('#open-breath').addEventListener('click',()=>breathDialog.showModal());$('#close-breath').addEventListener('click',()=>breathDialog.close());
  breathDialog.addEventListener('close',()=>{stopBreath('准备好了，就开始吧。');$('#breath-toggle').textContent='开始小憩';});
  $('#breath-toggle').addEventListener('click',()=>{if(breathing){stopBreath();return;}breathing=true;breathStep=0;$('#breath-toggle').textContent='先歇到这里';nextBreath();});

  // The postcard is generated locally, with a preview for long-press saving on phones.
  const cardDialog=$('#card-dialog');
  function wrapText(context,text,x,y,maxWidth,lineHeight){
    for(const paragraph of text.split('\n')){let line='';for(const char of paragraph){if(context.measureText(line+char).width>maxWidth&&line){context.fillText(line,x,y);y+=lineHeight;line=char;}else line+=char;}context.fillText(line,x,y);y+=lineHeight;}return y;
  }
  function createCard(){
    const note=notes[selectedMood][noteIndex],canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const c=canvas.getContext('2d');if(!c)throw new Error('Canvas unavailable');
    c.fillStyle='#f8f4e8';c.fillRect(0,0,1080,1350);c.strokeStyle='#dce0cc';c.lineWidth=2;c.strokeRect(48,48,984,1254);
    c.fillStyle='#ebc991';c.beginPath();c.arc(540,205,55,Math.PI,0);c.fill();c.strokeStyle='#819372';c.lineWidth=3;c.beginPath();c.moveTo(465,211);c.lineTo(615,211);c.stroke();
    c.fillStyle='#7d8b6e';c.font='26px "Microsoft YaHei", sans-serif';c.textAlign='center';c.fillText('歇 一 会 儿',540,275);c.fillStyle='#a29a80';c.font='22px "Microsoft YaHei", sans-serif';c.fillText(note[0],540,394);
    c.textAlign='left';c.fillStyle='#536c52';c.font='44px "Noto Serif SC", "SimSun", serif';const bottom=wrapText(c,note[1],130,520,820,79);
    c.fillStyle='#8c907a';c.font='27px "Microsoft YaHei", sans-serif';wrapText(c,note[2],130,bottom+68,820,51);
    c.strokeStyle='#c2c9ad';c.lineWidth=2;c.beginPath();c.moveTo(130,1057);c.lineTo(950,1057);c.stroke();c.textAlign='center';c.fillStyle='#9b9e86';c.font='25px "Noto Serif SC", "SimSun", serif';c.fillText('你来啦，一起歇一会儿。',540,1132);c.font='italic 26px Georgia, serif';c.fillText('take your time.',540,1200);
    return canvas.toDataURL('image/png');
  }
  $('#save-note').addEventListener('click',()=>{try{const url=createCard();$('#card-preview').src=url;$('#download-card').href=url;cardDialog.showModal();}catch{$('#app-status').textContent='纸条暂时没准备好，可以先截图，把这份喜欢带走。';}});
  $('#close-card').addEventListener('click',()=>cardDialog.close());
  [cardDialog,breathDialog].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));

  // Original ambient notes; no remote audio or automatic playback.
  let audio,master,reverb,musicOn=false,scheduler,chordStep=0;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  function initAudio(){
    audio=new AudioContextClass();master=audio.createGain();master.gain.value=0;master.connect(audio.destination);reverb=audio.createConvolver();
    const size=Math.floor(audio.sampleRate*3.2),impulse=audio.createBuffer(2,size,audio.sampleRate);for(let channel=0;channel<2;channel++){const samples=impulse.getChannelData(channel);for(let i=0;i<size;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/size,3)*.45;}reverb.buffer=impulse;const wet=audio.createGain();wet.gain.value=.32;reverb.connect(wet);wet.connect(master);
  }
  function tone(frequency,time,level){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.08);gain.gain.exponentialRampToValueAtTime(.0001,time+5);osc.connect(gain);gain.connect(master);gain.connect(reverb);osc.start(time);osc.stop(time+5.2);}
  const chords=[[130.81,196,261.63,329.63],[110,164.81,220,329.63],[87.31,174.61,261.63,349.23],[98,146.83,196,293.66]];
  function scheduleMusic(){if(!musicOn||document.hidden)return;const time=audio.currentTime,chord=chords[chordStep++%chords.length];chord.forEach((note,index)=>tone(note,time+index*.8,.034));tone(chord[2]*2,time+4.5,.018);}
  function renderMusic(){$('#music-toggle').setAttribute('aria-pressed',String(musicOn));$('#music-toggle').setAttribute('aria-label',musicOn?'暂停轻音乐':'开启轻音乐');$('#music-label').textContent=musicOn?'小家正在轻唱':'听一点轻音乐';}
  $('#music-toggle').addEventListener('click',async()=>{
    $('#music-toggle').disabled=true;
    try{if(!AudioContextClass)throw new Error('unsupported');if(!audio)initAudio();if(musicOn){musicOn=false;clearInterval(scheduler);master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(0,audio.currentTime,.3);}else{await audio.resume();musicOn=true;master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(.6,audio.currentTime,.7);scheduleMusic();scheduler=setInterval(scheduleMusic,8000);}renderMusic();}
    catch{musicOn=false;clearInterval(scheduler);renderMusic();$('#music-label').textContent='音乐暂不可用';$('#app-status').textContent='当前浏览器暂时无法播放音乐，仍然可以收下纸条和种一朵花。';}finally{$('#music-toggle').disabled=false;}
  });
  document.addEventListener('visibilitychange',async()=>{if(document.hidden&&breathing)stopBreath('云朵先歇一会儿，等你回来。');if(!audio)return;try{if(document.hidden)await audio.suspend();else if(musicOn)await audio.resume();}catch{musicOn=false;clearInterval(scheduler);renderMusic();}});
  window.addEventListener('pagehide',()=>{clearTimeout(waterTimer);clearTimeout(breathTimer);clearInterval(scheduler);if(musicOn){musicOn=false;master.gain.cancelScheduledValues(audio.currentTime);master.gain.setValueAtTime(0,audio.currentTime);renderMusic();}if(watering){watering=false;$('#plant-stage').classList.remove('watering');$('#water-flower').disabled=false;renderPlant();}if(breathing)stopBreath();});
})();
