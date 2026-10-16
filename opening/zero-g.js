import {clamp,smooth} from './timeline.js';

// Fixed-root, rest-curved point-mass chains. No downward acceleration: only
// very weak periodic airflow, elastic shape memory, drag and length constraints.
const PERIOD=24,FPS=60,STEPS=2,N=15,DT=1/(FPS*STEPS),FRAMES=PERIOD*FPS;
const REVERSED=new Set(['hair-left-wisp','hair-rim-main','hair-rim-inner','hair-floating-top','hair-top-loop','hair-left-lock-a','hair-left-lock-b','hair-left-lock-c','hair-left-arc','hair-loop-return','hair-low-silhouette','hair-low-ribbon','hair-low-back-a','hair-low-back-b','hair-bottom-stream']);
const rnd=n=>{const v=Math.sin(n*127.13+17.7)*43758.5453;return v-Math.floor(v);};
const fixed=n=>Number(n.toFixed(6));
function curveSample(samples,u){
  const v=clamp(u)*(samples.length-1),i=Math.min(samples.length-2,Math.floor(v)),f=v-i,a=samples[i],b=samples[i+1];
  return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,visible:a.visible!==false&&b.visible!==false};
}
export function createGuides(paths){
  return paths.filter(p=>p.group==='hair'&&p.id!=='hair-ear-border').map((p,index)=>{
    const source=REVERSED.has(p.id)?[...p.samples].reverse():p.samples;
    const rest=Array.from({length:N},(_,i)=>curveSample(source,i/(N-1)));
    return{id:p.id,index,rest,source,length:p.length??rest.reduce((s,p,i)=>s+(i?Math.hypot(p.x-rest[i-1].x,p.y-rest[i-1].y):0),0)};
  });
}
export function bakeChains(guides){
  const count=guides.length*N*2,stride=count+2,table=new Float32Array((FRAMES+1)*stride);
  const chains=guides.map(g=>({g,pos:g.rest.flatMap(p=>[p.x,p.y]),old:g.rest.flatMap(p=>[p.x,p.y]),length:g.rest.slice(1).map((p,i)=>Math.hypot(p.x-g.rest[i].x,p.y-g.rest[i].y))}));
  let ear=0,earV=0,maxStretch=0;
  for(let frame=0;frame<FRAMES*5;frame++){
    for(let sub=0;sub<STEPS;sub++){
      const time=(frame+sub/STEPS)/FPS,phase=time/PERIOD*Math.PI*2;
      const local=time%PERIOD,flick=Math.exp(-(((local-10.63)/.14)**2))-.65*Math.exp(-(((local-17.3)/.22)**2));
      const target=.035*Math.sin(phase*2-.8)+.021*Math.sin(phase*3+.7)+.060*flick;
      earV+=((target-ear)*115-earV*12)*DT;ear+=earV*DT;
      for(const c of chains){
        const {g,pos,old}=c,seed=g.index*.73;
        for(let i=2;i<N;i++){
          const j=i*2,p=g.rest[i],u=i/(N-1),vx=(pos[j]-old[j])*Math.exp(-1.45*DT),vy=(pos[j+1]-old[j+1])*Math.exp(-1.45*DT);
          old[j]=pos[j];old[j+1]=pos[j+1];
          const windX=48*Math.sin(phase*2+seed*.21)+17*Math.sin(phase*3+seed+u*1.5);
          const windY=29*Math.sin(phase+seed*.38)+11*Math.sin(phase*4+u*2-seed);
          const stiffness=2.6+2*rnd(g.index+7);
          pos[j]+=vx+(windX*u-stiffness*(pos[j]-p.x))*DT*DT;
          pos[j+1]+=vy+(windY*u-stiffness*(pos[j+1]-p.y))*DT*DT;
        }
        // Both the root and its tangent are pinned. Alternate projection order
        // to avoid the one-sided solver's accumulation of stretch at the tip.
        for(let pass=0;pass<5;pass++){
          pos[0]=g.rest[0].x;pos[1]=g.rest[0].y;pos[2]=g.rest[1].x;pos[3]=g.rest[1].y;
          for(let k=2;k<N;k++){
            const i=pass%2?N+1-k:k,j=i*2,dx=pos[j]-pos[j-2],dy=pos[j+1]-pos[j-1],len=Math.hypot(dx,dy),error=(len-c.length[i-1])/Math.max(.001,len),share=i===2?1:.5;
            pos[j]-=dx*error*share;pos[j+1]-=dy*error*share;
            if(i>2){pos[j-2]+=dx*error*.5;pos[j-1]+=dy*error*.5;}
          }
        }
      }
    }
    if(frame>=FRAMES*4){
      const f=frame-FRAMES*4,offset=f*stride;
      for(const c of chains)for(let i=0;i<N;i++){
        const j=c.g.index*N*2+i*2;table[offset+j]=c.pos[i*2]-c.g.rest[i].x;table[offset+j+1]=c.pos[i*2+1]-c.g.rest[i].y;
        if(i>1)maxStretch=Math.max(maxStretch,Math.abs(Math.hypot(c.pos[i*2]-c.pos[i*2-2],c.pos[i*2+1]-c.pos[i*2-1])/c.length[i-1]-1));
      }
      table[offset+count]=ear;table[offset+count+1]=earV;
    }
  }
  // Warm-up eliminates transients; blend the residual subpixel seam over the
  // last second, keeping exact seek/reverse and a genuinely continuous loop.
  const end=(FRAMES-1)*stride,begin=0;let seam=0;
  for(let j=0;j<stride;j++)seam=Math.max(seam,Math.abs(table[end+j]-table[begin+j]));
  for(let f=FRAMES-FPS;f<FRAMES;f++){
    const u=smooth(FRAMES-FPS,FRAMES,f);
    for(let j=0;j<stride;j++)table[f*stride+j]-=(table[end+j]-table[j])*u;
  }
  table.set(table.subarray(0,stride),FRAMES*stride);
  return{table,stride,count,frames:FRAMES,maxStretch,seam};
}

export class ZeroGravityHair{
  constructor(paths,weights,colorAt){
    this.guides=createGuides(paths);this.baked=bakeChains(this.guides);
    this.displacement=new Float32Array(this.baked.count);this.mouse=new Float32Array(12);this.lastTime=0;this.wake=0;this.ear=0;this.earVelocity=0;
    this.width=209;this.height=118;this.field=new Float32Array(this.width*this.height*2);this.bytes=new Uint8Array(this.width*this.height*4);
    this.links=new Int16Array(this.width*this.height*3);this.weights=new Float32Array(this.links.length);
    const nodes=this.guides.flatMap(g=>g.rest.map((p,i)=>({...p,index:g.index*N+i})));
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
      const px=(x+.5)/this.width*1672,py=(y+.5)/this.height*941,w=weights(px,py),mask=clamp(w[0]+w[1]);
      if(mask<.001)continue;
      const nearest=[{index:0,d:Infinity},{index:0,d:Infinity},{index:0,d:Infinity}];
      for(const p of nodes){const d=(p.x-px)**2+(p.y-py)**2;if(d>=nearest[2].d)continue;const entry={index:p.index,d};if(d<nearest[0].d){nearest[2]=nearest[1];nearest[1]=nearest[0];nearest[0]=entry;}else if(d<nearest[1].d){nearest[2]=nearest[1];nearest[1]=entry;}else nearest[2]=entry;}
      const sum=nearest.reduce((s,p)=>s+Math.exp(-p.d/(2*68**2)),0),k=(y*this.width+x)*3;
      nearest.forEach((p,i)=>{this.links[k+i]=p.index;this.weights[k+i]=Math.exp(-p.d/(2*68**2))/Math.max(.00001,sum)*mask*Math.exp(-nearest[0].d/(2*100**2));});
    }
    this.strands=[];
    for(const g of this.guides){
      const count=g.id.includes('fine')?9:16;
      for(let s=0;s<count;s++){
        const seed=g.index*101+s,spread=(rnd(seed)-.5)*(g.id.includes('bang')?16:22),end=.78+rnd(seed+2)*.22;
        const points=Array.from({length:22},(_,i)=>{
          const u=i/21*end,p=curveSample(g.source,u),a=curveSample(g.source,Math.max(0,u-.005)),b=curveSample(g.source,Math.min(1,u+.005)),len=Math.max(.01,Math.hypot(b.x-a.x,b.y-a.y));
          const offset=spread*Math.sin(Math.PI*u*.78)+Math.sin(u*7+seed)*1.5*u;
          const x=p.x-(b.y-a.y)/len*offset,y=p.y+(b.x-a.x)/len*offset;
          const color=colorAt(x,y),blue=color[2]>color[0]*1.25&&color[2]>color[1]*1.08;
          return{x,y,u,visible:p.visible&&blue};
        });
        const p=points[12],color=colorAt(p.x,p.y);
        this.strands.push({g:g.index,points,width:.35+rnd(seed+11)*.65,alpha:.16+rnd(seed+12)*.30,color:`rgb(${Math.min(160,color[0]+20)},${Math.min(210,color[1]+30)},${Math.min(255,color[2]+38)})`,phase:rnd(seed+3)*Math.PI*2});
      }
    }
    // The short, tapered undercoat follows the painted white ear scallops.
    const rim=[[692,307],[700,323],[727,334],[741,334],[738,345],[758,355],[767,365],[787,364],[807,378],[822,365],[840,364],[851,344]];
    this.fur=Array.from({length:190},(_,i)=>{
      const u=i/189*(rim.length-1),k=Math.min(rim.length-2,Math.floor(u)),f=u-k,seed=i+1700;
      const x=rim[k][0]*(1-f)+rim[k+1][0]*f+(rnd(seed)-.5)*3,y=rim[k][1]*(1-f)+rim[k+1][1]*f+(rnd(seed+1)-.5)*4;
      return{x,y,length:4+rnd(seed+2)*12,dx:-.35+rnd(seed+3)*.55,dy:.6+rnd(seed+4)*.35,phase:rnd(seed+5)*Math.PI*2,width:.30+rnd(seed+6)*.5,alpha:.2+rnd(seed+7)*.4};
    });
    this.update(0,0,0,0,false);
  }
  resetMouse(){this.mouse.fill(0);}
  update(time,dt,bodyX=0,bodyY=0,enabled=true){
    this.wake=enabled?smooth(5,6,time):0;
    const phase=Number((((time%PERIOD)+PERIOD)%PERIOD).toFixed(6))*FPS,f=Math.floor(phase),blend=phase-f,{table,stride,count}=this.baked;
    if(Math.abs(time-this.lastTime)>.15||!this.wake)this.resetMouse();
    if(dt>0&&this.wake){
      const steps=Math.ceil(Math.min(dt,.1)/DT),h=Math.min(dt,.1)/steps;
      for(let j=0;j<steps;j++)for(let k=0;k<3;k++)for(let axis=0;axis<2;axis++){
        const p=k*4+axis,v=p+2,target=k?this.mouse[(k-1)*4+axis]:(axis?bodyY:bodyX),spring=26-k*5,drag=5-k*.5;
        this.mouse[v]+=((target-this.mouse[p])*spring-this.mouse[v]*drag)*h;this.mouse[p]+=this.mouse[v]*h;
      }
    }
    for(let j=0;j<count;j++){
      const u=(Math.floor(j/2)%N)/(N-1),axis=j%2,lag=this.mouse[(Math.min(2,Math.floor(u*3)))*4+axis]-(axis?bodyY:bodyX);
      this.displacement[j]=fixed((table[f*stride+j]*(1-blend)+table[(f+1)*stride+j]*blend+lag*u*.85)*this.wake);
    }
    this.ear=fixed((table[f*stride+count]*(1-blend)+table[(f+1)*stride+count]*blend+(this.mouse[0]-bodyX)*.002)*this.wake);
    this.earVelocity=fixed((table[f*stride+count+1]*(1-blend)+table[(f+1)*stride+count+1]*blend)*this.wake);
    for(let i=0;i<this.field.length/2;i++){
      let x=0,y=0;for(let k=0;k<3;k++){const j=i*3+k,node=this.links[j]*2,w=this.weights[j];x+=this.displacement[node]*w;y+=this.displacement[node+1]*w;}
      this.field[i*2]=x;this.field[i*2+1]=y;
      const a=Math.round(clamp((x+32)/64)*65535),b=Math.round(clamp((y+32)/64)*65535),p=i*4;
      this.bytes[p]=a>>8;this.bytes[p+1]=a&255;this.bytes[p+2]=b>>8;this.bytes[p+3]=b&255;
    }
    this.lastTime=time;
  }
  sample(x,y){
    const px=clamp(x/1672*this.width-.5,0,this.width-1),py=clamp(y/941*this.height-.5,0,this.height-1),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
    const at=(a,b,k)=>this.field[(Math.min(b,this.height-1)*this.width+Math.min(a,this.width-1))*2+k];
    return{x:(at(ix,iy,0)*(1-fx)+at(ix+1,iy,0)*fx)*(1-fy)+(at(ix,iy+1,0)*(1-fx)+at(ix+1,iy+1,0)*fx)*fy,y:(at(ix,iy,1)*(1-fx)+at(ix+1,iy,1)*fx)*(1-fy)+(at(ix,iy+1,1)*(1-fx)+at(ix+1,iy+1,1)*fx)*fy};
  }
  draw(ctx,point,earPoint,scale,time){
    if(this.wake<.001)return;
    time=Number((time%PERIOD).toFixed(6));
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
    for(const s of this.strands){
      ctx.strokeStyle=s.color;ctx.lineCap='round';
      for(let section=0;section<3;section++){
        ctx.lineWidth=Math.max(.18,s.width*scale*(1-section*.26));ctx.globalAlpha=this.wake*s.alpha*(section===0?.45:section===1?1:.55);ctx.beginPath();let active=false;
        const start=section*7,end=Math.min(21,(section+1)*7);
        for(let i=start;i<=end;i++){
          const p=s.points[i];if(!p.visible){active=false;continue;}
          const flutter=Math.sin(time/PERIOD*Math.PI*6+s.phase+p.u*3)*p.u*p.u*1.2;
          const q=point(p.x+flutter,p.y+flutter*.5);if(active)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);active=true;
        }ctx.stroke();
      }
    }
    for(const f of this.fur){
      const a=earPoint(f.x,f.y),bend=Math.sin(time/PERIOD*Math.PI*6+f.phase)*1.6-this.earVelocity*18;
      const mid=earPoint(f.x+f.dx*f.length*.45-bend*.25,f.y+f.dy*f.length*.5,f.x,f.y),end=earPoint(f.x+f.dx*f.length+bend,f.y+f.dy*f.length,f.x,f.y);
      ctx.strokeStyle='#b4cbed';ctx.globalAlpha=f.alpha*this.wake;ctx.lineWidth=f.width*scale;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mid.x,mid.y,end.x,end.y);ctx.stroke();
      ctx.strokeStyle='#e1edff';ctx.globalAlpha=f.alpha*this.wake*.45;ctx.lineWidth=Math.max(.17,f.width*scale*.4);ctx.beginPath();ctx.moveTo(mid.x,mid.y);ctx.lineTo(end.x,end.y);ctx.stroke();
    }
    ctx.restore();
  }
  diagnostics(){return{guideChains:this.guides.length,particles:this.guides.length*N,hairStrands:this.strands.length,earFur:this.fur.length,gravity:0,fixedStep:DT,drag:1.45,period:PERIOD,maxStretch:this.baked.maxStretch,earAngle:this.ear,mouseLag:Array.from(this.mouse),maxDisplacement:Math.max(...this.displacement.map(Math.abs)),wake:this.wake};}
}

export const FLOW_GLSL=`
uniform sampler2D uStrandFlow;
vec2 strandShift(vec2 p){
 vec4 t=texture2D(uStrandFlow,vec2(p.x/1672.,1.-p.y/941.));
 return vec2((t.r*256.+t.g)/257.,(t.b*256.+t.a)/257.)*64.-32.;
}
`;
