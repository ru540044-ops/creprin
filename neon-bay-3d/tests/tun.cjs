// Shinkansen terminus + tunnel trip, wayfinding, mountains. usage: node tun.cjs <html>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:800,height:450}});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(()=>{try{localStorage.setItem('nb3d.debug','1');if(!sessionStorage.getItem('init')){sessionStorage.setItem('init','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'medium',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}}catch(e){}});
await p.goto('file://'+html);
await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const shot=async(n,P,T,hr)=>{await E(([P,T,hr])=>{const G=window.__nb3d.game;if(P){G.player.x=P[0];G.player.z=P[2]+6;window.__nb3dCamOverride={p:P,t:T};}else window.__nb3dCamOverride=null;G.hour=hr;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.wet=0;G.weather.next=9999;},[P,T,hr]);await settle();await W(1500);await p.screenshot({path:'jp/tn_'+n+'.png',timeout:180000});console.log('shot',n);};
const I=await E(()=>{const C=window.__nb3d.cityMod;return {S:{x:C.SHIN.x,z0:C.SHIN.z0,z1:C.SHIN.z1,sz:C.SHIN.stationZ,gate:C.SHIN.gate,hall:C.SHIN.hall},T:C.TUN,rc:[...Array(49)].map((_,k)=>C.roadC(k)),HALF:C.HALF}});
console.log('info',JSON.stringify({S:I.S,T:{portal:I.T.portal,end:I.T.end,name:I.T.name}}));
const G0=I.S.gate,T=I.T;
// 1 wayfinding: the beam and the roof pylon from a street to the south-west, by day and at dusk
await shot('beam_day',[G0.x-330,2.5,G0.z+260],[G0.x,60,G0.z],14);
await shot('beam_dusk',[G0.x-330,2.5,G0.z+260],[G0.x,60,G0.z],18.9);
// 2 a guide sign on the approach to the junction 4 blocks west of the station (eastbound, left lane)
const gi=Math.round((G0.x+I.HALF-7)/100),gj=Math.round((G0.z+I.HALF-7)/100),nx=I.rc[gi-4],nz=I.rc[gj];
await shot('sign',[nx-48,2.0,nz-3.2],[nx-13,5.6,nz-3.2],14);
// 3 the portal from the cutting, the mountains from a rooftop height (north, Fuji-like cone west-south-west, the bay south-east)
await shot('portal',[T.x+9,24,T.portal+95],[T.x,19,T.portal],13);
await shot('mtn_n',[0,70,0],[0,90,-1000],13);
await shot('mtn_wsw',[0,70,0],[-910,110,410],13);
await shot('mtn_se',[0,70,0],[700,80,700],16.5);
await shot('mtn_night',[0,70,0],[0,90,-1000],21.5);
// 4 the minimap/phone: open the phone, the Shinkansen app
await E(([g])=>{const G=window.__nb3d.game;window.__nb3dCamOverride=null;G.player.x=g.x-600;G.player.z=g.z+400;G.player.y=0.2;},[G0]);
await settle();await p.screenshot({path:'jp/tn_minimap.png',timeout:180000});
// board 14 (Osaka) and drive
await E(()=>{const N=window.__nb3d;N.game.money=5000;N.japanMod.shinAction('jp:board:14');});await W(1500);
console.log('board',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.playerCar();return {k:v&&v.def.kind,x:v&&v.x,z:v&&Math.round(v.z),yaw:v&&v.yaw,info:N.japanMod.trainInfo,toast:N.game.toast}})));
console.log('accel',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.playerCar(),z0=v.z;for(let k=0;k<600;k++){N.drive(v,{thr:1,brake:0,steer:0,hb:false},1/30);N.japanMod.updateTrain();}return {kmh:Math.round(Math.abs(v.vz)*3.6),m:Math.round(Math.abs(v.z-z0)),x:v.x,limit:N.japanMod.trainInfo.limit,next:N.japanMod.trainInfo.next,dist:N.japanMod.trainInfo.dist}})));
// ATC: running north with the trip open there is no braking curve; check limit just before the portal
console.log('atc open',JSON.stringify(await E(([T])=>{const N=window.__nb3d,v=N.playerCar();v.z=T.portal+200;v.vz=-70;N.japanMod.updateTrain();return {lim:N.japanMod.atcLimit(v),open:true}},[T])));
// in the cutting, then the hood, then inside
await E(([T])=>{const v=window.__nb3d.playerCar();v.z=T.portal+230;v.vz=-40;},[T]);await W(800);await settle();await p.screenshot({path:'jp/tn_run_cut.png',timeout:180000});
await E(([T])=>{const v=window.__nb3d.playerCar();v.z=T.portal-80;v.vz=-40;},[T]);await W(3000);await p.screenshot({path:'jp/tn_run_tunnel.png',timeout:180000});
console.log('in tunnel',JSON.stringify(await E(()=>({tun:window.__nb3d.game.tunnel.toFixed(2),toast:window.__nb3d.game.toast,next:window.__nb3d.japanMod.trainInfo.next,dist:window.__nb3d.japanMod.trainInfo.dist}))));
// exiting inside the tunnel is refused
await E(()=>{const v=window.__nb3d.playerCar();v.vz=0;});await W(600);
console.log('exit in tunnel',JSON.stringify(await E(()=>{window.__nb3d.input.action=true;return 0})),JSON.stringify(await (async()=>{await W(1500);return E(()=>({inCar:window.__nb3d.game.inCar,toast:window.__nb3d.game.toast,near:window.__nb3d.game.near&&window.__nb3d.game.near.id}))})()));
// on through the trigger point: onto the line to Osaka (515 km, see line.cjs), fast-forwarded to the end, then Osaka loads
await E(([T])=>{const v=window.__nb3d.playerCar();v.z=T.portal-225;v.vz=-50;},[T]);
for(let k=0;k<60&&!(await E(()=>window.__nb3d.lineMod.line.on));k++)await W(500);
console.log('on the line',JSON.stringify(await E(()=>{const L=window.__nb3d.lineMod.line;return {on:L.on,mode:L.mode,to:L.to,km:(L.L/1000).toFixed(1)}})));
const nav=p.waitForNavigation({timeout:600000});
await E(()=>{const M=window.__nb3d.lineMod;M.line.auto=true;M.fastForward(true);for(let k=0;k<9000&&!M.line.done;k++)M.stepLine(0,0,0.05);});
await nav;console.log('reloaded (trip started)');
await p.waitForSelector('.arrive .mbtn.primary:not([disabled])',{timeout:1500000}).catch(async(e)=>{console.log('NO ARRIVAL BUTTON',await p.evaluate(()=>JSON.stringify({card:!!document.querySelector('.arrive'),pending:window.__nb3d&&window.__nb3d.cityStream.pending,fatal:!!document.querySelector('.fatal'),fps:window.__nb3d&&window.__nb3d.game.fps})).catch(x=>'eval failed'));throw e;});console.log('arrival screen',(await p.textContent('.arrive')).slice(0,80));
await p.click('.arrive .mbtn.primary');await W(3000);
const A=await E(()=>{const N=window.__nb3d,v=N.playerCar(),C=N.cityMod;return {region:N.REGION.id,train:v&&{k:v.def.kind,x:v.x,z:Math.round(v.z),vz:v.vz.toFixed(1)},T:{portal:C.TUN.portal},sz:C.SHIN.stationZ,info:N.japanMod.trainInfo,toast:N.game.toast,tun:N.game.tunnel.toFixed(2)}});
console.log('arrived',JSON.stringify(A));
await p.screenshot({path:'jp/tn_arrive_tunnel.png',timeout:180000});
await E(([T])=>{const v=window.__nb3d.playerCar();v.z=T.portal+150;v.vz=30;},[A.T]);await W(1000);await settle();await p.screenshot({path:'jp/tn_arrive_cut.png',timeout:180000});
// brake to a stop at 15: roll in, then stop 1 m past the mark
await E(([sz])=>{const v=window.__nb3d.playerCar();v.z=sz+90-16;v.vz=7;},[A.sz]);for(let k=0;k<20;k++){await W(300);}
await E(([sz])=>{const v=window.__nb3d.playerCar();v.z=sz+90+1;v.vz=0;},[A.sz]);await W(2500);
console.log('judge',JSON.stringify(await E(()=>({toast:window.__nb3d.game.toast,money:window.__nb3d.game.money,near:window.__nb3d.game.near&&window.__nb3d.game.near.id}))));
await E(()=>{window.__nb3d.input.action=true});await W(2000);
console.log('off',JSON.stringify(await E(()=>{const G=window.__nb3d.game;return {inCar:G.inCar,p:[Math.round(G.player.x),G.player.y.toFixed(1),Math.round(G.player.z)],toast:G.toast}})));
// Osaka: both platforms depart; the cab prompt on 15 is for Fukuoka
console.log('osaka 15',JSON.stringify(await E(()=>{const N=window.__nb3d,C=N.cityMod,P=C.SHIN.platforms[1],c=C.shinCabDoor(P);return N.japanMod.stationNear({x:c.x,y:15.2,z:c.z})})));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
