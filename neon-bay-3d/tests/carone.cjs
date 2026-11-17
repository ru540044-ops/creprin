// One car model close up on tarmac, from six angles (screenshots jp/<tag>_<kind>_*.png).
// usage: node carone.cjs <html> <kind[,kind...]> [tag] [colour]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],kinds=(process.argv[3]||'super').split(','),tag=process.argv[4]||'one',colour=process.argv[5]||'';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(()=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'high',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}}catch(e){}});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
// a coin car park near the middle of town: flat tarmac with the city behind
const O=await E(()=>{const N=window.__nb3d,C=N.cityMod,G=N.game;const L=C.blocks.filter(k=>k.zone==='parking').sort((a,c)=>Math.hypot((a.x0+a.x1)/2,(a.z0+a.z1)/2)-Math.hypot((c.x0+c.x1)/2,(c.z0+c.z1)/2))[0];const ox=(L.x0+L.x1)/2,oz=(L.z0+L.z1)/2+8;
  G.hour=15;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;G.player.x=L.x0+3;G.player.z=L.z0+3;G.player.y=N.groundAt(L.x0+3,L.z0+3)+0.3;window.__pin=setInterval(()=>{G.hour=window.__hour||15},1500);
  for(const v of [...N.vehicles])if(Math.hypot(v.x-ox,v.z-oz)<40)N.remove(v);return {ox,oz,y:N.groundAt(ox,oz)}});
console.log('origin',JSON.stringify(O));const {ox,oz,y}=O;
await E(()=>{const main=[...document.querySelectorAll('canvas')].find(c=>!c.classList.contains('minimap'));document.querySelectorAll('body *').forEach(e=>{if(e!==main&&!e.contains(main))e.style.visibility='hidden'})});
const shot=async(n,P,T)=>{await E(([P,T])=>{window.__nb3dCamOverride={p:P,t:T};},[P,T]);await settle();await W(2500);await p.screenshot({path:'jp/'+tag+'_'+n+'.png',timeout:180000});console.log('shot',n);};
for(const kind of kinds){
  await E(([kind,ox,oz,colour])=>{const N=window.__nb3d;if(window.__one){const o=N.vehicles.find(q=>q.id===window.__one);if(o)N.remove(o);}const v=N.spawn(kind,ox,oz,0,colour||undefined);v.touched=true;window.__one=v.id;},[kind,ox,oz,colour]);
  // the car faces +z; right-hand side is -x
  await shot(kind+'_fq',[ox-3.3,y+1.25,oz+4.6],[ox+0.2,y+0.6,oz+0.3]);
  await shot(kind+'_side',[ox-6.2,y+0.95,oz],[ox,y+0.62,oz]);
  await shot(kind+'_rq',[ox-3.4,y+1.35,oz-4.6],[ox+0.2,y+0.6,oz-0.3]);
  await shot(kind+'_front',[ox,y+0.9,oz+6],[ox,y+0.6,oz]);
  await shot(kind+'_rear',[ox,y+1.0,oz-6],[ox,y+0.6,oz]);
  await shot(kind+'_top',[ox-0.01,y+7.5,oz],[ox,y,oz]);
}
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
