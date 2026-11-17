// skyline screenshots. usage: node sky.cjs <html> <region>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:900,height:500}})).newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').slice(0,200)));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'high',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const settle=async()=>{for(let k=0;k<60;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const shot=async(n,P,T,hr)=>{await E(([P,T,hr])=>{const G=window.__nb3d.game;G.player.x=P[0];G.player.z=P[2]+6;window.__nb3dCamOverride={p:P,t:T};G.hour=hr;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.wet=0;G.weather.next=9999;},[P,T,hr]);await settle();await W(2000);await p.screenshot({path:'jp/sky_'+region+'_'+n+'.png',timeout:240000}).catch(e=>console.log('shot fail',n));console.log('shot',n);};
const I=await E(()=>{const N=window.__nb3d,B=N.buildings,C=N.cityMod;
  const S0=C.STATION||{x:0,z:0},dd=(b)=>Math.hypot((b.x0+b.x1)/2-S0.x,(b.z0+b.z1)/2-S0.z);const twin=B.filter(b=>b.shape==='round'&&b.y0>3).sort((a,b)=>dd(a)-dd(b))[0];
  const sp=B.find(b=>b.shape==='spiral');
  // a shopping street: a commercial block with tall narrow buildings near the centre
  let best=null,bd=1e9;for(const k of C.blocks){if(k.zone!=='commercial')continue;const n=B.filter(b=>b.x0>=k.x0&&b.x1<=k.x1&&b.z0>=k.z0&&b.z1<=k.z1&&b.type!=='shop'&&b.h>16).length;const d=Math.hypot((k.x0+k.x1)/2,(k.z0+k.z1)/2)-n*40;if(d<bd){bd=d;best=k;}}
  const c=(b)=>b&&[(b.x0+b.x1)/2,b.y0+b.h,(b.z0+b.z1)/2];
  return {twin:c(twin),sp:c(sp),st:best&&[best.x0,best.z0,best.x1,best.z1],stats:N.cityStream};});
console.log('info',JSON.stringify(I));
if(I.twin){const [x,h,z]=I.twin;await shot('station_night',[x-60,2,z+150],[x+10,h*0.62,z-10],21);await shot('station_day',[x-60,2,z+150],[x+10,h*0.62,z-10],15);}
if(I.sp){const [x,h,z]=I.sp;await shot('spiral',[x+120,30,z+170],[x,h*0.5,z],16.5);}
await shot('aerial_day',[-700,330,900],[300,60,-300],14);
await shot('aerial_night',[-700,330,900],[300,60,-300],20.5);
if(I.st){const [x0,z0,x1,z1]=I.st;await shot('street_night',[x0-7,2.2,z1+40],[x0-7,9,z0-20],20.5);await shot('street_day',[x0-7,2.2,z1+40],[x0-7,9,z0-20],13);}
console.log('perf',JSON.stringify(await E(()=>({calls:window.__nb3d.game.fps,info:(window.__nb3dRenderer||{}).info}))));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
