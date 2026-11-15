(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const notes = {
    tired: [
      ['给有一点累的你','今天已经用了很多力气，\n现在，可以把自己放轻一点。','先松一松肩膀，喝一口水。\n没做完的事，可以等你歇一会儿再说。'],
      ['允许自己，暂停一下','休息不需要一个理由。\n你累了，就已经足够。','找个舒服的地方坐下。\n这一小会儿，只属于你自己。'],
      ['今天，慢慢来就好','不是每一天，\n都需要交出漂亮的答卷。','把今天的清单，先折起来。\n吃点东西，也是一件值得认真做的事。']
    ],
    sad: [
      ['给有一点难过的你','难过的时候，\n不必急着把自己哄好。','想哭也好，想安静一会儿也好。\n先陪着自己的感受，慢慢走过这一刻。'],
      ['有人想轻轻告诉你','你可以不说没关系，\n也可以说，今天有一点难。','如果愿意，找一个信任的人，\n说一句「我想有人陪我待一会儿」。'],
      ['把这句话留给你','有些心情说不清楚，\n也依然值得被认真听见。','给自己一点空间。\n今晚，试着做一件让身体舒服的小事。']
    ],
    busy: [
      ['给心里有一点乱的你','不用一下子，\n把所有事情都想明白。','看看身边的一样东西，听听此刻的声音。\n先回到这里，再挑一件小事慢慢做。'],
      ['让思绪，也歇一会儿','暂时没有答案，\n也可以先好好过这一刻。','拿张纸，写下最挂心的一件事。\n其余的，让它们在纸上等一等。'],
      ['一点点，也在往前走','把很大的一天，\n拆成一个很小的下一步。','一口水，一次伸展，一件小事。\n从你现在愿意做的那一点开始。']
    ],
    happy: [
      ['给想开心一点的你','快乐有时候很小，\n小到是一口喜欢的味道。','听一首熟悉的歌，看看窗外的天。\n从一件你喜欢的小事开始，怎么样？'],
      ['一份小小的快乐邀请','今天也可以，\n为一件小事郑重地开心。','一杯温热的茶，一阵好闻的风。\n把你发现的小美好，留给自己。'],
      ['给生活加一点甜','在普通的一天里，\n给自己安排一个小盼头。','散步时换一条路，买一朵喜欢的花。\n让今天有一个属于你的小片段。']
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
  const gardenMessages=['每一点照顾，都算数。','一片小小的叶子，正在向你打招呼。','你看，有些美好，正在慢慢发生。','你给的温柔，真的开花了。'];
  function renderPlant(){
    $('#plant-stage').dataset.growth=String(growth);$('#plant-picture').setAttribute('aria-label',plantDescriptions[growth]);$('#garden-status').textContent=gardenMessages[growth];$('#water-label').textContent=growth===3?'再种一朵小花':'给小花浇点水';$('#growth-count').textContent=growth===3?'今天的小美好 +1':growth===0?'刚刚种下，慢慢来。':`已浇水 ${growth} / 3 次`;
  }
  $('#water-flower').addEventListener('click',()=>{
    if(watering)return;if(growth===3){growth=0;renderPlant();return;}
    watering=true;$('#plant-stage').classList.add('watering');$('#water-flower').disabled=true;$('#water-label').textContent='让水慢慢落下…';
    waterTimer=setTimeout(()=>{growth++;$('#plant-stage').classList.remove('watering');renderPlant();watering=false;$('#water-flower').disabled=false;},reducedMotion?150:850);
  });
  const littleNotes={tea:'一杯茶在变温。你也可以在这里，慢慢恢复自己的节奏。',cat:'小猫今天的重要安排：睡觉、伸懒腰、晒太阳。你也可以。',sun:'阳光落在哪一小块地方，哪里就可以是今天的好风景。'};
  document.querySelectorAll('[data-little]').forEach(button=>{button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{document.querySelectorAll('[data-little]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));$('#little-message').textContent=littleNotes[button.dataset.little];});});

  const breathDialog=$('#breath-dialog');let breathing=false,breathTimer,breathStep=0;
  function stopBreath(message='停在这里，也很好。'){breathing=false;clearTimeout(breathTimer);$('#breath-cloud').className='breath-cloud';$('#breath-cue').textContent=message;$('#breath-toggle').textContent='再歇一会儿';}
  function nextBreath(){
    if(!breathing)return;if(breathStep===6){stopBreath('谢谢你，留了一点时间给自己。');return;}
    const inhale=breathStep%2===0;$('#breath-cue').textContent=inhale?'轻轻吸气…':'慢慢呼气…';$('#breath-cloud').className=`breath-cloud ${inhale?'inhale':'exhale'}`;breathStep++;breathTimer=setTimeout(nextBreath,4000);
  }
  $('#open-breath').addEventListener('click',()=>breathDialog.showModal());$('#close-breath').addEventListener('click',()=>breathDialog.close());
  breathDialog.addEventListener('close',()=>{stopBreath('准备好了，就开始吧。');$('#breath-toggle').textContent='开始小憩';});
  $('#breath-toggle').addEventListener('click',()=>{if(breathing){stopBreath();return;}breathing=true;breathStep=0;$('#breath-toggle').textContent='就先停在这里';nextBreath();});

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
    c.strokeStyle='#c2c9ad';c.lineWidth=2;c.beginPath();c.moveTo(130,1057);c.lineTo(950,1057);c.stroke();c.textAlign='center';c.fillStyle='#9b9e86';c.font='25px "Noto Serif SC", "SimSun", serif';c.fillText('世界可以等一等，你先照顾自己。',540,1132);c.font='italic 26px Georgia, serif';c.fillText('take your time.',540,1200);
    return canvas.toDataURL('image/png');
  }
  $('#save-note').addEventListener('click',()=>{try{const url=createCard();$('#card-preview').src=url;$('#download-card').href=url;cardDialog.showModal();}catch{$('#app-status').textContent='纸条暂时无法生成，可以截图保存这句温柔的话。';}});
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
  function renderMusic(){$('#music-toggle').setAttribute('aria-pressed',String(musicOn));$('#music-toggle').setAttribute('aria-label',musicOn?'暂停轻音乐':'开启轻音乐');$('#music-label').textContent=musicOn?'小院正在轻唱':'听一点轻音乐';}
  $('#music-toggle').addEventListener('click',async()=>{
    $('#music-toggle').disabled=true;
    try{if(!AudioContextClass)throw new Error('unsupported');if(!audio)initAudio();if(musicOn){musicOn=false;clearInterval(scheduler);master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(0,audio.currentTime,.3);}else{await audio.resume();musicOn=true;master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(.6,audio.currentTime,.7);scheduleMusic();scheduler=setInterval(scheduleMusic,8000);}renderMusic();}
    catch{musicOn=false;clearInterval(scheduler);renderMusic();$('#music-label').textContent='音乐暂不可用';$('#app-status').textContent='当前浏览器暂时无法播放音乐，仍然可以收下纸条和种一朵花。';}finally{$('#music-toggle').disabled=false;}
  });
  document.addEventListener('visibilitychange',async()=>{if(document.hidden&&breathing)stopBreath('回来时，我们再慢慢开始。');if(!audio)return;try{if(document.hidden)await audio.suspend();else if(musicOn)await audio.resume();}catch{musicOn=false;clearInterval(scheduler);renderMusic();}});
  window.addEventListener('pagehide',()=>{clearTimeout(waterTimer);clearTimeout(breathTimer);clearInterval(scheduler);if(musicOn){musicOn=false;master.gain.cancelScheduledValues(audio.currentTime);master.gain.setValueAtTime(0,audio.currentTime);renderMusic();}if(watering){watering=false;$('#plant-stage').classList.remove('watering');$('#water-flower').disabled=false;renderPlant();}if(breathing)stopBreath();});
})();
