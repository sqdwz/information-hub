import {smooth} from './timeline.js';

// Empty data-enter-url keeps this as a preview. Hosts can handle starsea:enter.
export function mountEntry(button){
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let available=false,active=false,finishTimer=0,resetTimer=0;
  function reset(){
    clearTimeout(finishTimer);clearTimeout(resetTimer);
    active=false;button.classList.remove('is-entering');
    button.setAttribute('aria-busy','false');button.setAttribute('aria-disabled',String(!available));button.disabled=!available;
  }
  function update(time,{ready=true,clean=false}={}){
    const still=reduced.matches&&time>=5;
    const line=still?1:smooth(5.05,5.65,time),copy=still?1:smooth(5.35,5.95,time);
    available=ready&&!clean&&copy===1;
    if(!available&&active)reset();
    button.style.setProperty('--entry-line',line.toFixed(4));
    button.style.setProperty('--entry-copy',copy.toFixed(4));
    button.classList.toggle('is-visible',ready&&!clean&&line>0);
    button.classList.toggle('is-ready',available);
    button.setAttribute('aria-hidden',String(!available));
    button.setAttribute('aria-disabled',String(!available||active));
    button.disabled=!available;
  }
  function enter(){
    if(!available||active)return;
    active=true;button.setAttribute('aria-disabled','true');button.classList.add('is-entering');
    button.setAttribute('aria-busy','true');
    finishTimer=setTimeout(()=>{
      const url=button.dataset.enterUrl.trim()||null;
      const event=new CustomEvent('starsea:enter',{bubbles:true,cancelable:true,detail:{url}});
      const useDefault=button.dispatchEvent(event);
      if(useDefault&&url)window.location.assign(url);
      resetTimer=setTimeout(reset,reduced.matches?0:280);
    },reduced.matches?0:320);
  }
  const visibility=()=>{if(document.hidden)reset();};
  button.addEventListener('click',enter);
  document.addEventListener('visibilitychange',visibility);
  return {update,dispose(){reset();button.removeEventListener('click',enter);document.removeEventListener('visibilitychange',visibility);}};
}
