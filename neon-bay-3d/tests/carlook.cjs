// Car models close up: a row of cars on the airport apron, shot from the front quarter, the side, the rear quarter,
// a wheel, and at night; then body roll while cornering and a damaged car. usage: node carlook.cjs <html> [tag]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],tag=process.argv[3]||'car';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(()=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'high',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}}catch(e){}});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const KINDS=['sedan','sport','super','suv','hatch','muscle','pickup','taxi','police','hyper','limo','truck'];
const O=await E((KINDS)=>{const N=window.__nb3d,C=N.cityMod,G=N.game,A=C.AIRPORT;const ox=A.x0+150,oz=-60;G.hour=14;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;G.player.x=ox-12;G.player.z=oz;G.player.y=N.groundAt(ox-12,oz)+0.3;
  window.__cars=KINDS.map((k,i)=>{const v=N.spawn(k,ox+i*4.2,oz,0);v.touched=true;return v.id});window.__pin=setInterval(()=>{},1e6);return {ox,oz,y:N.groundAt(ox,oz),blocked:C.pointBlocked(ox,0.6,oz)}},KINDS);
console.log('origin',JSON.stringify(O));
const hud=(on)=>E((on)=>{const main=[...document.querySelectorAll('canvas')].find(c=>!c.classList.contains('minimap'));document.querySelectorAll('#root *').forEach(e=>{if(e!==main&&!e.contains(main))e.style.visibility=on?'':'hidden'})},on);
const shot=async(n,P,T,h=14)=>{await E(([P,T,h])=>{const G=window.__nb3d.game;G.hour=h;window.__nb3dCamOverride={p:P,t:T};},[P,T,h]);await settle();await W(2500);await p.screenshot({path:'jp/'+tag+'_'+n+'.png',timeout:180000});console.log('shot',n);};
const {ox,oz,y}=O;await hud(false);
await shot('front',[ox-3.2,y+1.5,oz+6.2],[ox+5,y+0.7,oz]);
await shot('front2',[ox+13.6,y+1.5,oz+6.2],[ox+21.8,y+0.7,oz]);
await shot('side',[ox-5.5,y+1.1,oz+0.2],[ox+2,y+0.7,oz+0.2]);
await shot('rear',[ox-3.2,y+1.6,oz-6.4],[ox+5,y+0.7,oz]);
await shot('wheel',[ox-2.1,y+0.75,oz+2.6],[ox-0.6,y+0.4,oz+1.2]);
await shot('top',[ox+6,y+9,oz+2.5],[ox+6,y,oz]);
await E(()=>{window.__nb3d.game.inCar=window.__cars[0]});await shot('night',[ox-3.2,y+1.5,oz+6.2],[ox+5,y+0.7,oz],21.5);await shot('night_rear',[ox-3.2,y+1.6,oz-6.4],[ox+5,y+0.7,oz],21.5);
// from the driver's seat
await E(()=>{const G=window.__nb3d.game;G.hour=14;G.cam.carMode=2;window.__nb3dCamOverride=null;});await W(6000);await p.screenshot({path:'jp/'+tag+'_cockpit.png',timeout:180000});console.log('shot cockpit');await E(()=>{const G=window.__nb3d.game;G.cam.carMode=0;G.inCar=0;});
await shot('rows',[ox+34,y+2.4,oz+9],[ox+40,y+0.8,oz],14);
// ---- body roll and dive: the body leans, the wheels stay on the road ----
const r=await E(()=>{const N=window.__nb3d,v=N.vehicles.find(q=>q.id===window.__cars[0]);v.roll=0.1;v.squat=0.05;return {roll:v.roll}});
await shot('roll',[ox,y+0.9,oz+7],[ox,y+0.6,oz]);
// ---- damage ----
await E(()=>{const N=window.__nb3d;for(const id of window.__cars.slice(0,3)){const v=N.vehicles.find(q=>q.id===id);v.roll=0;v.squat=0;v.hp=v.def.hp*0.3;}});
await shot('damage',[ox-3.2,y+1.5,oz+6.2],[ox+5,y+0.7,oz]);
// what each model costs to draw: meshes (draw calls) and triangles, close up and with the small parts and the cabin hidden (far away)
console.log('cost',JSON.stringify(await E((KINDS)=>{const N=window.__nb3d,out={};window.__cars.forEach((id,i)=>{const m=N.carModels.get(id);if(!m)return;let calls=0,tris=0,farCalls=0,farTris=0;m.root.traverse(o=>{if(!o.isMesh)return;let far=true,vis=true;for(let q=o;q;q=q.parent){if(q.userData.small||q.userData.cabin)far=false;}if(o===m.neon||(m.damage&&(o===m.damage.soot||o===m.damage.crack)))return;const t=o.geometry.getAttribute('position').count/(o.geometry.index?1:3);const n=o.geometry.index?o.geometry.index.count/3:t;calls++;tris+=n;if(far){farCalls++;farTris+=n;}});out[KINDS[i]]=[calls,Math.round(tris),farCalls,Math.round(farTris)];});return out},KINDS)));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
