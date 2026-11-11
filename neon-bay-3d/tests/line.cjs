// The real-distance line between cities: route lengths, a passenger ride Tokyo -> Osaka (views: Tokyo, Mt Fuji, a tunnel,
// Lake Hamana, passing Nagoya), the clock, fast-forward, arrival; then driving the bullet train out of the tunnel onto the
// line (ATC, admin speed), and arriving in the cab at the next city. usage: node line.cjs <html>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message,(e.stack||'').slice(0,400))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(()=>{try{if(!sessionStorage.getItem('nb3d.init')){sessionStorage.setItem('nb3d.init','1');localStorage.clear();localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}}catch(e){}});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const clear=(hr)=>E((hr)=>{const G=window.__nb3d.game;G.hour=hr;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.wet=0;G.weather.next=9999;},hr);
await clear(10);await E(()=>{window.__nb3d.game.money=5000});
// ---- the travel app offers the ride ----
await p.tap('.phoneChip');await p.locator('.appIc',{hasText:'旅行'}).tap();await W(800);
await p.locator('.travelPick button',{hasText:'大阪'}).tap();await W(400);
console.log('app',(await p.locator('.jobCard').innerText()).replace(/\n/g,' | ').slice(0,400));
// the ride button asks for a second tap within 3 s; at 1-2 fps the element never counts as "stable" for that long, so click it directly
const clickBtn=(t)=>E((t)=>{const b=[...document.querySelectorAll('.jobCard .jobBtns button')].find(b=>b.innerText.includes(t));if(b)b.click();return b?b.innerText:null},t);
console.log('tap 1',await clickBtn('車窓'));console.log('tap 2',await clickBtn('もう一度'));
for(let k=0;k<40&&!(await E(()=>window.__nb3d.lineMod.line.on));k++)await W(500);
console.log('ride',JSON.stringify(await E(()=>{const L=window.__nb3d.lineMod.line,G=window.__nb3d.game;return {on:L.on,mode:L.mode,km:(L.L/1000).toFixed(1),stops:L.stops.length,first:L.stops.slice(0,4).map(s=>s.name+'@'+(s.s/1000).toFixed(1)),kyoto:L.on?(L.stops.find(s=>s.name==='京都').s/1000).toFixed(1):null,money:G.money,hud:!!document.querySelector('.lineHud')}})));
await W(4000);await p.screenshot({path:'jp/line_tokyo.png',timeout:180000});
// 10 minutes of running time, stepped: speed up to the line speed, the clock runs at real time
console.log('10 min',JSON.stringify(await E(()=>{const M=window.__nb3d.lineMod,L=M.line,G=window.__nb3d.game,h0=G.hour;let vmax=0;for(let k=0;k<12000;k++){M.stepLine(0,0,0.05);vmax=Math.max(vmax,L.v);}return {km:(L.s/1000).toFixed(1),kmh:Math.round(L.v*3.6),vmax:Math.round(vmax*3.6),dh:+(G.hour-h0).toFixed(3)}})));
const at=async(km,view,name,hr=10)=>{await E(([km,view,hr])=>{const L=window.__nb3d.lineMod.line;L.s=km*1000;L.view=view;window.__nb3d.game.hour=hr;},[km,view,hr]);await W(5500);await p.screenshot({path:'jp/line_'+name+'.png',timeout:180000});
  console.log(name,JSON.stringify(await E(()=>{const M=window.__nb3d.lineMod,L=M.line;return {km:(L.s/1000).toFixed(1),zone:M.zoneAt(L.s),tunnel:M.tunnelAt(L.s)?.name||!!M.tunnelAt(L.s),next:L.stops[M.nextStop()].name,top:document.querySelector('.lineTop')?.innerText.replace(/\n/g,' | ')}})));};
await at(118,1,'fuji');          // Fuji on the right between Mishima and Shin-Fuji
await at(141.5,1,'fujiriver');   // crossing the Fuji river
await at(100.5,0,'tanna');       // in the long tunnel under the hills
await at(255,2,'hamana');        // Lake Hamana / the sea on the left
await at(340.9,0,'nagoya');      // passing Nagoya station
await at(338,3,'outside');       // seen from outside
await E(()=>{window.__nb3d.lineMod.line.view=0});
// fast-forward buttons
await p.locator('.lineBtns button',{hasText:'次の駅'}).tap();await W(1200);console.log('ff next',JSON.stringify(await E(()=>({km:(window.__nb3d.lineMod.line.s/1000).toFixed(1),toast:window.__nb3d.game.toast}))));
const h1=await E(()=>window.__nb3d.game.hour);await p.locator('.lineBtns button',{hasText:'終点'}).tap();await W(1200);console.log('ff end',JSON.stringify(await E((h1)=>({km:(window.__nb3d.lineMod.line.s/1000).toFixed(1),dh:+(((window.__nb3d.game.hour-h1)+24)%24).toFixed(2),toast:window.__nb3d.game.toast}),h1)));
await E(()=>{const M=window.__nb3d.lineMod;for(let k=0;k<6000&&!M.line.done;k++)M.stepLine(0,0,0.05);});
await p.waitForSelector('.arriveCard',{timeout:600000});console.log('arrived',await p.locator('.arriveCard h2').innerText(),await E(()=>localStorage.getItem('neonbay3d.region')));
await p.waitForSelector('.arriveCard .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.arriveCard .mbtn.primary');await W(3000);
console.log('osaka',JSON.stringify(await E(()=>{const N=window.__nb3d,G=N.game,S=N.cityMod.STATION;return {region:N.REGION.id,atStation:Math.round(Math.hypot(G.player.x-S.spawn.x,G.player.z-S.spawn.z)),money:G.money}})));
// ---- drive: board the bullet train in Osaka, run out through the tunnel onto the line to Fukuoka ----
const P=await E(()=>{const C=window.__nb3d.cityMod,P=C.SHIN.platforms.find(q=>q.to==='fukuoka');const c=C.shinCabDoor(P);return {num:P.num,c}});
await E((c)=>{const G=window.__nb3d.game;G.player.x=c.x;G.player.z=c.z;G.player.y=window.__nb3d.cityMod.SHIN.y+0.2;G.player.vy=0;},P.c);
const nb=async(pre)=>{for(let k=0;k<80;k++){const n=await E(()=>{const n=window.__nb3d.game.near;return n?n.id:''});if(n.startsWith(pre))return n;await W(300);}return 'none';};
console.log('cab',await nb('jp:board'));await E(()=>{window.__nb3d.input.action=true});await W(3000);
// put the train just short of the trip point at speed and let it run on
console.log('to tunnel',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.playerCar(),J=N.japanMod;v.z=J.TRIP_Z+60;v.vz=-50;N.input.gas=true;return {kind:v.def.kind,z:Math.round(v.z)}})));
for(let k=0;k<60&&!(await E(()=>window.__nb3d.lineMod.line.on));k++)await W(500);
console.log('drive line',JSON.stringify(await E(()=>{const L=window.__nb3d.lineMod.line;return {on:L.on,mode:L.mode,to:L.to,km:(L.L/1000).toFixed(1),s:Math.round(L.s),v:Math.round(L.v*3.6),auto:L.auto,hold:L.hold}})));
await W(3000);await p.screenshot({path:'jp/line_drive_cab.png',timeout:180000});
// power on manually for 2 minutes (stepped through the train's own controls): ATC holds 300 km/h
console.log('drive 2 min',JSON.stringify(await E(()=>{const M=window.__nb3d.lineMod,L=M.line;L.auto=false;let vmax=0;for(let k=0;k<2400;k++){M.stepLine(1,0,0.05);vmax=Math.max(vmax,L.v);}return {km:(L.s/1000).toFixed(1),vmax:Math.round(vmax*3.6),lim:Math.round(M.limitAt(L.s)*3.6)}})));
console.log('brake',JSON.stringify(await E(()=>{const M=window.__nb3d.lineMod,L=M.line,v0=L.v;for(let k=0;k<200;k++)M.stepLine(0,1,0.05);return {from:Math.round(v0*3.6),to:Math.round(L.v*3.6)}})));
console.log('hud speed',await E(()=>document.querySelector('.lineSpd b')?.innerText));
await E(()=>{const M=window.__nb3d.lineMod;M.line.auto=true;M.fastForward(true);for(let k=0;k<9000&&!M.line.done;k++)M.stepLine(0,0,0.05);window.__nb3d.input.gas=false;});
await p.waitForSelector('.arriveCard',{timeout:600000});await p.waitForSelector('.arriveCard .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.arriveCard .mbtn.primary');await W(4000);
console.log('fukuoka',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.playerCar();return {region:N.REGION.id,inTrain:!!v&&v.def.kind==='shinkansen',kmh:v?Math.round(Math.abs(v.vz)*3.6):0,z:v?Math.round(v.z):0}})));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
