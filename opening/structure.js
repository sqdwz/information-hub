// Art-directed control points in the original 1672 × 941 artwork's pixel space.
// No edge detector, random tessellation or particle reconstruction is used.
export const ART = { width:1672, height:941 };
export const GROUPS = {
  hair:{label:'HairCurves',color:'#67caff',materialStart:2.80,spread:.62,radius:78},
  hand:{label:'HandStructure',color:'#b2dcff',materialStart:2.84,spread:.35,radius:100},
  face:{label:'FaceContours',color:'#c0e8f8',materialStart:2.97,spread:.22,radius:180,timeRate:.16},
  eye:{label:'EyeStructure',color:'#a1e8ff',materialStart:2.96,spread:.18,radius:56,timeRate:.24},
  cloth:{label:'CostumeContours',color:'#82b8d9',materialStart:3.04,spread:.63,radius:125},
  ornament:{label:'Ornament',color:'#e9ba86',materialStart:3.12,spread:.30,radius:50},
};
const paths=[];
function add(id,group,start,duration,width,points,options={}){
  paths.push({id,group,start,duration,width,points,...options});
}

// Each lock has its own hand-placed route. The order follows tips → main locks → fringe.
add('hair-left-wisp','hair',.60,1.15,.80,[[629,249],[690,235],[745,199],[782,150],[817,79],[854,0]]);
add('hair-rim-main','hair',.68,1.25,1.45,[[501,657],[616,610],[711,552],[770,469],[813,362],[817,258],[837,145],[889,31]]);
add('hair-rim-inner','hair',.79,1.15,.72,[[590,663],[696,592],[761,516],[794,435],[806,345],[827,258],[863,171]]);
add('hair-floating-top','hair',.86,1.05,.75,[[604,143],[578,96],[577,48],[601,0]]);
add('hair-top-loop','hair',.98,1.00,.62,[[706,90],[674,87],[654,53],[660,0]]);
add('hair-left-lock-a','hair',.62,1.35,1.20,[[124,690],[230,655],[337,631],[431,641],[526,622],[624,558],[710,496]]);
add('hair-left-lock-b','hair',.74,1.30,.80,[[39,736],[151,694],[256,666],[350,660],[421,672],[501,650],[580,611]]);
add('hair-left-lock-c','hair',.91,1.05,.68,[[234,714],[318,676],[408,679],[471,682],[538,657],[595,630]]);
add('hair-left-arc','hair',.84,1.18,.85,[[392,670],[480,600],[551,527],[618,502],[679,519],[738,507],[772,468]]);
add('hair-loop-return','hair',.97,1.18,.68,[[591,605],[653,567],[684,521],[667,496],[625,492],[576,510]]);
add('hair-low-silhouette','hair',.76,1.42,1.08,[[21,937],[41,860],[90,785],[158,718],[249,694]]);
add('hair-low-ribbon','hair',1.02,1.18,.64,[[79,934],[113,866],[156,813],[209,781],[265,780]]);
add('hair-face-left','hair',1.08,1.13,1.10,[[1016,0],[988,114],[1000,237],[1033,347],[1075,439],[1147,497],[1220,512]]);
add('hair-face-left-inner','hair',1.19,1.08,.60,[[1037,28],[1012,141],[1026,264],[1069,378],[1116,454],[1177,482]]);
add('hair-bang-a','hair',1.02,1.20,.92,[[1140,0],[1135,112],[1117,210],[1083,298],[1086,367]]);
add('hair-bang-b','hair',1.12,1.16,.68,[[1181,0],[1161,91],[1142,191],[1108,277],[1110,339]]);
add('hair-bang-c','hair',1.18,1.10,.75,[[1207,0],[1193,104],[1204,213],[1250,298],[1316,350],[1409,364]]);
add('hair-bang-d','hair',1.28,1.08,.66,[[1276,0],[1284,101],[1326,212],[1384,277],[1459,304],[1544,294]]);
add('hair-bang-e','hair',1.34,1.07,.59,[[1323,8],[1345,112],[1396,212],[1473,260],[1555,261]]);
add('hair-fringe-over-eye','hair',1.35,1.08,.73,[[1227,88],[1241,203],[1287,291],[1352,355],[1408,379],[1439,366]]);
add('hair-fringe-fine','hair',1.49,.92,.55,[[1263,146],[1286,250],[1345,330],[1410,360],[1432,394],[1404,418]]);
add('hair-right-crown','hair',1.10,1.22,.78,[[1435,0],[1484,110],[1562,188],[1668,214]]);
add('hair-right-sweep','hair',1.24,1.15,.61,[[1470,0],[1520,109],[1605,173],[1670,181]]);
add('hair-right-temple','hair',1.41,1.10,.62,[[1668,226],[1603,278],[1583,357],[1616,432],[1670,467]]);
add('hair-right-cheek','hair',1.54,1.05,.62,[[1669,416],[1632,465],[1620,533],[1640,592],[1671,618]]);
add('hair-chin-curl','hair',1.18,1.48,1.15,[[1138,640],[1208,674],[1281,707],[1334,761],[1350,820],[1324,879],[1266,925],[1209,941]]);
add('hair-chin-curl-inner','hair',1.32,1.38,.66,[[1179,668],[1252,706],[1301,754],[1319,808],[1294,860],[1245,900],[1190,941]]);
add('hair-chin-curl-fine','hair',1.49,1.21,.60,[[1221,696],[1276,742],[1297,793],[1287,835],[1240,884],[1198,913]]);
add('hair-neck-wisp','hair',1.42,1.26,.77,[[1005,673],[1075,691],[1127,727],[1159,775],[1137,821],[1092,855]]);
add('hair-neck-wisp-inner','hair',1.55,1.08,.54,[[1041,687],[1093,715],[1127,758],[1124,795],[1095,824]]);
add('hair-low-back-a','hair',1.01,1.42,.67,[[729,921],[726,841],[748,757],[797,693],[857,645],[905,582]]);
add('hair-low-back-b','hair',1.21,1.24,.56,[[805,927],[796,847],[815,779],[857,727],[898,683]]);
add('hair-bottom-stream','hair',1.37,1.20,.63,[[1155,941],[1185,894],[1210,860],[1246,845],[1282,848]]);
add('hair-ear-border','hair',.95,1.13,.84,[[637,245],[684,260],[744,261],[796,243],[834,210]]);

// Foreground hand: actual finger silhouette and palm edge; no internal lattice.
add('hand-raised-finger','hand',.60,1.30,1.25,[[494,641],[463,602],[426,559],[383,532],[348,519],[326,525],[317,544],[332,579],[350,612],[365,648]]);
add('hand-index-tip','hand',.72,1.28,1.05,[[366,721],[308,738],[249,741],[185,742],[148,750],[132,766],[146,780],[192,788],[248,801],[286,810]]);
add('hand-palm-outer','hand',.94,1.48,.94,[[484,631],[539,662],[578,706],[595,759],[594,817],[571,866],[533,898],[484,911],[437,899],[407,871]]);
add('hand-thumb-web','hand',1.04,1.10,.73,[[366,648],[348,669],[333,690],[331,710],[351,721]]);
add('hand-fold-finger-one','hand',1.11,1.15,.72,[[283,810],[293,783],[319,766],[341,774],[355,806],[349,839]]);
add('hand-fold-finger-two','hand',1.21,1.08,.68,[[350,839],[362,810],[386,808],[405,825],[413,854],[405,871]]);
add('hand-fold-finger-three','hand',1.32,1.06,.64,[[405,870],[418,849],[437,852],[452,878],[445,897]]);
add('hand-palm-hint','hand',1.47,.82,.45,[[431,733],[454,756],[466,786]],{emphasis:.55});

// Face: deliberately sparse contours. Do not draw blue hatching on the skin.
add('face-cheek-chin','face',1.78,1.02,.79,[[1203,535],[1250,581],[1306,622],[1370,665],[1432,691],[1490,700],[1535,694],[1580,679],[1621,655]]);
add('face-right-outline','face',1.98,.80,.56,[[1667,506],[1658,563],[1641,613],[1621,655]]);
add('face-nose-hint','face',2.08,.55,.45,[[1422,450],[1434,471],[1440,487]],{emphasis:.60});
add('face-nose-wing','face',2.16,.47,.42,[[1443,508],[1453,513],[1461,509]],{emphasis:.55});
add('face-lip-smile','face',2.20,.62,.62,[[1426,582],[1466,587],[1504,579],[1542,563],[1555,550]]);
add('face-lower-lip','face',2.34,.48,.38,[[1472,600],[1500,596],[1522,587]],{emphasis:.45});
add('face-brow-hint','face',1.96,.73,.49,[[1109,308],[1157,280],[1208,265],[1232,267]],{emphasis:.65});

// Eye architecture follows the illustrated eyelids, not a generic HUD eye.
add('eye-upper-lid','eye',1.89,.74,1.05,[[1106,411],[1128,383],[1164,357],[1202,342],[1241,341],[1282,353],[1313,377],[1329,398]]);
add('eye-lower-lid','eye',2.02,.73,.72,[[1112,416],[1137,441],[1177,458],[1217,464],[1258,452],[1297,433],[1320,412]]);
const lashes=[
 [[1119,394],[1098,397],[1077,394]],[[1133,380],[1113,380],[1096,372]],
 [[1150,367],[1134,361],[1120,346]],[[1173,353],[1157,338],[1149,321]],
 [[1203,344],[1191,327],[1184,310]],[[1233,341],[1224,328],[1223,312]],
 [[1268,348],[1280,341],[1292,335]],[[1293,362],[1310,362],[1323,368]],
];
lashes.forEach((p,i)=>add(`eye-lash-${i+1}`,'eye',2.04+i*.035,.34,.57,p));
const lowerLashes=[[[1142,445],[1135,454],[1134,462]],[[1164,454],[1158,465],[1158,471]],[[1188,461],[1184,473],[1185,480]],[[1212,462],[1211,474],[1215,480]]];
lowerLashes.forEach((p,i)=>add(`eye-lower-lash-${i+1}`,'eye',2.28+i*.035,.31,.36,p));
function ellipsePoints(cx,cy,rx,ry,start,extent,count=32){return Array.from({length:count+1},(_,i)=>{const a=start+extent*i/count;return[cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});}
add('eye-iris-outer','eye',2.12,.62,.70,ellipsePoints(1236,403,60,63,-2.48,Math.PI*1.79),{spline:false});
add('eye-iris-inner','eye',2.34,.53,.42,ellipsePoints(1236,403,39,44,-2.1,Math.PI*1.73),{spline:false});
add('eye-pupil','eye',2.42,.44,.54,ellipsePoints(1236,403,12,22,0,Math.PI*2),{spline:false});

// A few garment seams supply the remaining material, following real cuff/collar edges.
add('cloth-cuff-outer','cloth',1.37,1.10,.68,[[569,682],[609,730],[637,802],[627,875],[600,941]]);
add('cloth-cuff-inner','cloth',1.49,1.08,.49,[[610,699],[655,744],[680,812],[684,885],[666,941]]);
add('cloth-sleeve-top','cloth',1.60,1.14,.58,[[639,682],[729,684],[812,706],[894,737],[976,770]]);
add('cloth-shoulder','cloth',1.78,1.04,.65,[[934,705],[989,670],[1058,650],[1117,665],[1174,697]]);
add('cloth-collar','cloth',1.96,.86,.58,[[1242,697],[1285,749],[1337,786],[1407,814],[1463,809]]);
add('cloth-ribbon','cloth',2.05,.85,.56,[[1470,846],[1542,812],[1617,831],[1665,875]]);
add('cloth-lower-seam','cloth',1.90,.95,.45,[[866,749],[930,799],[988,869],[1019,941]]);
add('cloth-ear','cloth',1.36,1.00,.67,[[651,289],[687,323],[748,350],[788,357],[833,327]]);

// Warm accent is subordinate to the cyan character drawing.
const flower=[[926,66],[942,128],[1005,83],[960,144],[1021,159],[960,161],[988,220],[945,171],[919,236],[929,168],[863,184],[917,151],[876,112],[929,140],[926,66]];
add('ornament-petals','ornament',1.50,1.20,.60,flower,{emphasis:.45});

export const STRUCTURE = paths;
export function samplePath(path,spacing=3){
  const controls=path.points;const dense=[];
  if(path.spline===false){dense.push(...controls.map(([x,y])=>({x,y})));}
  else for(let i=0;i<controls.length-1;i++){
    const p0=controls[Math.max(0,i-1)],p1=controls[i],p2=controls[i+1],p3=controls[Math.min(controls.length-1,i+2)];
    const count=Math.max(12,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/2));
    for(let j=0;j<count;j++){
      const t=j/count,t2=t*t,t3=t2*t;
      const value=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
      dense.push({x:value(0),y:value(1)});
    }
  }
  const last=controls.at(-1);dense.push({x:last[0],y:last[1]});
  const lengths=[0];for(let i=1;i<dense.length;i++)lengths.push(lengths[i-1]+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
  const length=lengths.at(-1),count=Math.max(4,Math.ceil(length/spacing)),samples=[];let index=1;
  for(let i=0;i<=count;i++){
    const d=length*i/count;while(index<lengths.length-1&&lengths[index]<d)index++;
    const a=dense[index-1],b=dense[index],f=(d-lengths[index-1])/Math.max(.00001,lengths[index]-lengths[index-1]);
    samples.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,u:i/count});
  }
  return{...path,length,samples};
}
export const SAMPLED = STRUCTURE.map(p=>samplePath(p));
export function growthAt(path,time){
  const x=Math.max(0,Math.min(1,(time-path.start)/path.duration));
  return x*x*(3-2*x);
}
export function growthBirth(path,u){
  // Inverse of the very same smoothstep used by the visible stroke's arc-length growth.
  let lo=0,hi=1;for(let i=0;i<20;i++){const x=(lo+hi)*.5;if(x*x*(3-2*x)<u)lo=x;else hi=x;}
  return path.start+path.duration*(lo+hi)*.5;
}
export function materialSeedTime(path,u){
  const born=growthBirth(path,u),g=GROUPS[path.group];
  return g.materialStart+Math.max(0,born-path.start)*(g.timeRate??.31)+(path.start-(path.group==='hair'?.6:path.group==='hand'?.6:1.5))*.08;
}
export const REGIONS = {
  face:[[1115,240],[1230,77],[1453,104],[1668,272],[1672,665],[1580,731],[1509,746],[1403,711],[1303,654],[1202,548],[1101,449]],
  hand:[[128,751],[185,735],[307,726],[345,707],[338,663],[318,614],[301,550],[323,516],[353,515],[400,540],[457,590],[494,629],[550,659],[589,706],[612,780],[596,848],[561,895],[491,925],[430,913],[374,880],[314,837],[257,819],[186,805],[130,784]],
  cloth:[[522,651],[633,658],[741,682],[896,703],[1004,636],[1089,624],[1183,670],[1305,722],[1477,794],[1672,801],[1672,941],[230,941],[286,863],[407,900],[503,887],[554,817],[558,740]],
};
