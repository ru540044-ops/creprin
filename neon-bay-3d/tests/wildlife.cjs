// City wildlife: pigeons, crows, gulls, cats. usage: node wildlife.cjs <html> [region]
// The simulation is stepped directly (the browser runs at 1-2 fps here); screenshots show a flock on the ground, in the air, a cat and a gull.
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const ok=(name,v,extra='')=>console.log((v?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;window.__pin=setInterval(()=>{window.__nb3d.game.hour=window.__hr||13},1000);window.__hr=13;});
// ---- the population ----
const pop=await E(()=>{const w=window.__nb3d.wildlifeMod;const n=w.buildWildlife();const k={};for(const c of w.critters)k[c.kind]=(k[c.kind]||0)+1;let bad=0;for(const c of w.critters)if(![c.x,c.y,c.z,c.yaw,c.s].every(Number.isFinite))bad++;return {n,k,bad}});
console.log('population',JSON.stringify(pop));
ok('population: pigeons, crows, gulls and cats exist, all numbers finite',pop.k.pigeon>10&&pop.k.crow>3&&pop.k.gull>5&&pop.k.cat>3&&pop.bad===0);
// helpers run inside the page
await E(()=>{const N=window.__nb3d,w=N.wildlifeMod;
  window.__step=(n,dt=0.05)=>{for(let i=0;i<n;i++)w.updateWildlife(dt)};
  window.__put=(x,z)=>{const G=N.game;G.inCar=0;G.where='out';G.player.x=x;G.player.z=z;G.player.y=N.groundAt(x,z)+0.1;G.player.speed=0};
  window.__flock=(kind)=>{ // the critter of that kind with the most neighbours
    let best=null,bn=-1;for(const c of w.critters){if(c.kind!==kind)continue;const n=w.critters.filter(o=>o.kind===kind&&Math.hypot(o.x-c.x,o.z-c.z)<6).length;if(n>bn){bn=n;best=c}}return best};
});
const flockOf=async(kind)=>E((kind)=>{const c=window.__flock(kind);const ids=window.__nb3d.wildlifeMod.critters.filter(o=>o.kind===kind&&Math.hypot(o.x-c.x,o.z-c.z)<6).map(o=>o.id);return {id:c.id,x:c.x,z:c.z,ids}},kind);
const states=(ids)=>E((ids)=>ids.map(i=>{const c=window.__nb3d.wildlifeMod.critters[i];return c.state}),ids);
const cstate=(id)=>E((id)=>{const c=window.__nb3d.wildlifeMod.critters[id];return {state:c.state,y:+(c.y-window.__nb3d.groundAt(c.x,c.z)).toFixed(2),x:c.x,z:c.z,hx:c.hx,hz:c.hz,vy:c.vy}},id);

// ---- pigeons: calm while the player is far, scatter when someone walks up, circle, come back down ----
const F=await flockOf('pigeon');console.log('flock',JSON.stringify({n:F.ids.length,x:Math.round(F.x),z:Math.round(F.z)}));
await E((F)=>{window.__put(F.x+40,F.z);window.__step(60)},F);
let st=await states(F.ids);ok('pigeons: calm while the player is 40 m away',st.every(s=>s!=='fly'),st.join(','));
await E((F)=>{window.__put(F.x+2.2,F.z);window.__step(8)},F);
st=await states(F.ids);const flying=st.filter(s=>s==='fly').length;
ok('pigeons: the ones close by take off when the player walks up',flying>=Math.max(1,Math.floor(F.ids.length*0.6)),flying+'/'+F.ids.length+' '+st.join(','));
await E(()=>window.__step(50));
let hs=await E((ids)=>ids.map(i=>{const c=window.__nb3d.wildlifeMod.critters[i];return +(c.y-window.__nb3d.groundAt(c.x,c.z)).toFixed(1)}),F.ids);
ok('pigeons: they climb to flying height',Math.max(...hs)>3,'heights '+hs.join(','));
// a picture of the flock in the air
await E((F)=>{window.__nb3dCamOverride={p:[F.x+6,2.2,F.z+6],t:[F.x,5,F.z]};window.__put(F.x+60,F.z)},F);await settle();await W(2500);await p.screenshot({path:'jp/wl_flight.png',timeout:180000});
// ...and they come down again, near where they were, when the player has gone
await E((F)=>{window.__put(F.x+60,F.z);window.__step(900)},F);
st=await states(F.ids);const back=await E((ids)=>ids.map(i=>{const c=window.__nb3d.wildlifeMod.critters[i];return +Math.hypot(c.x-c.hx,c.z-c.hz).toFixed(1)}),F.ids);
ok('pigeons: back on the ground after a while',st.every(s=>s!=='fly'&&s!=='land'),st.join(','));
ok('pigeons: ...near where they were',Math.max(...back)<9,'distances '+back.join(','));
ok('pigeons: scatter / land counters moved',await E(()=>window.__nb3d.wildlifeMod.stats.scattered>=3&&window.__nb3d.wildlifeMod.stats.landed>=3),JSON.stringify(await E(()=>window.__nb3d.wildlifeMod.stats)));
// a picture of the flock on the ground
await E((F)=>{window.__nb3dCamOverride={p:[F.x-3.2,1.3,F.z+3.2],t:[F.x,0.2,F.z]}},F);await settle();await W(2500);await p.screenshot({path:'jp/wl_ground.png',timeout:180000});
await E(()=>{window.__nb3dCamOverride=null});

// ---- a car coming past fast ----
const F2=await flockOf('pigeon');
await E((F2)=>{const N=window.__nb3d;window.__put(F2.x+50,F2.z);window.__step(40);const v=N.spawn('sedan',F2.x+5,F2.z-3,0);v.touched=true;v.vx=0;v.vz=14;window.__car=v.id;window.__step(8)},F2);
st=await states(F2.ids);ok('pigeons: a fast car going by scatters them',st.filter(s=>s==='fly').length>=1,st.join(','));
await E(()=>{const N=window.__nb3d,v=N.vehicles.find(q=>q.id===window.__car);if(v)N.remove(v)});

// ---- a loud noise ----
const F3=await flockOf('crow');
await E((F)=>{window.__put(F.x+50,F.z);window.__step(40)},F3);await E((F)=>{window.__nb3d.wildlifeMod.startle(F.x,F.z,15)},F3);
st=await states(F3.ids);ok('crows: startle() (a shot, a blast) sends them up',st.every(s=>s==='fly'),st.join(','));

// ---- cats ----
const cat=await E(()=>{const w=window.__nb3d.wildlifeMod;const c=w.critters.find(c=>c.kind==='cat');return {id:c.id,x:c.x,z:c.z}});
await E((c)=>{window.__put(c.x+30,c.z);window.__step(30)},cat);let cs=await cstate(cat.id);ok('cats: calm while the player is far',cs.state==='sit'||cs.state==='walk',cs.state);
await E((c)=>{window.__put(c.x+2,c.z);window.__step(8)},cat);cs=await cstate(cat.id);ok('cats: bolt when someone walks up',cs.state==='flee',cs.state);
const c0=cs;await E(()=>window.__step(40));cs=await cstate(cat.id);ok('cats: they run away',Math.hypot(cs.x-c0.x,cs.z-c0.z)>3,'ran '+Math.hypot(cs.x-c0.x,cs.z-c0.z).toFixed(1)+' m');
await E((c)=>{window.__put(c.x+40,c.z);window.__step(500)},cat);cs=await cstate(cat.id);ok('cats: settle down again and sit',cs.state==='sit'||cs.state==='walk',cs.state);
await E((c)=>{window.__put(c.x+30,c.z)},cat);
await E((cs)=>{window.__nb3dCamOverride={p:[cs.x-1.3,0.55,cs.z+1.3],t:[cs.x,0.25,cs.z]}},cs);await settle();await W(2500);await p.screenshot({path:'jp/wl_cat.png',timeout:180000});await E(()=>{window.__nb3dCamOverride=null});

// ---- night: the birds roost, the cats do not ----
await E(()=>{window.__hr=23;window.__nb3d.game.hour=23;window.__step(10)});
const night=await E(()=>{const w=window.__nb3d.wildlifeMod,P=window.__nb3d.game.player,near=w.critters.filter(c=>Math.hypot(c.x-P.x,c.z-P.z)<150);const k={};for(const c of near){k[c.kind]=k[c.kind]||{n:0,sleep:0};k[c.kind].n++;if(c.state==='sleep')k[c.kind].sleep++}return k});
console.log('night',JSON.stringify(night));
ok('night: nearby birds roost (asleep), cats stay about',Object.entries(night).every(([k,v])=>k==='cat'?v.sleep===0:v.sleep===v.n));
await E(()=>{window.__hr=13;window.__nb3d.game.hour=13;window.__step(10)});
ok('day: they wake up',await E(()=>{const w=window.__nb3d.wildlifeMod,P=window.__nb3d.game.player;return w.critters.filter(c=>Math.hypot(c.x-P.x,c.z-P.z)<150).every(c=>c.state!=='sleep')}));

// ---- gulls on the beach ----
const gull=await E(()=>{const g=window.__nb3d.wildlifeMod.critters.find(c=>c.kind==='gull');return {id:g.id,x:g.x,z:g.z}});
await E((g)=>{window.__put(g.x-30,g.z);window.__step(30);window.__nb3dCamOverride={p:[g.x-3,1.1,g.z+3],t:[g.x,0.3,g.z]}},gull);await settle();await W(2500);await p.screenshot({path:'jp/wl_gull.png',timeout:180000});await E(()=>{window.__nb3dCamOverride=null});

// ---- cost: the simulation near a busy spot ----
const cost=await E((F)=>{window.__put(F.x,F.z);const t0=performance.now();for(let i=0;i<300;i++)window.__nb3d.wildlifeMod.updateWildlife(0.05);return +((performance.now()-t0)/300).toFixed(3)},F);
ok('cost: the simulation takes well under a millisecond a frame',cost<0.6,cost+' ms/frame, '+pop.n+' creatures');
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
