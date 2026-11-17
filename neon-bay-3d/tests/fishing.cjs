// Fishing. usage: node fishing.cjs <html> [region]
// The state machine is stepped directly (fixed dt); the balance is measured by simulating many fights with different
// players: one who holds when the fish rests and lets go when it runs (should usually win), one who never lets go
// (the line should usually snap), one who never reels (the fish should get away).
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const ok=(name,v,extra='')=>console.log((v?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));
const until=async(f,ms=40000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await W(400);}return false;};
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.money=500;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;window.__pin=setInterval(()=>{window.__nb3d.game.hour=window.__hr||13},1000);window.__hr=13;});
// a spot on the shore: dry sand with water within casting range (found by looking)
const spot=await E(()=>{const N=window.__nb3d,C=N.cityMod,F=N.fishingMod;
  const cands=[];for(let z=-300;z<=300;z+=40)for(let x=-3000;x<3000;x+=6){}
  // search the beach strip and the whole map in coarse steps for dry land with water 3-6 m away
  const tryAt=(x,z)=>{const G=N.game;G.player.x=x;G.player.z=z;G.player.y=N.groundAt(x,z)+0.05;G.where='out';return F.waterNear()};
  const R=N.REGION.id;let found=null;
  const xs=R==='tokyo'?[C.BEACH_X+14,C.BEACH_X+16,C.BEACH_X+18,C.BEACH_X+20]:[];
  for(const x of xs)for(let z=-400;z<=400&&!found;z+=20){const w=tryAt(x,z);if(w&&!C.isWater(x,z))found={x,z,w};}
  if(!found){ // anywhere: scan the land for a point with water close by
    for(let z=-2400;z<=2400&&!found;z+=24)for(let x=-2600;x<=2800&&!found;x+=24){if(C.isWater(x,z))continue;const w=tryAt(x,z);if(w&&Math.hypot(w.x-x,w.z-z)<5)found={x,z,w};}}
  return found});
console.log('spot',JSON.stringify(spot&&{x:Math.round(spot.x),z:Math.round(spot.z),water:[Math.round(spot.w.x),Math.round(spot.w.z)]}));
ok('spot: water within casting range of dry land is found',!!spot);
await E((s)=>{const N=window.__nb3d,G=N.game;G.player.x=s.x;G.player.z=s.z;G.player.y=N.groundAt(s.x,s.z)+0.05;G.player.speed=0;G.inCar=0;G.where='out';window.__spot=s;
  window.__step=(n,dt=0.05)=>{for(let i=0;i<n;i++)N.fishingMod.updateFishing(dt)};},spot);
// ---- the prompt and the cast ----
await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id==='fish:start'}),30000);
const near=await E(()=>window.__nb3d.game.near);ok('prompt: "fish" is offered at the water\'s edge',near&&near.id==='fish:start',JSON.stringify(near));
await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>window.__nb3d.fishingMod.fish.on),15000);
let f=await E(()=>{const F=window.__nb3d.fishingMod.fish,P=window.__nb3d.game.player;return {on:F.on,phase:F.phase,noMove:window.__nb3d.input.noMove,bobWater:window.__nb3d.cityMod.isWater(F.bx,F.bz),d:Math.hypot(F.bx-P.x,F.bz-P.z)}});
ok('cast: pressing the action button casts the line onto the water',f.on&&f.phase==='cast'&&f.bobWater&&f.d>1.5,JSON.stringify(f));
ok('cast: the player stands still while fishing',await E(()=>window.__nb3d.input.noMove));
await E(()=>window.__step(30));f=await E(()=>({phase:window.__nb3d.fishingMod.fish.phase}));ok('cast: then the float waits',f.phase==='wait');
const nearW=await E(()=>window.__nb3d.fishingMod.fishNear());ok('wait: the action button now says stop',nearW&&nearW.id==='fish:stop',JSON.stringify(nearW));
// ---- a bite, too slow, then a bite hooked ----
await E(()=>{const F=window.__nb3d.fishingMod.fish;F.runT=0.05;window.__step(4)});f=await E(()=>({phase:window.__nb3d.fishingMod.fish.phase,k:window.__nb3d.fishingMod.fish.kind&&window.__nb3d.fishingMod.fish.kind.name}));
ok('bite: after a while the float dips and a fish is on',f.phase==='bite'&&!!f.k,JSON.stringify(f));
const nearB=await E(()=>window.__nb3d.fishingMod.fishNear());ok('bite: the action button says pull',nearB&&nearB.id==='fish:hook',JSON.stringify(nearB));
await E(()=>window.__step(40));f=await E(()=>({phase:window.__nb3d.fishingMod.fish.phase,lost:window.__nb3d.fishingMod.fish.lostN}));ok('bite: too slow and it gets away, back to waiting',f.phase==='wait'&&f.lost>=1,JSON.stringify(f));
await E(()=>{const F=window.__nb3d.fishingMod.fish;F.runT=0.05;window.__step(4);window.__nb3d.fishingMod.fishAction('fish:hook')});f=await E(()=>({phase:window.__nb3d.fishingMod.fish.phase,dist:window.__nb3d.fishingMod.fish.dist,t:window.__nb3d.fishingMod.fish.tension}));
ok('hook: pulling in time starts the fight',f.phase==='reel'&&f.dist>5&&f.t>0.2&&f.t<0.6,JSON.stringify(f));
// ---- a camera shot of the fight ----
await E(()=>{const F=window.__nb3d.fishingMod.fish;F.dist=F.dist0*0.55;F.tension=0.6;const s=window.__spot,P=window.__nb3d.game.player;window.__nb3dCamOverride={p:[s.x-3*Math.sin(P.yaw)+1.2*Math.cos(P.yaw),2.4,s.z-3*Math.cos(P.yaw)-1.2*Math.sin(P.yaw)],t:[(F.bx+s.x)/2,0.3,(F.bz+s.z)/2]}});await settle();await W(2500);await p.screenshot({path:'jp/fish_fight.png',timeout:180000});await E(()=>{window.__nb3dCamOverride=null});
// ---- the three kinds of player, many fights each (the physics only: dt 0.05) ----
const sim=await E(()=>{const N=window.__nb3d,F=N.fishingMod,fish=F.fish,I=N.input;
  const out={};
  const play=(policy,n)=>{let won=0,snapped=0,escaped=0,timeT=0;
    for(let i=0;i<n;i++){
      // a fresh fight against a random fish of this city
      F.fishAction('fish:stop');fish.on=false;fish.phase='';N.game.where='out';N.game.player.x=window.__spot.x;N.game.player.z=window.__spot.z;N.game.player.y=N.groundAt(window.__spot.x,window.__spot.z)+0.05;
      F.fishAction('fish:start');window.__step(25);fish.runT=0;window.__step(2);if(fish.phase!=='bite'){continue;}F.fishAction('fish:hook');
      let t=0;const start=fish.phase;
      while(fish.phase==='reel'&&t<90){ // one hand on the button
        I.reel=policy(fish);window.__step(1);t+=0.05;
        if(N.eventsMod.ev.choice){break}
      }
      timeT+=t;
      if(fish.phase==='caught'){won++;N.eventsMod.ev.choice.options[2].pick();}
      else if(fish.phase==='lost'){ if(fish.msg===''){} const m=N.game.toast||'';if(/切れ/.test(m))snapped++;else escaped++; }
      else if(t>=90)escaped++;
      I.reel=false;window.__step(10);
    }
    return {n,won,snapped,escaped,avgS:+(timeT/n).toFixed(1)};};
  // careful: hold while the fish rests, let go the moment it runs or the line is nearly tight; a little slow to react (0.25 s)
  let lag=0,lastRun=false;
  const careful=(f)=>{if(f.run!==lastRun){lag=0.25;lastRun=f.run}lag=Math.max(0,lag-0.05);const runNow=lag>0?!f.run:f.run; return !runNow&&f.tension<0.78};
  out.careful=play(careful,60);out.mash=play(()=>true,60);out.idle=play(()=>false,40);
  return out});
console.log('balance',JSON.stringify(sim));
const rate=(o)=>o.won/o.n;
ok('balance: a careful player wins nearly every fight',rate(sim.careful)>=0.85,'won '+sim.careful.won+'/'+sim.careful.n+' (snapped '+sim.careful.snapped+', got away '+sim.careful.escaped+') avg '+sim.careful.avgS+' s');
ok('balance: holding the button down snaps the line far more often than it wins',sim.mash.snapped>sim.mash.won*2&&rate(sim.mash)<=0.35,'won '+sim.mash.won+'/'+sim.mash.n+' snapped '+sim.mash.snapped);
ok('balance: never reeling loses the fish every time',sim.idle.won===0&&sim.idle.escaped>=sim.idle.n-2,'won '+sim.idle.won+' got away '+sim.idle.escaped+'/'+sim.idle.n);
ok('balance: a fight takes a sensible time (5-25 s of play)',sim.careful.avgS>=5&&sim.careful.avgS<=25,'avg '+sim.careful.avgS+' s');
// ---- landing a fish: the choice, selling, eating, releasing ----
async function land(){ // wins one fight, leaves the choice on screen
  return E(()=>{const N=window.__nb3d,F=N.fishingMod,fish=F.fish;fish.on=false;fish.phase='';N.eventsMod.ev.choice=null;F.fishAction('fish:start');window.__step(25);fish.runT=0;window.__step(2);F.fishAction('fish:hook');fish.dist=0.4;fish.tension=0.3;N.input.reel=true;window.__step(3);N.input.reel=false;
    const c=N.eventsMod.ev.choice;return c&&{title:c.title,n:c.options.length,labels:c.options.map(o=>o.label),phase:fish.phase,name:fish.kind&&fish.kind.name}});}
let c=await land();ok('landing: a catch opens the choice (sell / grill / release)',c&&c.n===3&&c.phase==='caught'&&c.title.includes('釣れた'),JSON.stringify(c));
await W(800);const dom=await E(()=>({box:!!document.querySelector('.choiceBox'),btns:document.querySelectorAll('.choiceBox button').length}));ok('landing: it is shown as a panel',dom.box&&dom.btns===3,JSON.stringify(dom));
const m0=await E(()=>window.__nb3d.game.money),val=await E(()=>window.__nb3d.fishingMod.fish.kind.value);
await E(()=>{document.querySelectorAll('.choiceBox button')[0].click()});await W(600);const m1=await E(()=>({m:window.__nb3d.game.money,fl:window.__nb3d.progress.stats.flags.fish}));
ok('sell: the money arrives',m1.m===m0+val&&m1.fl>=1,'money '+m0+' -> '+m1.m+' (+'+val+'), fish caught '+m1.fl);
await E(()=>window.__step(40));ok('sell: the line is put away afterwards',await E(()=>!window.__nb3d.fishingMod.fish.on&&!window.__nb3d.input.noMove));
// eat it
c=await land();await until(async()=>E(()=>document.querySelectorAll('.choiceBox button').length===3),20000);await E(()=>{window.__nb3d.game.health=40});await E(()=>{document.querySelectorAll('.choiceBox button')[1].click()});await W(800);
const ate=await E(()=>({h:window.__nb3d.game.health,eat:document.querySelector('.eatCard')?document.querySelector('.eatName').innerText:'',on:window.__nb3d.eatFx?window.__nb3d.eatFx.on:null}));
ok('grill: health goes up and the eating scene shows the grilled fish',Math.abs(ate.h-65)<2&&/焼き/.test(ate.eat),JSON.stringify(ate));
await W(6000);
// release a rare one: reputation
await E(()=>{window.__nb3d.progress.stats.flags.rep=0});c=await land();await E(()=>{const N=window.__nb3d,F=N.fishingMod;if(N.eventsMod.ev.choice){/* make it a rare fish */}});
const rare=await E(()=>{const N=window.__nb3d,F=N.fishingMod;const T=F.fishTable();const r=T.find(x=>x.rare);const fish=F.fish;fish.kind=r;N.eventsMod.ev.choice=null;N.progress.stats.flags.rep=0;
  // land that kind: rebuild the choice by finishing a fight with it
  fish.on=true;fish.phase='reel';fish.dist=0.4;fish.dist0=10;fish.tension=0.3;fish.len=60;N.input.reel=true;window.__step(3);N.input.reel=false;const c=N.eventsMod.ev.choice;c.options[2].pick();return {rare:r.name,rep:N.progress.stats.flags.rep||0}});
ok('release: letting a rare fish go is rewarded with reputation',rare.rep===1,JSON.stringify(rare));
// ---- walking away, a scene, a car ----
await E(()=>{const N=window.__nb3d,F=N.fishingMod,fish=F.fish;fish.on=false;N.eventsMod.ev.choice=null;F.fishAction('fish:start');window.__step(25);N.game.player.x+=6});await E(()=>window.__step(2));
ok('leave: walking away reels the line in',await E(()=>!window.__nb3d.fishingMod.fish.on));
await E(()=>{const N=window.__nb3d,s=window.__spot;N.game.player.x=s.x;N.game.player.z=s.z;N.fishingMod.fishAction('fish:start');window.__step(5);N.cine.lock=true;window.__step(1);N.cine.lock=false});
ok('leave: a cinematic scene ends it too',await E(()=>!window.__nb3d.fishingMod.fish.on&&!window.__nb3d.input.noMove));
// ---- the catch table of this city ----
const T=await E(()=>window.__nb3d.fishingMod.fishTable().map(f=>f.name+':$'+f.value));console.log('catch in',region,T.join(' '));
ok('table: five kinds, with a rare big one',T.length===5);
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
