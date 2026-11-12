// Coin parking (pay in a bay, the car stays when you go far away, leaving the bay ends it) and the road signs
// (counts, screenshots of a stop sign, a speed limit, a blue guide board, a coin lot). usage: node parking.cjs <html> [region]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'osaka';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=40000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<30&&(await E(()=>window.__nb3d.input.action));k++)await W(300);await W(600);};
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const shot=async(n,P,T,h)=>{await E(([P,T,h])=>{const G=window.__nb3d.game;G.hour=h;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;if(!G.inCar){G.player.x=P[0];G.player.z=P[2]+3;}window.__nb3dCamOverride={p:P,t:T};},[P,T,h]);await settle();await W(2000);await p.screenshot({path:'jp/park_'+region+'_'+n+'.png',timeout:180000});console.log('shot',n);};
console.log('signs',JSON.stringify(await E(()=>window.__nb3dSigns)));
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.money=100;G.weather.kind='clear';G.weather.rain=0;G.weather.next=9999;});
// ---- a coin lot: drive into a bay, pay, walk far away, the car is still there; an ordinary abandoned car is cleared ----
const lot=await E(()=>{const C=window.__nb3d.cityMod,G=window.__nb3d.game;const L=C.blocks.filter(k=>k.zone==='parking').sort((a,c)=>Math.hypot((a.x0+a.x1)/2,(a.z0+a.z1)/2)-Math.hypot((c.x0+c.x1)/2,(c.z0+c.z1)/2))[0];return L&&{x0:L.x0,z0:L.z0,x1:L.x1,z1:L.z1}});
console.log('lot',JSON.stringify(lot));
if(lot){
  const bay={x:lot.x0+9+3.2*3+1.6,z:lot.z0+12.6};
  await E(([bay])=>{const N=window.__nb3d,G=N.game;const v=N.spawn('sedan',bay.x,bay.z,0);v.touched=true;G.player.x=bay.x;G.player.z=bay.z;G.inCar=v.id;window.__car=v.id;
    const o=N.spawn('sedan',bay.x+12,bay.z-9,0);o.touched=true;window.__other=o.id;},[bay]);
  console.log('in the bay',await waitNear('coin:park'),JSON.stringify(await E(()=>({inBay:window.__nb3d.parkingMod.inCoinBay(window.__nb3d.playerCar().x,window.__nb3d.playerCar().z),kind:window.__nb3d.playerCar().def.kind}))));
  await act();console.log('parked',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.vehicles.find(q=>q.id===window.__car);return {parked:v.parked,money:N.game.money,toast:N.game.toast}})));
  await E(()=>{window.__nb3dCamOverride=null});await W(1500);await p.locator('.minimap').click().catch(()=>{});await W(2500);await p.screenshot({path:'jp/park_'+region+'_map.png',timeout:180000});await E(()=>{const b=[...document.querySelectorAll('.map .row button')].find(b=>b.innerText.includes('閉じる'));if(b)b.click()});await W(500);
  // out of the car, 700 m away, long enough for the street sweeper to run
  await E(()=>{const N=window.__nb3d,G=N.game;G.inCar=0;const v=N.vehicles.find(q=>q.id===window.__car);G.player.x=v.x+700;G.player.z=v.z;G.player.y=0.3;});
  for(let k=0;k<70;k++){await W(1000);if(!(await E(()=>!!window.__nb3d.vehicles.find(q=>q.id===window.__other))))break;}
  console.log('far away',JSON.stringify(await E(()=>{const N=window.__nb3d;return {parkedCarStillThere:!!N.vehicles.find(q=>q.id===window.__car),abandonedCarStillThere:!!N.vehicles.find(q=>q.id===window.__other),parkedList:N.parkingMod.parkedCars().length}})));
  // back, drive out of the bay: no longer parked
  await E(()=>{const N=window.__nb3d,G=N.game,v=N.vehicles.find(q=>q.id===window.__car);G.player.x=v.x;G.player.z=v.z;G.inCar=v.id;v.z+=6;});await W(2500);
  console.log('drove out',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.vehicles.find(q=>q.id===window.__car);return {parked:v.parked,toast:N.game.toast}})));
  // no money: refused
  await E(([bay])=>{const N=window.__nb3d,G=N.game,v=N.vehicles.find(q=>q.id===window.__car);v.x=bay.x;v.z=bay.z;v.vx=v.vz=0;G.money=1;},[bay]);console.log('poor',await waitNear('coin:park'));await act();console.log(' ->',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.vehicles.find(q=>q.id===window.__car);return {parked:!!v.parked,toast:N.game.toast}})));
  await E(()=>{window.__nb3d.game.inCar=0;window.__nb3d.game.money=100});
  await shot('lot',[lot.x0-5,3.2,lot.z0-7],[lot.x0+10,2.4,lot.z0+12],14);
}
// ---- signs: a stop sign at a lane mouth, a speed limit, a guide board ----
const L=await E(()=>{const C=window.__nb3d.cityMod;const q=C.LANES.slice().sort((a,c)=>Math.hypot(a.x0,a.z)-Math.hypot(c.x0,c.z))[0];return q});
if(L)await shot('stop',[L.x0-6,1.9,L.z+3.2],[L.x0+1,2.2,L.z+2.4],15);
const J=await E(()=>{const C=window.__nb3d.cityMod,N=C.N;for(let j=2;j<N-1;j+=4)for(let i=3;i<N-1;i+=6){if(C.nodeOpen(i,j)&&C.segOpen('x',j,i-1)&&C.segOpen('x',j,i)&&Math.abs(C.roadC(i))<700&&Math.abs(C.roadC(j))<700)return {x:C.roadC(i),z:C.roadC(j),road:C.ROAD};}return null});
if(J){await shot('guide',[J.x-J.road/2-46,2.2,J.z-2.5],[J.x-J.road/2-14,6.2,J.z],14);await shot('guide_night',[J.x-J.road/2-46,2.2,J.z-2.5],[J.x-J.road/2-14,6.2,J.z],21);await shot('limit',[J.x+J.road/2-4,1.8,J.z-J.road/2+2.5],[J.x+J.road/2+4,2.8,J.z-J.road/2-0.75],14);}
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
