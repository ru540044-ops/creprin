// Screenshots in Nara: deer close up, the great hall front with the incense burner, the south gate, a Naramachi street.
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message)});
await p.addInitScript(()=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region','nara');}}catch(e){}});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const shot=async(n,P,T,h)=>{await E(([P,T,h])=>{const G=window.__nb3d.game;G.hour=h;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;G.player.x=P[0];G.player.z=P[2]+4;window.__nb3dCamOverride={p:P,t:T};},[P,T,h]);await settle();await W(2000);await p.screenshot({path:'jp/naralook_'+n+'.png',timeout:180000});console.log('shot',n);};
const d=await E(()=>{const D=window.__nb3d.deerMod.deer;const q=D.find(x=>x.buck)||D[0];return {x:q.x,y:q.y,z:q.z}});
await shot('deer',[d.x+3.2,1.4,d.z+2.4],[d.x,0.9,d.z],14);
const L=await E(()=>{const C=window.__nb3d.cityMod;return {x:C.LANDMARK3D.x,z:C.LANDMARK3D.z,D:C.DAIBUTSU,g:C.SIG.southGate}});
await shot('hall',[L.x+16,5,L.z+L.D.lantZ+22],[L.x,8,L.z],15);
await shot('gate',[L.g.x+18,4,L.g.z+34],[L.g.x,8,L.g.z],15);
const mc=await E(()=>{const C=window.__nb3d.cityMod;const B=C.buildings.filter(b=>b.style==='machiya');const b=B[Math.floor(B.length/2)];return {x:(b.x0+b.x1)/2,z0:b.z0,z1:b.z1}});
await shot('machi',[mc.x-8,1.8,mc.z0-6],[mc.x+6,1.9,mc.z0],16);
console.log('errors',JSON.stringify(errs));await b.close();})();
