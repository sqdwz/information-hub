import {smooth,clamp} from './timeline.js';

export const BLINK_STARTS=[7.9,12.7,17.9,18.25,22.6];
export function lifeAt(time,{enabled=true,blinkOverride=null}={}){
  const wake=enabled?smooth(5,6,time):0,p=(time%24)*Math.PI/12;
  let blink=0;
  for(const start of BLINK_STARTS){const d=time%24-start;blink=Math.max(blink,smooth(0,.085,d)*(1-smooth(.115,.295,d)));}
  if(blinkOverride!==null)blink=clamp(blinkOverride);
  const twitch=smooth(10.5,10.62,time%24)*(1-smooth(10.68,11.15,time%24));
  const fixed=v=>Number((v*wake).toFixed(6));
  return{blink:fixed(blink),hair:[fixed(3.8*Math.sin(p*3+.4)),fixed(1.3*Math.sin(p*2+1.2)),fixed(2.6*Math.sin(p*2-.6)),fixed(1.1*Math.sin(p*3+.6))],ear:[fixed(.018*Math.sin(p*2-.8)+.012*twitch),fixed(.65*Math.sin(p*6+.3))],wake};
}
export function localDisplacement(x,y,weights,state){
  const [r,g,b]=weights,[rx,ry,fx,fy]=state.hair,[angle,ruffle]=state.ear;
  return{x:r*rx+g*fx+b*(-(y-276)*angle+ruffle*Math.sin(y*.08)),y:r*ry+g*fy+b*((x-844)*angle+ruffle*Math.cos(x*.07))};
}

export const LIFE_GLSL=`
uniform sampler2D uLifeField,uClosedLid;
uniform vec4 uHairMotion;
uniform vec2 uEarMotion;
uniform float uBlink;
vec2 localShift(vec2 p){
 vec3 w=texture2D(uLifeField,vec2(p.x/1672.,1.-p.y/941.)).rgb;
 return w.r*uHairMotion.xy+w.g*uHairMotion.zw+w.b*(vec2(-(p.y-276.),p.x-844.)*uEarMotion.x+uEarMotion.y*vec2(sin(p.y*.08),cos(p.x*.07)));
}
float upperLid(float x){
 if(x<1128.)return mix(411.,383.,clamp((x-1106.)/22.,0.,1.));
 if(x<1164.)return mix(383.,357.,(x-1128.)/36.);
 if(x<1202.)return mix(357.,342.,(x-1164.)/38.);
 if(x<1241.)return mix(342.,341.,(x-1202.)/39.);
 if(x<1282.)return mix(341.,353.,(x-1241.)/41.);
 if(x<1313.)return mix(353.,377.,(x-1282.)/31.);
 return mix(377.,398.,clamp((x-1313.)/16.,0.,1.));
}
float lowerLid(float x){
 if(x<1137.)return mix(416.,441.,clamp((x-1112.)/25.,0.,1.));
 if(x<1177.)return mix(441.,458.,(x-1137.)/40.);
 if(x<1217.)return mix(458.,464.,(x-1177.)/40.);
 if(x<1258.)return mix(464.,452.,(x-1217.)/41.);
 if(x<1297.)return mix(452.,433.,(x-1258.)/39.);
 return mix(433.,412.,clamp((x-1297.)/23.,0.,1.));
}
vec3 blinkColor(vec2 p,vec3 color){
 if(uBlink<.0001||p.x<1050.||p.x>1410.||p.y<250.||p.y>610.)return color;
 vec4 lidTex=texture2D(uClosedLid,vec2((p.x-1050.)/360.,1.-(p.y-250.)/360.));
 if(lidTex.a<.001)return color;
 float top=upperLid(p.x),bottom=lowerLid(p.x),u=clamp((p.x-1106.)/223.,0.,1.);
 float closed=mix(411.,402.,u)+11.*sin(u*3.14159265);
 float up=mix(top,closed,uBlink),down=mix(bottom,closed,uBlink);
 float cover=max(1.-smoothstep(up-1.,up+1.,p.y),smoothstep(down-1.,down+1.,p.y));
 vec3 result=mix(color,lidTex.rgb,cover*lidTex.a*smoothstep(0.,.10,uBlink));
 // The iris stays round behind the closing aperture. Only original lash strips travel.
 float upperBand=smoothstep(up-42.,up-37.,p.y)*(1.-smoothstep(up+6.,up+10.,p.y));
 float lowerBand=smoothstep(down-3.,down,p.y)*(1.-smoothstep(down+19.,down+25.,p.y));
 vec3 lash=texture2D(uImage,vec2(p.x/1672.,1.-(top+p.y-up)/941.)).rgb;
 vec3 lower=texture2D(uImage,vec2(p.x/1672.,1.-(bottom+p.y-down)/941.)).rgb;
 float dark=1.-smoothstep(.12,.37,max(lash.r,max(lash.g,lash.b)));
 float darkLower=1.-smoothstep(.12,.37,max(lower.r,max(lower.g,lower.b)));
 float edge=smoothstep(1095.,1110.,p.x)*(1.-smoothstep(1325.,1345.,p.x));
 result=mix(result,lash,dark*upperBand*edge*lidTex.a);
 result=mix(result,lower,darkLower*lowerBand*edge*lidTex.a*.7);
 return mix(result,lidTex.rgb,lidTex.a*smoothstep(.83,1.,uBlink));
}
`;
