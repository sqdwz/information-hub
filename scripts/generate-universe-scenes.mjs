import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../assets/scenes/', import.meta.url));
await mkdir(directory, { recursive: true });
const rnd = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const stars = color => Array.from({length: 110}, (_, i) => `<circle cx="${Math.round(rnd(i+1)*2000)}" cy="${Math.round(rnd(i+180)*1200)}" r="${(.6+rnd(i+360)*1.1).toFixed(1)}" fill="${color}" opacity="${(.12+rnd(i+500)*.3).toFixed(2)}"/>`).join('');
const wrap = (base, color, glow, art) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1200" fill="none"><defs><radialGradient id="halo"><stop stop-color="${glow}" stop-opacity=".33"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".7"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs><path fill="${base}" d="M0 0h2000v1200H0z"/><ellipse cx="1510" cy="390" rx="850" ry="760" fill="url(#halo)"/>${stars(color)}${art}</svg>`;
// Static scenes remain available for home cards, reading pages and reduced motion.
// Normalized path lengths let every light follow the existing illustration exactly.
const trail = (shape, { duration = 18, delay = 0, length = 65, opacity = .62, color } = {}) => `<g style="--duration:${duration}s;--delay:-${delay}s;--trail:${length};--gap:${1000-length};--strength:${opacity}${color ? `;--flow-color:${color}` : ''}"><${shape} pathLength="1000" class="flow flow-halo"/><${shape} pathLength="1000" class="flow flow-core"/><${shape} pathLength="1000" class="flow flow-head"/></g>`;
const flowStyle = `<style>
  .flow { fill:none; stroke:var(--flow-color); stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:var(--trail) var(--gap); animation:line-flow var(--duration) linear var(--delay) infinite; }
  .flow-halo { stroke-width:8; opacity:calc(var(--strength) * .14); }
  .flow-core { stroke-width:2.2; opacity:var(--strength); }
  .flow-head { stroke-width:3.2; stroke-dasharray:2 998; opacity:calc(var(--strength) + .15); }
  @keyframes line-flow { to { stroke-dashoffset:1000; } }
  @media (prefers-reduced-motion:reduce) { .flow { animation:none; opacity:0; } }
</style>`;
const writeScene = async (name, base, color, glow, art, flow = '') => {
  const scene = wrap(base, color, glow, art);
  await writeFile(`${directory}/${name}.svg`, scene);
  if (flow) await writeFile(`${directory}/${name}-flow.svg`, scene.replace('</svg>', `${flowStyle}<g style="--flow-color:${color}" aria-hidden="true">${flow}</g></svg>`));
};
let art = '<g stroke="#79d8ff">';
for(let i=0;i<7;i++) art += `<ellipse cx="1480" cy="560" rx="${100+i*67}" ry="${80+i*48}" opacity=".14" transform="rotate(-26 1480 560)"/>`;
for(let i=-3;i<=3;i++) art += `<ellipse cx="1480" cy="560" rx="${90+Math.abs(i)*71}" ry="405" opacity=".12" transform="rotate(${i*22} 1480 560)"/>`;
art += '<path d="M650 830Q1230-120 1920 490M760 1060Q1290 110 1980 760" stroke-width="1.5" stroke-dasharray="7 12" opacity=".3"/><path d="M1140 285q330-120 640 20" stroke-width="2" opacity=".6"/><g transform="translate(1600 254) rotate(19)"><path d="m0-28 7 22 35 12v6L8 6 6 26l9 8v4L0 33l-15 5v-4l9-8-2-20-34 6V6l35-12Z" fill="#a8e9ff" stroke="none"/></g><circle cx="1140" cy="285" r="6" fill="#a8e9ff"/><circle cx="1140" cy="285" r="17" opacity=".35"/><path d="M0 1090Q500 780 1080 1060T2100 840" opacity=".1" stroke-width="20" filter="url(#b)"/></g>';
let flow = trail('path d="M650 830Q1230-120 1920 490"', {duration:17,delay:4,length:95})
  + trail('path d="M760 1060Q1290 110 1980 760"', {duration:21,delay:14,length:78})
  + trail('path d="M1140 285q330-120 640 20"', {duration:13,delay:8,length:135,opacity:.74});
for (const [i, delay] of [[2,3],[4,11],[6,18]]) flow += trail(`ellipse cx="1480" cy="560" rx="${100+i*67}" ry="${80+i*48}" transform="rotate(-26 1480 560)"`, {duration:24+i,delay,length:52,opacity:.48});
flow += trail('ellipse cx="1480" cy="560" rx="232" ry="405" transform="rotate(44 1480 560)"', {duration:28,delay:7,length:44,opacity:.44});
await writeScene('airspace','#06131f','#8fddff','#126b9a',art,flow);
art = '<g stroke="#bb9df4">';
const nodes=Array.from({length:40},(_,i)=>({x:1080+rnd(i+19)*850,y:100+rnd(i+76)*850}));
nodes.forEach((p,i)=>{ nodes.slice(i+1).forEach(q=>{if(Math.hypot(p.x-q.x,p.y-q.y)<215)art+=`<path d="M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}" opacity=".15"/>`;});art+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i%7===0?6:2.5}" fill="#c2acff" opacity=".65"/>`;});
for(let i=0;i<5;i++)art+=`<ellipse cx="1520" cy="510" rx="${170+i*58}" ry="${240+i*23}" opacity=".1" transform="rotate(${i*31} 1520 510)"/>`;
for(let i=0;i<12;i++)art+=`<path d="M0 ${840+i*17}Q700 ${480+i*22} 1200 ${980+i*6}T2100 ${730+i*15}" opacity=".06"/>`;
art+='</g>';
flow = '';
nodes.forEach((p,i) => {
  if (i % 4 !== 0) return;
  const q = nodes.slice(i+1).find(q => Math.hypot(p.x-q.x,p.y-q.y)<215);
  if (q) flow += trail(`path d="M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}"`, {duration:8+i%5,delay:i*.79,length:180,opacity:.68});
});
for (const i of [0,2,4]) flow += trail(`ellipse cx="1520" cy="510" rx="${170+i*58}" ry="${240+i*23}" transform="rotate(${i*31} 1520 510)"`, {duration:23+i*2,delay:3+i*4,length:60,opacity:.45});
for (const i of [2,8]) flow += trail(`path d="M0 ${840+i*17}Q700 ${480+i*22} 1200 ${980+i*6}T2100 ${730+i*15}"`, {duration:30+i,delay:7+i,length:92,opacity:.3});
await writeScene('brief','#100e20','#c2b0ff','#61418c',art,flow);
art='<g stroke="#b6b08a" opacity=".11">';
for(let i=0;i<17;i++)art+=`<path d="M${760+i*95} 460 800 1200M${700+i*125} 1200 1930 ${430+i*45}"/>`;
art+='</g><g stroke="#c9c08c" stroke-width="1.1">';
const buildings=Array.from({length:24},(_,i)=>({x:880+(i%8)*126+(i>15?45:0),y:710+Math.floor(i/8)*131,w:46+rnd(i+10)*43,h:60+rnd(i+101)*230}));
buildings.forEach((b,i)=>{const{x,y,w,h}=b,dx=38,dy=-22;art+=`<path d="M${x} ${y}v-${h}l${dx} ${dy} ${w} 18v${h}l-${dx} 22Z" fill="#182d2a" opacity=".88"/><path d="M${x} ${y-h}l${w} 18v${h}M${x+w} ${y-h+18}l${dx} ${dy}" opacity=".44"/>`;for(let k=0;k<Math.floor(h/21)-1;k++)art+=`<path d="M${x+10} ${y-h+26+k*21}l${w-19} 7" stroke="#d1bd71" opacity="${k%3===i%3?.6:.15}" stroke-dasharray="4 8"/>`;});
art+='<path d="M740 1080 1120 850 1470 1050 1970 750" stroke="#e6c480" stroke-width="2" opacity=".5"/></g>';
flow = trail('path d="M740 1080 1120 850 1470 1050 1970 750"', {duration:23,delay:12,length:105,color:'#e6c480',opacity:.72});
buildings.forEach(({x,y,w,h},i) => {
  if (i % 3 !== 0) return;
  flow += trail(`path d="M${x} ${y}v-${h}l38 -22 ${w} 18v${h}l-38 22Z"`, {duration:19+i%7,delay:i*1.43,length:85,opacity:.55});
});
for (const i of [4,10]) flow += trail(`path d="M${760+i*95} 460 800 1200"`, {duration:29,delay:i,length:85,color:'#93c4ad',opacity:.3});
await writeScene('urban','#0c1818','#d5c293','#446546',art,flow);
art='<g stroke="#d1bd90">';
for(let i=0;i<7;i++){const x=1080+i*124;art+=`<path d="M${x} 1020V370q0-140 70-140t70 140v650" opacity="${.09+i*.012}" stroke-width="2"/><path d="M${x+12} 1020V380q0-120 58-120t58 120v640" opacity=".08"/>`;}
art+='<path d="M1000 1060h1000M1000 1080h1000" opacity=".17"/><g transform="translate(1390 620) rotate(-9)"><path d="M0 0h280v350H0Z" fill="#342e26" opacity=".3"/><path d="M-18 20H260V370H-18Z" opacity=".4"/>';
for(let i=0;i<9;i++)art+=`<path d="M18 ${64+i*29}H${i%3===0?180:222}" opacity=".22"/>`;
art+='<path d="M88 15V-10h92v25" opacity=".6"/><circle cx="202" cy="310" r="24" opacity=".25"/></g></g>';
flow = '';
for (const i of [0,2,4,6]) flow += trail(`path d="M${1080+i*124} 1020V370q0-140 70-140t70 140v650"`, {duration:29+i*2,delay:6+i*4,length:100,opacity:.58});
flow += '<g transform="translate(1390 620) rotate(-9)">'
  + trail('path d="M-18 20H260V370H-18Z"', {duration:26,delay:17,length:95,opacity:.53});
for (const i of [0,3,6]) flow += trail(`path d="M18 ${64+i*29}H180"`, {duration:12,delay:1+i*1.2,length:200,opacity:.43});
flow += '</g>';
await writeScene('policy','#191613','#e7cea5','#8c6837',art,flow);
art='<g stroke="#eaacca">';
for(let i=0;i<6;i++)art+=`<rect x="${1110+i*53}" y="${270+i*43}" width="510" height="310" rx="12" transform="rotate(${-17+i*7} 1470 520)" opacity="${.08+i*.025}"/>`;
art+='<path d="m1450 390 120 70-120 70Z" fill="#f0adca" stroke="none" opacity=".55"/><circle cx="1490" cy="480" r="270" stroke-dasharray="2 17" opacity=".22"/><path d="M680 1090 1390 750 1970 1010" opacity=".15"/></g>';
await writeFile(`${directory}/showcase.svg`,wrap('#1b1021','#efacca','#8f436f',art));
art='<g stroke="#87d9bd">';
for(let i=0;i<11;i++){const x=1120+i*66,h=130+rnd(i+40)*140;art+=`<path d="M${x} 960V${960-h}h48v${h}Z" fill="#193932" opacity=".3"/><path d="M${x+8} ${960-h+20}h32M${x+8} 930h32" opacity=".3"/>`;}
for(let i=0;i<5;i++)art+=`<circle cx="1510" cy="450" r="${130+i*61}" opacity=".1"/>`;
art+='<path d="M1400 370q80-45 110 0 60-45 110 0v155q-65-30-110 0-55-30-110 0ZM1510 370v155" opacity=".5" stroke-width="2"/><path d="M1000 980h1000M1000 1000h1000" opacity=".2"/></g>';
await writeFile(`${directory}/knowledge.svg`,wrap('#081a19','#a1dfc6','#216052',art));
console.log('Generated six static scenes and four themed flowing-light variants.');
