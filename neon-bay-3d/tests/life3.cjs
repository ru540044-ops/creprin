// Door visits (stepped simulation), rotary taxi + airport bus, footbridge walk, diner / store counters, shots. usage: node life3.cjs <html> [region]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=25000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<30&&(await E(()=>window.__nb3d.input.action));k++)await W(300);await W(800);};
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const clear=(hr)=>E((hr)=>{const G=window.__nb3d.game;G.hour=hr;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.wet=0;G.weather.next=9999;},hr);
const shot=async(n,P,T,hr)=>{await E(([P,T])=>{const G=window.__nb3d.game;G.player.x=P[0];G.player.z=P[2]+5;window.__nb3dCamOverride={p:P,t:T};},[P,T]);await clear(hr);await settle();await W(1500);await p.screenshot({path:'jp/life3_'+region+'_'+n+'.png',timeout:180000});console.log('shot',n);};
await clear(18);await E(()=>{window.__nb3d.game.money=500});
// ---- door visits, simulation stepped at 20 Hz for 120 s of game time in a shopping street ----
const com=await E(()=>{const C=window.__nb3d.cityMod;let best=null,bd=1e9;for(const k of C.blocks){if(k.zone!=='commercial')continue;const d=Math.hypot((k.x0+k.x1)/2,(k.z0+k.z1)/2);if(d<bd){bd=d;best=k;}}return {x:(best.x0+best.x1)/2,z:best.z0-3}});
console.log('door sim',JSON.stringify(await E(([c])=>{const N=window.__nb3d,G=N.game,P=N.peds;G.player.x=c.x;G.player.z=c.z;G.player.y=0.2;P.length=0;
  const seen=new Set(),stats={spawned:0,target:0,enter:0,wentIn:0,exit:0,commuters:0};let entering=new Set();
  for(let k=0;k<2400;k++){N.pedsMod.updatePeds(0.05);G.clock+=0.05;const now=new Set(P.map(q=>q.id));for(const id of entering)if(!now.has(id))stats.wentIn++;entering=new Set();
    for(const q of P){if(!seen.has(q.id)){seen.add(q.id);stats.spawned++;if(q.state==='exit')stats.exit++;if(q.shop>=0)stats.target++;if(q.outfit===4)stats.commuters++;}if(q.state==='enter'){entering.add(q.id);if(!seen.has('e'+q.id)){seen.add('e'+q.id);stats.enter++;}}}}
  return stats;},[com])));
// ---- rotary: taxi rank with and without a waypoint, airport bus ----
const R=await E(()=>{const R=window.__nb3d.cityMod.ROTARY;return JSON.parse(JSON.stringify(R))});console.log('rotary',JSON.stringify({on:R.on,taxi:R.taxi,bus:R.bus}));
if(R.on){
  await shot('rotary',[R.x0-14,9,R.z1+14],[(R.x0+R.x1)/2,0,(R.z0+R.z1)/2],15);await E(()=>{window.__nb3dCamOverride=null});
  await E((t)=>{const G=window.__nb3d.game;G.waypoint=null;G.player.x=t.x-0.8;G.player.z=t.z;G.player.y=0.2;},R.taxi);console.log('taxi no wp',await waitNear('jp:taxi'));
  await E(()=>{window.__nb3d.game.waypoint={x:0,z:-1500}});console.log('taxi wp',await waitNear('jp:taxi|'));const m0=await E(()=>window.__nb3d.game.money);await act();
  console.log('taxi ride',JSON.stringify(await E((m0)=>{const G=window.__nb3d.game;return {p:[Math.round(G.player.x),Math.round(G.player.z)],paid:m0-G.money,wp:G.waypoint,toast:G.toast}},m0)));
  await E((t)=>{const G=window.__nb3d.game;G.player.x=t.x+0.8;G.player.z=t.z;G.player.y=0.2;},R.bus);console.log('bus',await waitNear('jp:bus'));await act();
  console.log('bus ride',JSON.stringify(await E(()=>{const G=window.__nb3d.game,A=window.__nb3d.cityMod.AIRPORT_ARRIVAL;return {d:Math.round(Math.hypot(G.player.x-A.x,G.player.z-A.z)),money:G.money,toast:G.toast}})));
}
// ---- footbridge: walk up, across and down (the stick drives the player like a thumb would) ----
const FBI=await E(()=>{const C=window.__nb3d.cityMod;const B=[...C.BRIDGES].sort((a,c)=>Math.hypot(a.x,a.z)-Math.hypot(c.x,c.z))[0];return {B,F:C.FB,ROAD:C.ROAD}});
{const {B,F,ROAD}=FBI,xe=B.x+ROAD/2,xw=B.x-ROAD/2,sx=xe+(F.s0+F.s1)/2,swx=xw-(F.s0+F.s1)/2,z0=B.z+F.hw;
 const walk=async(tx,tz,ms)=>{const t=Date.now();let last=null,maxY=0;while(Date.now()-t<ms){last=await E(([tx,tz])=>{const N=window.__nb3d,G=N.game,P=G.player,dx=tx-P.x,dz=tz-P.z,d=Math.hypot(dx,dz);if(d<0.6){N.input.joyActive=false;N.input.joyX=N.input.joyY=0;return {done:true,p:[+P.x.toFixed(1),+P.y.toFixed(2),+P.z.toFixed(1)]};}
     G.cam.yaw=Math.atan2(-dx,-dz);N.input.joyActive=true;N.input.joyX=0;N.input.joyY=1;return {done:false,p:[+P.x.toFixed(1),+P.y.toFixed(2),+P.z.toFixed(1)]};},[tx,tz]);maxY=Math.max(maxY,last.p[1]);if(last.done)break;await W(200);}
   await E(()=>{const N=window.__nb3d;N.input.joyActive=false;N.input.joyX=N.input.joyY=0;});return {...last,maxY};};
 await E(([sx,z])=>{const G=window.__nb3d.game;G.player.x=sx;G.player.z=z;G.player.y=0.2;},[sx,z0+F.run+1.5]);await W(1000);
 console.log('up',JSON.stringify(await walk(sx,z0-0.3,240000)));console.log('across',JSON.stringify(await walk(swx,B.z,240000)));console.log('down',JSON.stringify(await walk(swx,z0+F.run+1.2,240000)));}
// ---- the diner and the first convenience store: counters ----
for(const id of ['diner','store']){const d=await E((id)=>{const q=window.__nb3d.doors.find(o=>o.id===id);return q&&{id:q.id,x:q.x,z:q.z,ang:q.ang}},id);if(!d){console.log(id,'no door');continue;}
  await E((d)=>{const G=window.__nb3d.game;G.where='out';G.ui='';G.player.x=d.x+Math.sin(d.ang)*0.4;G.player.z=d.z+Math.cos(d.ang)*0.4;G.player.y=0.2;},d);console.log(id,await waitNear(d.id));
  await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<40&&(await E(()=>window.__nb3d.game.where))==='out';k++)await W(400);await W(800);
  const pos=id==='diner'?[0,-3.3]:[6.2,2.5];await E(([x,z])=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];G.player.x=I.ox+x;G.player.z=I.oz+z;},pos);
  console.log(' inside',await E(()=>window.__nb3d.INTERIORS[window.__nb3d.game.where].name),'|',await waitNear('shop:'));
  if(id==='store'){await E(()=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];window.__nb3dCamOverride={p:[I.ox-1.5,-50+2.6,I.oz+5.6],t:[I.ox+0.5,-50+1.1,I.oz-4]};});await W(2500);await p.screenshot({path:'jp/life3_'+region+'_store.png',timeout:180000});await E(()=>{window.__nb3dCamOverride=null});}}
// ---- storefront sign of a convenience store, day and night ----
const kd=await E(()=>{const N=window.__nb3d;let best=null,bd=1e9;for(const d of N.BDOORS){if(d.kind!=='shop'||!['QWIK 24','NEON MART','BAY 24','よるマート'].includes(d.label))continue;const q=Math.hypot(d.x,d.z);if(q<bd){bd=q;best=d;}}return {x:best.x,z:best.z,ang:best.ang,label:best.label}});
await E(()=>{window.__nb3d.game.where='out'});
{const nx=Math.sin(kd.ang),nz=Math.cos(kd.ang);await shot('front_day',[kd.x+nx*12-nz*4,2.4,kd.z+nz*12+nx*4],[kd.x,3.3,kd.z],14);await shot('front_night',[kd.x+nx*12-nz*4,2.4,kd.z+nz*12+nx*4],[kd.x,3.3,kd.z],21);}
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
