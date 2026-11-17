// Street events: purse snatcher (knock down -> choice), lost wallet (pick up -> police box / keep), lost tourist (directions),
// reputation, shop discount, save/load of the reputation. usage: node events.cjs <html> [region]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=30000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<30&&(await E(()=>window.__nb3d.input.action));k++)await W(300);await W(600);};
const choice=()=>E(()=>{const c=document.querySelector('.choiceBox');return c?c.innerText.replace(/\n/g,' | '):null});
const waitChoice=async()=>{for(let k=0;k<60;k++){const c=await choice();if(c)return c;await W(300);}return 'NO CHOICE';};
const pick=(t)=>E((t)=>{const b=[...document.querySelectorAll('.choiceOpts button')].find(b=>b.innerText.includes(t));if(b)b.click();return !!b},t);
const S=()=>E(()=>{const N=window.__nb3d,G=N.game,e=N.eventsMod;return {money:G.money,rep:e.rep(),name:e.repName(),kind:e.ev.kind,stage:e.ev.stage,wanted:G.wanted,toast:G.toast,wp:G.waypoint&&[Math.round(G.waypoint.x),Math.round(G.waypoint.z)]}});
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.weather.kind='clear';G.weather.rain=0;G.weather.next=9999;G.money=1000;});
// stand on a pavement in a shopping street
await E(()=>{const N=window.__nb3d,C=N.cityMod,G=N.game;let best=null,bd=1e9;for(const k of C.blocks){if(k.zone!=='commercial')continue;const d=Math.hypot((k.x0+k.x1)/2,(k.z0+k.z1)/2);if(d<bd){bd=d;best=k;}}G.player.x=(best.x0+best.x1)/2;G.player.z=best.z0+3;G.player.y=0.3;});await W(1500);
// ---- 1. purse snatcher: starts, runs from you; knock him down; give the bag back ----
console.log('snatch start',await E(()=>window.__nb3d.eventsMod.forceEvent('snatch')),JSON.stringify(await S()));
console.log('thief runs',JSON.stringify(await E(()=>{const N=window.__nb3d,e=N.eventsMod.ev,th=e.ped,G=N.game,d0=Math.hypot(th.x-G.player.x,th.z-G.player.z);for(let k=0;k<60;k++){N.pedsMod.updatePeds(0.05);N.eventsMod.updateEvents(0.05);}return {state:th.state,d0:+d0.toFixed(1),d1:+Math.hypot(th.x-G.player.x,th.z-G.player.z).toFixed(1),mark:e.mark&&e.mark.icon}})));
await W(2500);await p.screenshot({path:'jp/ev_'+region+'_snatch.png',timeout:180000});
await E(()=>{const N=window.__nb3d,th=N.eventsMod.ev.ped;N.pedsMod.hitPed(th,30,2,2,true);});
console.log('choice',await waitChoice());await p.screenshot({path:'jp/ev_'+region+'_choice.png',timeout:180000});
console.log('pick give back',await pick('返す'));await W(800);console.log(' ->',JSON.stringify(await S()));
// again: keep the money
await E(()=>{window.__nb3d.game.wanted=0;window.__nb3d.eventsMod.forceEvent('snatch');const N=window.__nb3d;N.pedsMod.hitPed(N.eventsMod.ev.ped,30,2,2,true);});await waitChoice();console.log('pick keep',await pick('いただく'));await W(800);console.log(' ->',JSON.stringify(await S()));
// escape: he gets away when the time runs out
await E(()=>{const N=window.__nb3d;N.game.wanted=0;N.eventsMod.forceEvent('snatch');N.eventsMod.ev.t=0.1;});await W(1500);console.log('escape',JSON.stringify(await S()));
// ---- 2. lost wallet: pick up -> take to the police box ----
await E(()=>{window.__nb3d.game.wanted=0});console.log('wallet start',await E(()=>window.__nb3d.eventsMod.forceEvent('wallet')));
await E(()=>{const N=window.__nb3d,e=N.eventsMod.ev,G=N.game;G.player.x=e.x+0.6;G.player.z=e.z;G.player.y=N.cityMod.groundAt(e.x,e.z)+0.05;});
console.log('wallet near',await waitNear('ev:wallet'));await act();console.log('choice',await waitChoice());console.log('pick koban',await pick('交番'));await W(600);console.log(' ->',JSON.stringify(await S()));
await E(()=>{const N=window.__nb3d,G=N.game,k=N.cityMod.SIG.koban.slice().sort((a,c)=>Math.hypot(a.x-G.player.x,a.z-G.player.z)-Math.hypot(c.x-G.player.x,c.z-G.player.z))[0];G.player.x=k.x;G.player.z=k.z-2.6;G.player.y=N.cityMod.groundAt(k.x,k.z-2.6)+0.05;});
console.log('koban near',await waitNear('ev:koban'));await act();console.log(' ->',JSON.stringify(await S()));
// wallet: keep it
await E(()=>{const N=window.__nb3d,G=N.game;const C=N.cityMod;let best=null,bd=1e9;for(const k of C.blocks){if(k.zone!=='commercial')continue;const d=Math.hypot((k.x0+k.x1)/2,(k.z0+k.z1)/2);if(d<bd){bd=d;best=k;}}G.player.x=(best.x0+best.x1)/2;G.player.z=best.z0+3;G.player.y=0.3;});await W(800);
console.log('wallet 2',await E(()=>window.__nb3d.eventsMod.forceEvent('wallet')));await E(()=>{const N=window.__nb3d,e=N.eventsMod.ev,G=N.game;G.player.x=e.x+0.6;G.player.z=e.z;});await waitNear('ev:wallet');await act();await waitChoice();console.log('pick keep',await pick('自分'));await W(600);console.log(' ->',JSON.stringify(await S()));
// ---- 3. lost tourist: the right direction, then a wrong one ----
for(const right of [true,false]){
  console.log('tourist start',await E(()=>window.__nb3d.eventsMod.forceEvent('tourist')));
  const T=await E(()=>{const N=window.__nb3d,e=N.eventsMod.ev,G=N.game;G.player.x=e.ped.x+1.6;G.player.z=e.ped.z;return {target:e.target,dir:e.dir}});
  console.log('tourist near',await waitNear('ev:tourist'),JSON.stringify(T));await act();console.log('choice',await waitChoice());
  const names=['北','東','南','西'];console.log('pick',right?'right':'wrong',await pick(names[right?T.dir:(T.dir+2)%4]+'のほう'));await W(600);console.log(' ->',JSON.stringify(await S()));}
// ---- reputation: discount at 5+, and it survives a save / load ----
console.log('discount',JSON.stringify(await E(()=>{const N=window.__nb3d,e=N.eventsMod;N.progress.stats.flags.rep=6;const d=e.discount(),pr=N.shopsMod.priceOf({price:10});N.progress.stats.flags.rep=-4;return {at6:d,price10:pr,atMinus4:e.discount(),name:e.repName()}})));
await E(()=>{window.__nb3d.progress.stats.flags.rep=7;window.__nb3d.game.where='out';});await E(()=>window.__nb3d.saveNow?window.__nb3d.saveNow():null);
console.log('saved rep',await E(()=>{const N=window.__nb3d;N.game.started=true;const s=JSON.parse(localStorage.getItem('neonbay3d.save.v1')||'{}');return s.stats&&s.stats.flags&&s.stats.flags.rep}));
// an event starts by itself when its time comes (stepped clock)
console.log('auto',JSON.stringify(await E(()=>{const N=window.__nb3d,e=N.eventsMod,G=N.game;G.wanted=0;if(e.ev.kind)e.forceEvent('');e.ev.kind='';e.ev.choice=null;e.ev.next=G.clock+0.2;const C=N.cityMod;let best=null,bd=1e9;for(const k of C.blocks){if(k.zone!=='commercial')continue;const d=Math.hypot((k.x0+k.x1)/2,(k.z0+k.z1)/2);if(d<bd){bd=d;best=k;}}G.player.x=(best.x0+best.x1)/2;G.player.z=best.z0+3;let started='';for(let k=0;k<400&&!started;k++){G.clock+=0.05;e.updateEvents(0.05);started=e.ev.kind;}return {started}})));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
