// The small recording marker is now a real, non-intercepting page cursor.
export function mountCursor(surface){
  const capable=window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const cursor=document.createElement('div');cursor.id='site-cursor';cursor.setAttribute('aria-hidden','true');
  cursor.innerHTML='<span class="cursor-ring"></span>';document.body.append(cursor);
  const listeners=[];
  const on=(target,name,fn,options)=>{target.addEventListener(name,fn,options);listeners.push(()=>target.removeEventListener(name,fn,options));};
  const hide=()=>{cursor.classList.remove('visible','pressed','interactive');surface.classList.remove('custom-cursor-active');};
  const move=e=>{
    // Keep native select menus and touch/pen input under browser control.
    if(!capable.matches||e.pointerType!=='mouse'||e.target.closest('select,option')){hide();return;}
    cursor.style.transform=`translate3d(${e.clientX}px,${e.clientY}px,0)`;
    cursor.classList.toggle('interactive',Boolean(e.target.closest('button:not(:disabled),a[href],input:not(:disabled),[role="button"]')));
    cursor.classList.add('visible');surface.classList.add('custom-cursor-active');
  };
  on(surface,'pointermove',move,{passive:true});
  on(surface,'pointerenter',move,{passive:true});
  on(surface,'pointerleave',hide);
  on(surface,'pointerdown',e=>{move(e);if(e.pointerType==='mouse'&&e.button===0&&cursor.classList.contains('visible'))cursor.classList.add('pressed');},{passive:true});
  on(window,'pointerup',()=>cursor.classList.remove('pressed'),{passive:true});
  on(window,'pointercancel',hide);
  on(window,'blur',hide);
  on(document,'keydown',hide);
  on(document,'visibilitychange',()=>{if(document.hidden)hide();});
  on(document,'pointerdown',e=>{if(e.pointerType!=='mouse')hide();},{passive:true});
  on(capable,'change',hide);
  return()=>{hide();listeners.forEach(off=>off());cursor.remove();};
}
