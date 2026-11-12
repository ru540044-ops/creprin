// Nara: deer park (crackers, deer coming over, bowing, eating), the great hall (walk in, pray), pagoda, Naramachi, then the
// commuter train to Osaka (ride, fast-forward, arrival in Osaka). usage: node nara.cjs <html>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message,(e.stack||'').slice(0,400))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(()=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region','nara');}}catch(e){}});
// log anything that clears storage, and page unloads (the arrival is a reload)
await p.addInitScript(()=>{const L=Storage.prototype,c=L.clear,r=L.removeItem;L.clear=function(){console.log('LSCLEAR',new Error().stack.slice(0,300));return c.call(this)};L.removeItem=function(k){if(k!=='neonbay3d.arrive')console.log('LSREMOVE',k);return r.call(this,k)};addEventListener('beforeunload',()=>console.log('UNLOAD'))});
p.on('console',m=>{const t=m.text();if(/LSCLEAR|LSREMOVE|UNLOAD/.test(t))console.log(t.slice(0,300))});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=25000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<30&&(await E(()=>window.__nb3d.input.action));k++)await W(300);await W(800);};
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const clear=(hr)=>E((hr)=>{const G=window.__nb3d.game;G.hour=hr;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.wet=0;G.weather.next=9999;},hr);
const tp=(x,z)=>E(([x,z])=>{const G=window.__nb3d.game;G.player.x=x;G.player.z=z;G.player.y=window.__nb3d.cityMod.groundAt(x,z)+0.05;G.player.vy=0;},[x,z]);
const shot=async(n,P,T,hr)=>{await E(([P,T])=>{window.__nb3dCamOverride={p:P,t:T};},[P,T]);await clear(hr);await settle();await W(1500);await p.screenshot({path:'jp/nara_'+n+'.png',timeout:180000});console.log('shot',n);};
console.log('region',await E(()=>window.__nb3d.REGION.id),'deer',await E(()=>window.__nb3d.deerMod.deer.length));
await clear(14);await E(()=>{window.__nb3d.game.money=500});
// ---- crackers: buy at the pagoda stall ----
const stall=await E(()=>{const Y=window.__nb3d.cityMod.SIG.yatai.filter(y=>y.senbei);return Y.map(y=>({x:y.x,z:y.z,a:y.a}))});console.log('stalls',JSON.stringify(stall));
{const s=stall[0];await tp(s.x+Math.sin(s.a)*2.2,s.z+Math.cos(s.a)*2.2);console.log('stall near',await waitNear('nara:senbei'));const m0=await E(()=>window.__nb3d.game.money);await act();
 console.log('bought',JSON.stringify(await E((m0)=>({senbei:window.__nb3d.game.items.senbei,paid:m0-window.__nb3d.game.money,toast:window.__nb3d.game.toast}),m0)));}
// ---- deer come over to someone holding crackers (stepped simulation), then bow and eat ----
const dz=await E(()=>{const N=window.__nb3d,D=N.deerMod.deer,G=N.game;let best=null,bd=1e9;for(const d of D){const q=Math.hypot(d.x-G.player.x,d.z-G.player.z);if(q<bd){bd=q;best=d;}}
  // stand 8 m from that deer, on free ground
  for(let a=0;a<6.3;a+=0.4){const x=best.x+Math.sin(a)*8,z=best.z+Math.cos(a)*8;if(!N.cityMod.pointBlocked(x,1,z)){G.player.x=x;G.player.z=z;G.player.y=N.cityMod.groundAt(x,z)+0.05;break;}}
  const st={};for(let k=0;k<400;k++){N.deerMod.updateDeer(0.05);for(const d of D)st[d.state]=(st[d.state]||0)+1;}
  const close=D.filter(d=>Math.hypot(d.x-G.player.x,d.z-G.player.z)<2.6).length;return {start:Math.round(bd),states:st,close,beg:D.filter(d=>d.state==='beg'||d.state==='bow').length}});
console.log('deer after 20 s holding crackers',JSON.stringify(dz));
console.log('feed near',await waitNear('nara:feed'));const s0=await E(()=>window.__nb3d.game.items.senbei);await act();
console.log('fed',JSON.stringify(await E((s0)=>{const N=window.__nb3d,G=N.game;return {used:s0-G.items.senbei,flag:N.progress.stats.flags.deer,bowing:N.deerMod.deer.filter(d=>d.state==='bow'||d.state==='eat').length,toast:G.toast}},s0)));
{const P=await E(()=>{const G=window.__nb3d.game;return [G.player.x,G.player.z]});await shot('deer',[P[0]+5,2.2,P[1]+5],[P[0],0.8,P[1]],14);}
// ---- the great hall: walk in through the gate and the doorway, pray in front of the figure ----
const L=await E(()=>{const C=window.__nb3d.cityMod;return {x:C.LANDMARK3D.x,z:C.LANDMARK3D.z,D:C.DAIBUTSU,label:C.LANDMARK3D.label}});
await E(()=>{window.__nb3dCamOverride=null});
await tp(L.x+2.5,L.z+L.D.clo+4);
const walk=async(tx,tz,ms)=>{const t=Date.now();let last=null;while(Date.now()-t<ms){last=await E(([tx,tz])=>{const N=window.__nb3d,G=N.game,P=G.player,dx=tx-P.x,dz=tz-P.z,d=Math.hypot(dx,dz);if(d<0.8){N.input.joyActive=false;N.input.joyX=N.input.joyY=0;return {done:true,p:[+(P.x-tx).toFixed(1),+(P.z).toFixed(1)]};}
   G.cam.yaw=Math.atan2(-dx,-dz);N.input.joyActive=true;N.input.joyX=0;N.input.joyY=1;return {done:false,p:[+P.x.toFixed(1),+P.z.toFixed(1)]};},[tx,tz]);if(last.done)break;await W(200);}
  await E(()=>{const N=window.__nb3d;N.input.joyActive=false;N.input.joyX=N.input.joyY=0;});return last;};
console.log('walk to doorway',JSON.stringify(await walk(L.x+2.5,L.z+L.D.hz1+3,300000)));
console.log('walk inside',JSON.stringify(await walk(L.x+0.5,L.z+L.D.bz+9,300000)));
console.log('pray near',await waitNear('jp:omikuji'));await act();console.log('pray',await E(()=>window.__nb3d.game.toast));
await shot('hall_front',[L.x+30,14,L.z+L.D.clo+50],[L.x,14,L.z-5],10);
await shot('hall_inside',[L.x+3,2.2,L.z+L.D.hz1-3],[L.x,11,L.z+L.D.bz],10);
await shot('hall_night',[L.x-40,18,L.z+L.D.clo+40],[L.x,12,L.z-5],20.5);
const pg=await E(()=>window.__nb3d.cityMod.SIG.pagoda);await shot('pagoda',[pg.x+40,10,pg.z+55],[pg.x,22,pg.z],16);
const mc=await E(()=>{const C=window.__nb3d.cityMod;const k=[...C.MACHIYA_BLOCKS][3],N=C.N,b=C.blocks[k];return {x:b.x0,z:(b.z0+b.z1)/2}});await shot('naramachi',[mc.x-6,2.4,mc.z-30],[mc.x-6,2.6,mc.z+30],17);
await shot('aerial',[L.x-250,180,L.z+420],[L.x-60,0,L.z+200],15);
await E(()=>{window.__nb3dCamOverride=null});
// ---- the commuter train to Osaka, boarded at the station ----
const st=await E(()=>{const S=window.__nb3d.cityMod.STATION;return {x:S.x,z:S.z}});await tp(st.x-2,st.z);console.log('station front',await waitNear('jp:narast'));
const NS=await E(()=>JSON.parse(JSON.stringify(window.__nb3d.cityMod.NARA_ST)));
await shot('station',[st.x-60,14,st.z+55],[st.x+10,6,st.z],15);await shot('platform',[NS.px0+1.5,2.2,NS.gateZ-1],[NS.tx,1.6,NS.z0+10],15);await E(()=>{window.__nb3dCamOverride=null});
// walk in from the forecourt: up onto the platform, through a ticket gate, along to the train door
const gx=NS.px0+0.6+0.65;await tp(gx,NS.z1+3);
console.log('to gates',JSON.stringify(await walk(gx,NS.gateZ+1.5,300000)));console.log('through gate',JSON.stringify(await walk(gx,NS.gateZ-3,300000)));
console.log('to door',JSON.stringify(await walk(NS.door.x,NS.door.z,300000)),'y',await E(()=>window.__nb3d.game.player.y.toFixed(2)));
console.log('station near',await waitNear('jp:yamato'));await act();
console.log('line',JSON.stringify(await E(()=>{const L=window.__nb3d.lineMod.line;return {on:L.on,mode:L.mode,to:L.to,L:Math.round(L.L),stops:L.stops.map(s=>s.name+'@'+(s.s/1000).toFixed(1))}})));
await W(4000);await p.screenshot({path:'jp/nara_ride_cab.png',timeout:180000});
// step the ride: 3 minutes of running time
console.log('after 3 min',JSON.stringify(await E(()=>{const M=window.__nb3d.lineMod,L=M.line,h0=window.__nb3d.game.hour;for(let k=0;k<3600;k++)M.stepLine(0,0,0.05);return {km:(L.s/1000).toFixed(2),kmh:Math.round(L.v*3.6),lim:Math.round(M.limitAt(L.s)*3.6),dh:+(window.__nb3d.game.hour-h0).toFixed(3),tunnel:!!M.tunnelAt(L.s)}})));
await W(3000);for(const v of [1,3]){await E((v)=>{window.__nb3d.lineMod.line.view=v},v);await W(3500);await p.screenshot({path:'jp/nara_ride_view'+v+'.png',timeout:180000});}
await E(()=>{window.__nb3d.lineMod.line.view=0});
// tunnel under Mt Ikoma
await E(()=>{const L=window.__nb3d.lineMod.line;L.s=16500;});await W(5000);await p.screenshot({path:'jp/nara_ride_tunnel.png',timeout:180000});console.log('tunnel',await E(()=>window.__nb3d.lineMod.line.tunnel.toFixed(2)));
await p.locator('.lineBtns button',{hasText:'次の駅'}).tap();await W(1500);console.log('ff next',JSON.stringify(await E(()=>({km:(window.__nb3d.lineMod.line.s/1000).toFixed(2),toast:window.__nb3d.game.toast}))));
await p.locator('.lineBtns button',{hasText:'終点'}).tap();await W(1500);console.log('ff end',JSON.stringify(await E(()=>({km:(window.__nb3d.lineMod.line.s/1000).toFixed(2),toast:window.__nb3d.game.toast}))));
// run in to the end: the trip finishes and Osaka loads
await E(()=>{const M=window.__nb3d.lineMod;for(let k=0;k<4000&&M.line.on&&!M.line.done;k++)M.stepLine(0,0,0.05);});
console.log('done',await E(()=>window.__nb3d.lineMod.line.done));
await p.waitForSelector('.arriveCard',{timeout:900000}).catch(async(e)=>{console.log('NO ARRIVAL CARD',await p.evaluate(()=>JSON.stringify({url:location.href,keys:Object.keys(localStorage),region:localStorage.getItem('neonbay3d.region'),title:!!document.querySelector('.ttl'),hud:!!document.querySelector('.hud,.chip'),fatal:!!document.querySelector('.fatal'),started:window.__nb3d&&window.__nb3d.game.started})).catch(x=>'eval failed: '+x.message));throw e;});console.log('arrival card',await p.locator('.arriveCard h2').innerText());
console.log('region now',await E(()=>localStorage.getItem('neonbay3d.region')));
await p.waitForSelector('.arriveCard .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.arriveCard .mbtn.primary');await W(3000);
console.log('in osaka',JSON.stringify(await E(()=>{const N=window.__nb3d,G=N.game,S=N.cityMod.STATION;return {region:N.REGION.id,d:Math.round(Math.hypot(G.player.x-S.spawn.x,G.player.z-S.spawn.z))}})));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
