import { StarseaScene } from './scene.js?v=10';
import { DURATION, smooth, nextTime } from './timeline.js?v=8';
import { mountCursor } from './cursor.js?v=11';
import { mountEntry } from './entry.js?v=16';

const $ = id => document.getElementById(id);
const experience=$('experience'),loading=$('loading');
const disposeCursor=mountCursor(experience);
const entrance=mountEntry($('enter-site'));
const chars=[];
for(const line of document.querySelectorAll('[data-text]')){
  for(const text of line.dataset.text){
    const span=document.createElement('span');span.className='title-char';span.textContent=text;span.dataset.char=text;line.append(span);chars.push(span);
  }
}
let scene,time=0,playing=true,ready=false,last=0,raf=0,visibilityPlaying=false,hostActive=true;
const terminalLines=['Initializing Ruixue_Mascot...','Loading personal space...','Hello, nice to meet you! :)'];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced){time=DURATION;playing=false;}

function updateUI(){
  experience.style.setProperty('--copy-reveal',smooth(3.5,3.95,time));
  experience.style.setProperty('--desc-reveal',smooth(4.2,4.9,time));
  experience.style.setProperty('--subject-reveal',smooth(4.35,5,time));
  experience.style.setProperty('--title-breath',time>=5?(.985+.015*Math.sin(time%24*Math.PI/6)).toFixed(5):1);
  experience.style.setProperty('--hud-pulse',time>=5?(.5+.5*Math.sin(time%24*Math.PI/6)).toFixed(4):0);
  experience.style.setProperty('--cursor',time>=4.95?smooth(-.3,.3,Math.sin(time%24*Math.PI*2)).toFixed(4):0);
  entrance.update(time,{ready});
  terminalLines.forEach((text,i)=>{const count=Math.floor(text.length*smooth(4.15+i*.18,4.55+i*.18,time));const node=$(`terminal-${i+1}`);if(node.textContent!==text.slice(0,count))node.textContent=text.slice(0,count);});
  for(let i=0;i<chars.length;i++){
    const start=3.8+i*.075,reveal=smooth(start,start+.45,time);
    chars[i].style.setProperty('--reveal',reveal.toFixed(4));chars[i].style.setProperty('--visible',time>start?1:0);
    chars[i].style.setProperty('--slice-top',reveal>0&&reveal<1?`${(1-reveal)*100-2}%`:'100%');
    chars[i].style.setProperty('--slice-bottom',reveal>0&&reveal<1?`${reveal*100}%`:'0%');
    chars[i].style.setProperty('--glitch','0px');
  }
}
function draw(dt=0){scene?.render(time,dt);updateUI();}
function frame(now){
  if(!ready||!hostActive)return;
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(playing)time=nextTime(time,dt);
  draw(playing?dt:0);raf=requestAnimationFrame(frame);
}
$('retry').addEventListener('click',()=>location.reload());
experience.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch')return;
  if(e.target.closest('button,a'))scene?.releasePointer?.();
  else scene?.setPointer(e.clientX,e.clientY);
});
experience.addEventListener('pointerleave',()=>scene?.releasePointer?.());
window.addEventListener('blur',()=>scene?.releasePointer?.());
window.addEventListener('resize',()=>scene?.resize());
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){visibilityPlaying=playing;playing=false;cancelAnimationFrame(raf);}
  else if(ready&&hostActive){playing=visibilityPlaying;last=0;raf=requestAnimationFrame(frame);}
});
document.addEventListener('starsea:visibility',event=>{
  hostActive=event.detail?.active!==false;
  cancelAnimationFrame(raf);
  if(hostActive&&ready&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}
});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;cancelAnimationFrame(raf);showError('图形连接暂时中断，请重新连接瑞雪。');});
function showError(message){loading.hidden=true;$('error-message').textContent=message;$('error-panel').hidden=false;}
try{
  scene=new StarseaScene($('world'),$('light'));scene.resize();await scene.load();ready=true;draw();
  loading.classList.add('finished');setTimeout(()=>{loading.hidden=true;},550);
  last=0;if(hostActive)raf=requestAnimationFrame(frame);
}catch(error){console.error('RUIXUE initialization:',error);showError('暂时无法打开瑞雪。请确认浏览器支持 WebGL 2，并检查本地素材是否完整。');}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);scene?.dispose();disposeCursor();entrance.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
