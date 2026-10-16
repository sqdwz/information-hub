import * as THREE from './vendor/three.module.js';
import { smooth, clamp } from './timeline.js';
import { ART, SAMPLED, GROUPS, growthAt } from './structure.js';
import {lifeAt,localDisplacement,LIFE_GLSL} from './life.js?v=9';
import {ZeroGravityHair,FLOW_GLSL} from './zero-g.js?v=10';

const SCREEN_VERTEX=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const BACKGROUND=`
precision highp float;
varying vec2 vUv;uniform vec2 uViewport;uniform float uTime,uPhase;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float star(vec2 p,float scale,float layer){
 vec2 q=p*scale,cell=floor(q),f=fract(q)-.5;
 vec2 o=vec2(hash(cell+layer),hash(cell+layer+17.))*.7-.35;
 float h=hash(cell+layer+81.);float d=length(f-o);
 float blink=.78+.22*sin(uPhase*(1.+floor(h*3.))+h*31.);
 return exp(-d*d*16000.)*step(.96,h)*blink;
}
void main(){
 vec2 p=(vUv-.5)*vec2(uViewport.x/uViewport.y,1.);
 float wake=smoothstep(.2,1.4,uTime);
 vec3 c=vec3(.005,.012,.024);
 float depth=exp(-length((p-vec2(.38,.05))*vec2(.8,1.4))*2.);
 c+=vec3(.002,.009,.022)*depth*wake;
 float s=star(p,42.,3.)+star(p,76.,34.)*.4;
 c+=vec3(.17,.36,.56)*s*wake;
 gl_FragColor=vec4(c,1.);
}`;
const PORTRAIT=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage,uFields,uConstruction,uGrowth;
uniform vec2 uFit,uOffset;uniform float uTime,uPhase,uMobile,uGuide,uConstructionEnabled,uGrowthEnabled,uMaterialDebug;
void main(){
 vec2 p=(vUv*2.-1.-uOffset)/uFit;
 vec2 uv=vec2(p.x*.5+.5,.5-p.y*.5);
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
 vec2 imageUV=vec2(uv.x,1.-uv.y);
 vec4 field=texture2D(uFields,imageUV);
 if(field.a<.003)discard;
 // Per-texel birth is baked from the nearest authored structure curve sample.
 // Neither vertex motion, random masks, nor a whole-image opacity reveal exists.
 float born=(field.r*256.+field.g)/257.*5.5;
 vec4 build=texture2D(uConstruction,imageUV);
 float gridBorn=(build.r*256.+build.g)/257.*5.5;
 float start=max(2.8,born-.10);
 start=mix(start,max(start,gridBorn+.20),smoothstep(.05,.5,build.b)*uConstructionEnabled);
 float phase=clamp((uTime-start)/.92,0.,1.);
 float material=phase*phase*phase*(phase*(phase*6.-15.)+10.);
 // RGB is born on the SAME grid edges, then fills each small cell inward.
 // There is no character-wide material sweep in the normal render path.
 vec4 growth=texture2D(uGrowth,imageUV);
 float edgeClock=(growth.r*256.+growth.g)/257.*5.5;
 float inwardPhase=clamp((uTime-edgeClock-growth.b*.34)/.70,0.,1.);
 float woven=.5-.5*cos(3.14159265359*inwardPhase);
 material=mix(material,woven,uGrowthEnabled);
 if(uMaterialDebug>.5){gl_FragColor=vec4(vec3(material),1.);return;}
 // Every grid edge follows a drawn guide and grows across neighboring cells.
 float grid=smoothstep(gridBorn,gridBorn+.18,uTime)*build.b*pow(build.a,.78)*uConstructionEnabled;
 float head=smoothstep(gridBorn,gridBorn+.045,uTime)*(1.-smoothstep(gridBorn+.09,gridBorn+.23,uTime));
 float gridAlpha=grid*.64*(1.-smoothstep(.08,.78,material));
 vec3 gridColor=vec3(.16,.49,.66)+vec3(.12,.22,.23)*head;
 vec3 original=texture2D(uImage,imageUV).rgb;
 float composedAlpha=material+gridAlpha*(1.-material);
 vec3 color=mix(gridColor,original,material/max(composedAlpha,.0001));
 float idle=smoothstep(4.8,5.2,uTime);
 color+=vec3(.008,.027,.05)*field.b*idle*(.5+.5*sin(uPhase*2.+uv.y*7.));
 float alpha=field.a*max(composedAlpha,uGuide*.25);
 if(uGuide>0.&&composedAlpha<.25)color=original;
 alpha*=mix(1.,1.-smoothstep(.72,.995,uv.y),uMobile);
 gl_FragColor=vec4(color,alpha);
}`;

// Keep the approved intro shader byte-for-byte; edge extension belongs to idle only.
const FLOAT_PORTRAIT=PORTRAIT.replace('if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;',
  'if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))){if(uMobile>.5)discard;uv=clamp(uv,vec2(0.),vec2(1.));}');
const PHYSICAL_LIFE_GLSL=LIFE_GLSL.replace('vec2 localShift(vec2 p){',FLOW_GLSL+'\nvec2 localShift(vec2 p){').replace('return w.r*uHairMotion.xy','return strandShift(p)+w.r*uHairMotion.xy');
const LIFE_PORTRAIT=FLOAT_PORTRAIT.replace('void main(){',PHYSICAL_LIFE_GLSL+'\nvoid main(){').replace(' vec2 imageUV=vec2(uv.x,1.-uv.y);',`
 vec2 screen=uv*vec2(1672.,941.);
 vec2 source=screen-localShift(screen);
 source=screen-localShift(source);
 vec2 imageUV=vec2(source.x/1672.,1.-source.y/941.);`).replace(' vec3 original=texture2D(uImage,imageUV).rgb;',
 ' vec3 original=blinkColor(source,texture2D(uImage,imageUV).rgb);');
const IDLE_PATHS=new Set(['hair-rim-main','hair-left-lock-a','hair-face-left','hair-bang-c','hair-chin-curl','hair-chin-curl-inner','hair-neck-wisp','hair-right-crown']);
export class StarseaScene{
  constructor(canvas,lightCanvas){
    this.canvas=canvas;this.lightCanvas=lightCanvas;this.ctx=lightCanvas.getContext('2d');
    this.pointer=new THREE.Vector2();this.pointerActive=false;this.lastTime=0;
    this.interaction=new THREE.Vector2();this.baseOffset=new THREE.Vector2();
    this.motion={x:0,y:0,bob:0,hoverX:0,hoverY:0,proximity:0};
    this.motionEnabled=new URLSearchParams(location.search).get('motion')!=='0';
    this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lifeParams=new URLSearchParams(location.search);
    this.lifeEnabled=lifeParams.get('life')!=='0';this.blinkOverride=lifeParams.has('blink')?clamp(Number(lifeParams.get('blink'))):null;
    this.lifeState=lifeAt(0);this.lifeData=null;
    this.strandsEnabled=lifeParams.get('strands')!=='0';this.zeroG=null;
    this.guide=new URLSearchParams(location.search).get('guide')==='1';
    this.constructionEnabled=new URLSearchParams(location.search).get('construction')!=='0';
    this.growthEnabled=new URLSearchParams(location.search).get('growth')!=='0';
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x03070e);this.scene=new THREE.Scene();this.camera=new THREE.Camera();
    this.uniforms={uTime:{value:0},uPhase:{value:0},uGuide:{value:this.guide?1:0},uViewport:{value:new THREE.Vector2()},uFit:{value:new THREE.Vector2(1,1)},uOffset:{value:new THREE.Vector2()},uMobile:{value:0},uImage:{value:null},uFields:{value:null}};
    this.uniforms.uConstruction={value:null};this.uniforms.uConstructionEnabled={value:this.constructionEnabled?1:0};
    this.uniforms.uGrowth={value:null};this.uniforms.uGrowthEnabled={value:this.growthEnabled?1:0};this.uniforms.uMaterialDebug={value:new URLSearchParams(location.search).get('material-debug')==='1'?1:0};
    this.uniforms.uLifeField={value:null};this.uniforms.uHairMotion={value:new THREE.Vector4()};this.uniforms.uEarMotion={value:new THREE.Vector2()};this.uniforms.uBlink={value:0};
    this.uniforms.uClosedLid={value:null};
    this.uniforms.uStrandFlow={value:null};
    this.materials=[];this.geometries=[];this.textures=[];this.paths=SAMPLED;
    this.addScreen(BACKGROUND,false,0);this.ready=false;this.disposed=false;
  }
  addScreen(fragmentShader,transparent,order){
    const geometry=new THREE.PlaneGeometry(2,2);
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:SCREEN_VERTEX,fragmentShader,depthWrite:false,depthTest:false,transparent});
    this.materials.push(material);this.geometries.push(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=order;this.scene.add(mesh);return mesh;
  }
  async load(){
    const loader=new THREE.TextureLoader();
    const [image,fields,construction,growth,lifeField,closedLid,structure]=await Promise.all([
      loader.loadAsync(new URL('./assets/portrait.webp',import.meta.url).href),
      loader.loadAsync(new URL('./assets/fields.png',import.meta.url).href),
      loader.loadAsync(new URL('./assets/lattice.png',import.meta.url).href),
      loader.loadAsync(new URL('./assets/material-growth.png',import.meta.url).href),
      loader.loadAsync(new URL('./assets/life-field.png',import.meta.url).href),
      loader.loadAsync(new URL('./assets/eyelid-closed.png',import.meta.url).href),
      fetch(new URL('./assets/structure-data.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('结构曲线读取失败');return r.json();}),
    ]);
    if(this.disposed){image.dispose();fields.dispose();construction.dispose();growth.dispose();lifeField.dispose();closedLid.dispose();return;}
    image.colorSpace=THREE.NoColorSpace;fields.colorSpace=THREE.NoColorSpace;
    fields.minFilter=THREE.LinearFilter;fields.magFilter=THREE.LinearFilter;fields.generateMipmaps=false;
    construction.colorSpace=THREE.NoColorSpace;construction.minFilter=THREE.LinearFilter;construction.magFilter=THREE.LinearFilter;construction.generateMipmaps=false;
    growth.colorSpace=THREE.NoColorSpace;growth.minFilter=THREE.LinearFilter;growth.magFilter=THREE.LinearFilter;growth.generateMipmaps=false;
    lifeField.colorSpace=THREE.NoColorSpace;lifeField.minFilter=THREE.LinearFilter;lifeField.magFilter=THREE.LinearFilter;lifeField.generateMipmaps=false;
    const motionCanvas=document.createElement('canvas');motionCanvas.width=lifeField.image.width;motionCanvas.height=lifeField.image.height;
    const motionCtx=motionCanvas.getContext('2d',{willReadFrequently:true});motionCtx.drawImage(lifeField.image,0,0);
    this.lifeData=motionCtx.getImageData(0,0,motionCanvas.width,motionCanvas.height);
    this.uniforms.uLifeField.value=lifeField;this.textures.push(lifeField);
    closedLid.colorSpace=THREE.NoColorSpace;closedLid.minFilter=THREE.LinearFilter;closedLid.magFilter=THREE.LinearFilter;closedLid.generateMipmaps=false;this.uniforms.uClosedLid.value=closedLid;this.textures.push(closedLid);
    image.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    this.uniforms.uImage.value=image;this.uniforms.uFields.value=fields;this.uniforms.uConstruction.value=construction;this.textures.push(image,fields,construction);this.paths=structure.paths;
    const artCanvas=document.createElement('canvas');artCanvas.width=ART.width;artCanvas.height=ART.height;
    const artCtx=artCanvas.getContext('2d',{willReadFrequently:true});artCtx.drawImage(image.image,0,0);const rgb=artCtx.getImageData(0,0,ART.width,ART.height).data;
    this.zeroG=new ZeroGravityHair(this.paths,(x,y)=>this.lifeWeights(x,y),(x,y)=>{const i=(Math.round(clamp(y,0,ART.height-1))*ART.width+Math.round(clamp(x,0,ART.width-1)))*4;return[rgb[i],rgb[i+1],rgb[i+2]];});
    const flow=new THREE.DataTexture(this.zeroG.bytes,this.zeroG.width,this.zeroG.height,THREE.RGBAFormat,THREE.UnsignedByteType);
    flow.flipY=true;flow.minFilter=THREE.LinearFilter;flow.magFilter=THREE.LinearFilter;flow.generateMipmaps=false;flow.needsUpdate=true;
    this.uniforms.uStrandFlow.value=flow;this.textures.push(flow);
    this.uniforms.uGrowth.value=growth;this.textures.push(growth);
    this.portraitMesh=this.addScreen(PORTRAIT,true,1);this.portraitMaterial=this.portraitMesh.material;
    this.floatMaterial=this.portraitMaterial.clone();this.floatMaterial.uniforms=this.uniforms;this.floatMaterial.fragmentShader=FLOAT_PORTRAIT;this.materials.push(this.floatMaterial);
    this.lifeMaterial=this.portraitMaterial.clone();this.lifeMaterial.uniforms=this.uniforms;this.lifeMaterial.fragmentShader=LIFE_PORTRAIT;this.materials.push(this.lifeMaterial);
    this.portraitMesh.material=this.lifeMaterial;this.renderer.compile(this.scene,this.camera);
    this.portraitMesh.material=this.floatMaterial;this.renderer.compile(this.scene,this.camera);
    this.portraitMesh.material=this.portraitMaterial;this.ready=true;this.resize();this.renderer.compile(this.scene,this.camera);
  }
  resize(){
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,w<600?1.65:1.8);
    this.width=w;this.height=h;this.dpr=dpr;this.renderer.setPixelRatio(dpr);this.renderer.setSize(w,h,false);
    this.uniforms.uViewport.value.set(w,h);
    this.lightCanvas.width=Math.round(w*dpr);this.lightCanvas.height=Math.round(h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);
    const ratio=ART.width/ART.height,portrait=w/h<1&&w<1100;
    this.uniforms.uMobile.value=portrait?1:0;
    if(portrait){
      const iw=w*1.25,ih=iw/ratio;this.imageRect={x:w-iw,y:h*.055,w:iw,h:ih};
      this.uniforms.uFit.value.set(iw/w,ih/h);
      this.uniforms.uOffset.value.set((this.imageRect.x+iw/2)/w*2-1,1-(this.imageRect.y+ih/2)/h*2);
    }else{
      const iw=Math.max(w,h*ratio),ih=iw/ratio;this.imageRect={x:(w-iw)/2,y:(h-ih)/2,w:iw,h:ih};
      this.uniforms.uFit.value.set(iw/w,ih/h);this.uniforms.uOffset.value.set(0,0);
    }
    this.baseOffset.copy(this.uniforms.uOffset.value);this.clearPointer();this.render(this.lastTime);
  }
  basePoint(x,y){const r=this.imageRect;return{x:r.x+x/ART.width*r.w,y:r.y+y/ART.height*r.h};}
  lifeWeights(x,y){
    const d=this.lifeData;if(!d)return[0,0,0];const px=clamp(x/ART.width*d.width-.5,0,d.width-1),py=clamp(y/ART.height*d.height-.5,0,d.height-1),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
    const sample=(a,b,k)=>d.data[(Math.min(b,d.height-1)*d.width+Math.min(a,d.width-1))*4+k]/255;
    return[0,1,2].map(k=>(sample(ix,iy,k)*(1-fx)+sample(ix+1,iy,k)*fx)*(1-fy)+(sample(ix,iy+1,k)*(1-fx)+sample(ix+1,iy+1,k)*fx)*fy);
  }
  point(x,y){const delta=this.lifeState.wake>0?localDisplacement(x,y,this.lifeWeights(x,y),this.lifeState):{x:0,y:0},flow=this.zeroG?.wake>0?this.zeroG.sample(x,y):{x:0,y:0};const p=this.basePoint(x+delta.x+flow.x,y+delta.y+flow.y);return{x:p.x+this.motion.x,y:p.y+this.motion.y};}
  earPoint(x,y,rootX=x,rootY=y){const delta=localDisplacement(x,y,this.lifeWeights(rootX,rootY),this.lifeState),flow=this.zeroG?.sample(rootX,rootY)??{x:0,y:0},p=this.basePoint(x+delta.x+flow.x,y+delta.y+flow.y);return{x:p.x+this.motion.x,y:p.y+this.motion.y};}
  imagePoint(x,y){return this.point(x*ART.width,y*ART.height);}
  setPointer(x,y,active=true){this.pointer.set(x/this.width*2-1,1-y/this.height*2);this.pointerActive=active;}
  releasePointer(){this.pointerActive=false;}
  clearPointer(){this.pointer.set(0,0);this.pointerActive=false;this.interaction.set(0,0);this.zeroG?.resetMouse();}
  updateMotion(time,dt){
    const scale=this.imageRect.w/ART.width,wake=this.motionEnabled&&!this.reducedMotion?smooth(5,6,time):0;
    let influence=0,tx=0,ty=0;
    if(this.pointerActive&&wake>0){
      const r=this.imageRect,u=((this.pointer.x+1)*this.width/2-r.x)/r.w,v=((1-this.pointer.y)*this.height/2-r.y)/r.h;
      // Ellipses follow the head/hair, reaching hand, and torso, not the whole viewport.
      const distance=Math.min(Math.hypot((u-.77)/.35,(v-.39)/.60),Math.hypot((u-.29)/.25,(v-.78)/.27),Math.hypot((u-.72)/.40,(v-.88)/.36));
      influence=1-smooth(.78,1.22,distance);
      tx=clamp((u-.60)/.40,-1,1)*influence;ty=clamp((v-.48)/.45,-1,1)*influence;
    }
    if(wake===0)this.interaction.set(0,0);
    else if(dt>0){
      const damping=1-Math.exp(-Math.min(dt,.1)/.32);
      this.interaction.x+=(tx-this.interaction.x)*damping;this.interaction.y+=(ty-this.interaction.y)*damping;
      if(Math.abs(this.interaction.x)<.00001&&tx===0)this.interaction.x=0;
      if(Math.abs(this.interaction.y)<.00001&&ty===0)this.interaction.y=0;
    }
    const bob=Number((-6*scale*Math.sin(((time-5)%12)/12*Math.PI*2)*wake).toFixed(6));
    const hoverX=this.interaction.x*6*scale*wake,hoverY=this.interaction.y*3*scale*wake;
    this.motion={x:hoverX,y:bob+hoverY,bob,hoverX,hoverY,proximity:influence};
    this.uniforms.uOffset.value.set(this.baseOffset.x+hoverX/this.width*2,this.baseOffset.y-(bob+hoverY)/this.height*2);
  }
  render(time,dt=0){
    if(!this.width||this.disposed)return;
    this.updateMotion(time,dt);
    const lifeActive=this.lifeEnabled&&!this.reducedMotion;
    this.lifeState=lifeAt(time,{enabled:lifeActive,blinkOverride:this.blinkOverride});
    if(this.zeroG){
      const scale=this.imageRect.w/ART.width;
      this.zeroG.update(time,dt,this.motion.hoverX/scale,this.motion.hoverY/scale,lifeActive&&this.strandsEnabled);
      if(lifeActive&&this.strandsEnabled){this.lifeState.hair=[0,0,0,0];this.lifeState.ear=[this.zeroG.ear,.45*this.lifeState.wake*Math.sin(time%24*Math.PI/4)];}
      this.uniforms.uStrandFlow.value.needsUpdate=true;
    }
    this.uniforms.uHairMotion.value.fromArray(this.lifeState.hair);this.uniforms.uEarMotion.value.fromArray(this.lifeState.ear);this.uniforms.uBlink.value=this.lifeState.blink;
    if(this.portraitMesh)this.portraitMesh.material=time>5?(lifeActive?this.lifeMaterial:this.floatMaterial):this.portraitMaterial;
    this.lastTime=time;this.uniforms.uTime.value=time;this.uniforms.uPhase.value=time%24*Math.PI/12;
    this.renderer.render(this.scene,this.camera);this.drawStructure(time);
  }
  stroke(path,from,to){
    const c=this.ctx,points=path.samples,max=points.length-1;
    const a=clamp(from)*max,b=clamp(to)*max,first=Math.floor(a),last=Math.floor(b);
    const at=v=>{const i=Math.min(Math.floor(v),max-1),f=v-i,p=points[i],q=points[i+1];return{...this.point(p.x+(q.x-p.x)*f,p.y+(q.y-p.y)*f),visible:p.visible!==false&&q.visible!==false};};
    const start=at(a);c.beginPath();c.moveTo(start.x,start.y);
    for(let i=first+1;i<=last;i++){const p=this.point(points[i].x,points[i].y);if(points[i].visible!==false&&points[i-1]?.visible!==false)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}
    const end=at(b);if(end.visible)c.lineTo(end.x,end.y);else c.moveTo(end.x,end.y);return end;
  }
  drawStructure(t){
    const c=this.ctx,w=this.width,h=this.height,scale=this.imageRect.w/ART.width,phase=t%24*Math.PI/12;
    c.clearRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='lighter';
    const idle=smooth(4.8,5.3,t);
    for(const path of this.paths){
      const growth=this.guide?1:growthAt(path,t);if(growth<=.0001)continue;
      const fade=path.group==='face'||path.group==='hand'?1-smooth(3.25,4.24,t):1-smooth(3.5,4.65,t);
      const emphasis=path.emphasis??1,life=this.guide?.75:fade*(.63+.22*growth)*emphasis;
      const color=GROUPS[path.group].color;
      if(life>.001){
        c.globalAlpha=life*.5;c.strokeStyle=color;c.lineWidth=Math.max(.55,path.width*scale*1.8);c.shadowBlur=5.5*scale;c.shadowColor=color;
        this.stroke(path,0,growth);c.stroke();
        c.shadowBlur=0;c.globalAlpha=life*.88;c.lineWidth=Math.max(.42,path.width*scale*.65);c.strokeStyle=path.group==='ornament'?'#ffdab6':'#b9edff';
        this.stroke(path,0,growth);c.stroke();
        if(growth<.998&&!this.guide){
          c.globalAlpha=life*.85;c.strokeStyle=color;c.lineWidth=Math.max(.65,path.width*scale);
          const tip=this.stroke(path,Math.max(0,growth-.065),growth);c.stroke();
          if(tip.visible){this.glow(tip.x,tip.y,2.4*scale,color,.38*life);
          c.globalAlpha=life*.9;c.fillStyle='#e5faff';c.beginPath();c.arc(tip.x,tip.y,Math.max(.7,scale*.85),0,Math.PI*2);c.fill();}
        }
      }
      if(IDLE_PATHS.has(path.id)&&idle>0){
        const index=this.paths.indexOf(path),u=fract(t/12+index*.137);
        c.shadowBlur=3*scale;c.shadowColor='#49baff';c.strokeStyle='#7bdbff';c.globalAlpha=idle*.36*(1-smooth(5,6,t));c.lineWidth=Math.max(.45,.65*scale);
        this.stroke(path,Math.max(0,u-.045),u);c.stroke();c.shadowBlur=0;
      }
    }
    c.globalAlpha=1;c.shadowBlur=0;
    const tip=this.point(330,529),seed=smooth(.12,.54,t)*(1-smooth(.8,1.6,t));
    this.glow(tip.x,tip.y,4*scale,'#78dfff',seed*.42);
    // Eye activation is a separate event, after the eyelids and iris have been drawn.
    const iris=this.point(1236,403),activate=smooth(3.54,3.70,t)*(1-smooth(3.9,4.23,t));
    if(activate>0||idle>0){
      c.save();c.translate(iris.x,iris.y);c.scale(1,1.03);
      this.glow(0,0,36*scale,'#59baff',activate*.16);
      for(let j=0;j<2;j++){
        const r=(32+j*15)*scale,a=(t-3.54)*(j?-.8:1.3)+j*1.4;
        c.globalAlpha=activate*.38;c.strokeStyle='#b3eeff';c.lineWidth=.65*scale;
        c.beginPath();c.arc(0,0,r,a,a+Math.PI*1.35);c.stroke();
      }
      for(let j=0;j<12;j++){
        const a=j/12*Math.PI*2,r=55*scale;c.globalAlpha=activate*.35;c.lineWidth=.5*scale;c.strokeStyle='#adf1ff';
        c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a)*(r+2*scale),Math.sin(a)*(r+2*scale));c.stroke();
      }
      c.restore();c.globalAlpha=1;
      const glint=this.point(1213+Math.sin(phase)*1.7,367+Math.cos(phase)*1.3);
      this.glow(glint.x,glint.y,3*scale,'#cbefff',activate*.7+idle*.13*Math.pow(1-this.lifeState.blink,3));
    }
    // A small amount of independently drifting dust only belongs to the environment.
    const dust=smooth(4.2,5,t);
    if(dust>0){
      for(let i=0;i<15;i++){
        const x=(.035+fract(i*.618)*.52)*w+Math.sin(phase*(1+i%2)+i)*8;
        const y=(.13+fract(i*.387)*.55)*h+Math.cos(phase+i)*6;
        c.globalAlpha=dust*(.16+(i%3)*.08);c.fillStyle=i%7===0?'#edbc8d':'#7fc3e8';
        c.beginPath();c.arc(x,y,i%4===0?1:.55,0,Math.PI*2);c.fill();
      }
      const orbit=[this.basePoint(32,418),this.basePoint(202,319),this.basePoint(434,269),this.basePoint(587,274)];
      c.globalAlpha=dust*.2;c.strokeStyle='#7aafca';c.lineWidth=.55;c.beginPath();c.moveTo(orbit[0].x,orbit[0].y);c.bezierCurveTo(orbit[1].x,orbit[1].y,orbit[2].x,orbit[2].y,orbit[3].x,orbit[3].y);c.stroke();
    }
    if(t>5)this.drawIdle(t);
    if(this.pointerActive&&idle>0){
      const px=(this.pointer.x+1)*w/2,py=(1-this.pointer.y)*h/2;
      this.glow(px,py,14,'#53baff',.025);
    }
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }
  drawIdle(t){
    // Character lights share the portrait's offset; environment orbits stay fixed.
    const c=this.ctx,scale=this.imageRect.w/ART.width,birth=smooth(5,6,t),phase=t%24*Math.PI/12;
    this.zeroG?.draw(c,(x,y)=>this.point(x,y),(x,y,rx,ry)=>this.earPoint(x,y,rx,ry),scale,t);
    c.save();c.globalCompositeOperation='lighter';
    let index=0;
    for(const path of this.paths){
      if(!IDLE_PATHS.has(path.id))continue;
      const n=index++,u=fract((t%24)/24*(1+n%3)+n*.137),tail=.09+(n%3)*.025;
      const envelope=birth*smooth(0,.1,u)*(1-smooth(.90,1,u));
      c.shadowColor='#369cff';c.shadowBlur=5*scale;
      // A graded tail rather than a uniformly lit moving stroke.
      for(let j=0;j<6;j++){
        c.globalAlpha=envelope*(.06+j*.045);c.strokeStyle=j===5?'#c9f0ff':'#64c9ff';c.lineWidth=(j===5?.8:1.15)*scale;
        const end=u-tail*(5-j)/6;
        this.stroke(path,Math.max(0,end-tail/6),Math.max(0,end));c.stroke();
      }
      c.shadowBlur=0;
      const tip=this.stroke(path,u,u);
      if(tip.visible){this.glow(tip.x,tip.y,3*scale,'#68cfff',envelope*.18);c.globalAlpha=envelope*.62;c.fillStyle='#c5efff';c.beginPath();c.arc(tip.x,tip.y,.8*scale,0,Math.PI*2);c.fill();}
    }
    // A small iris caustic and two glints, kept within the existing painted eye.
    const iris=this.point(1236,403),a=phase*2,eyeOpen=Math.pow(1-this.lifeState.blink,3);
    c.globalAlpha=birth*(.10+.045*Math.sin(phase*2))*eyeOpen;c.strokeStyle='#9ce4ff';c.lineWidth=.65*scale;
    c.beginPath();c.arc(iris.x,iris.y,34*scale,a+.6,a+1.22);c.stroke();
    const glint=this.point(1213+Math.sin(phase)*1.7,367+Math.cos(phase)*1.3);
    this.twinkle(glint.x,glint.y,3.2*scale,'#ccefff',birth*(.30+.12*Math.sin(phase*2))*eyeOpen);
    const echo=this.point(1255+Math.cos(phase)*1.3,425+Math.sin(phase)*1.3);
    this.glow(echo.x,echo.y,2.8*scale,'#77d8ff',birth*(.14+.08*Math.cos(phase*2))*eyeOpen);
    const flower=this.point(931,151),warmPulse=Math.pow(.5+.5*Math.sin(phase*2-1.1),10);
    this.twinkle(flower.x,flower.y,5*scale,'#ffe0ad',birth*(.12+warmPulse*.30));
    // Two designed orbits link the title space with the character's light rim.
    const orbits=[[[20,420],[185,327],[406,246],[590,274]],[[64,449],[5,487],[204,342],[434,270]]];
    for(let k=0;k<orbits.length;k++){
      const curve=orbits[k];c.globalAlpha=birth*(k?.12:.24);c.strokeStyle='#88c7ed';c.lineWidth=.6*scale;
      const p=curve.map(v=>this.basePoint(...v));c.beginPath();c.moveTo(p[0].x,p[0].y);c.bezierCurveTo(p[1].x,p[1].y,p[2].x,p[2].y,p[3].x,p[3].y);c.stroke();
      for(let j=0;j<(k?2:4);j++){
        const u=fract((t%24)/24*(k?1:2)+j/(k?2:4)+k*.19),fade=birth*smooth(0,.045,u)*(1-smooth(.94,1,u));
        const color=(j+k)%3===1?'#ffb468':'#68d7ff';
        c.strokeStyle=color;c.lineWidth=.9*scale;c.shadowBlur=0;
        for(let q=0;q<5;q++){
          const v=Math.max(0,u-.04*(5-q)/5),v2=Math.max(0,v+.04/5),p0=this.orbitPoint(curve,v),p1=this.orbitPoint(curve,Math.min(u,v2));
          c.globalAlpha=fade*(q+1)*.045;c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();
        }
        const dot=this.orbitPoint(curve,u);this.twinkle(dot.x,dot.y,(k?2.1:2.8)*scale,color,fade*.8);
      }
    }
    c.restore();
  }
  orbitPoint(curve,u){const v=1-u;return this.basePoint(v*v*v*curve[0][0]+3*v*v*u*curve[1][0]+3*v*u*u*curve[2][0]+u*u*u*curve[3][0],v*v*v*curve[0][1]+3*v*v*u*curve[1][1]+3*v*u*u*curve[2][1]+u*u*u*curve[3][1]);}
  twinkle(x,y,r,color,alpha){
    if(alpha<=0)return;const c=this.ctx;this.glow(x,y,r*2,color,alpha*.43);c.save();c.globalAlpha=alpha;c.fillStyle=color;
    c.beginPath();c.moveTo(x-r*2,y);c.quadraticCurveTo(x-.4*r,y-.4*r,x,y-r*2);c.quadraticCurveTo(x+.4*r,y-.4*r,x+r*2,y);c.quadraticCurveTo(x+.4*r,y+.4*r,x,y+r*2);c.quadraticCurveTo(x-.4*r,y+.4*r,x-r*2,y);c.fill();
    c.globalAlpha=alpha*.9;c.fillStyle='#f5fcff';c.beginPath();c.arc(x,y,Math.max(.6,r*.28),0,Math.PI*2);c.fill();c.restore();
  }
  glow(x,y,r,color,alpha){
    if(alpha<=0||r<=0)return;
    const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r*3);
    g.addColorStop(0,color);g.addColorStop(1,'#00000000');c.save();c.globalAlpha=alpha;c.fillStyle=g;c.fillRect(x-r*3,y-r*3,r*6,r*6);c.restore();
  }
  diagnostics(){
    return{version:10,zeroGravity:this.zeroG?.diagnostics(),lifeEnabled:this.lifeEnabled&&!this.reducedMotion,life:this.lifeState,idlePeriod:24,floatPeriod:12,motionEnabled:this.motionEnabled&&!this.reducedMotion,motion:{...this.motion},idleHairPaths:IDLE_PATHS.size,idleOrbits:2,technique:'material-from-grid-edges',materialGrowth:this.growthEnabled,constructionLayer:this.constructionEnabled,solidSurfaceFill:false,localGridPatches:15,ready:this.ready,webgl:'WebGL2',curveCount:SAMPLED.length,
      groups:Object.fromEntries(Object.keys(GROUPS).map(group=>[group,SAMPLED.filter(p=>p.group===group).length])),
      characterFragments:0,returningParticles:0,edgeDetector:false,drawCalls:this.renderer.info.render.calls,width:this.width,height:this.height,dpr:this.dpr};
  }
  dispose(){if(this.disposed)return;this.disposed=true;for(const m of this.materials)m.dispose();for(const g of this.geometries)g.dispose();for(const t of this.textures)t.dispose();this.renderer.dispose();}
}
function fract(v){return v-Math.floor(v);}
