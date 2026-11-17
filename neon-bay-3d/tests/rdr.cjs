// The score (adaptive underscore) and cinematic mission scenes. usage: node rdr.cjs <html> [region]
// Audio can only be measured here, not listened to: the test checks that the right layers run in each mood, that the
// mix is silent where it should be (radio on), and that sound is actually reaching the output (analyser level).
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const ok=(name,v,extra='')=>console.log((v?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));
const sc=async()=>{for(let k=0;k<25;k++){await E(()=>window.__nb3d.scoreMod.scoreSample());await W(60);}return E(()=>window.__nb3d.scoreMod.scoreState());};
const until=async(f,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await W(500);}return false;};
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.money=500;G.weather.kind='clear';G.weather.rain=0;G.weather.next=9999;G.wanted=0;window.__pin=setInterval(()=>{if(window.__hour)window.__nb3d.game.hour=window.__hour},1500);window.__hour=13;});

// ---------------- the score ----------------
await until(async()=>(await sc()).mood==='day',30000);let s=await sc();
ok('score: day mood, audio running',s.mood==='day'&&s.ctx==='running',JSON.stringify({mood:s.mood,ctx:s.ctx,master:s.master}));
await W(6000);s=await sc();
ok('score: day layers play (pad, pluck) and none of the tense ones',(s.perLayer.pad||0)>0&&(s.perLayer.pluck||0)>0&&!(s.perLayer.drum>0)&&!(s.perLayer.pulse>0),JSON.stringify(s.perLayer));
ok('score: sound reaches the output (analyser level)',s.rms>0.0003,'rms '+s.rms);
ok('score: day mix (pad/pluck/breath up, drums and tension down)',s.gains.pad>0.3&&s.gains.pluck>0.4&&s.gains.drum<0.05&&s.gains.tension<0.05,JSON.stringify(s.gains));
await E(()=>{window.__nb3d.game.wanted=1});await until(async()=>(await sc()).mood==='wary',20000);s=await sc();await W(8000);s=await sc();
ok('score: one star -> wary (tension up, pluck down)',s.mood==='wary'&&s.gains.tension>0.3&&s.gains.pluck<0.5,JSON.stringify({mood:s.mood,tension:s.gains.tension,pluck:s.gains.pluck}));
const d0=(await sc()).perLayer.drum||0;
await E(()=>{window.__nb3d.game.wanted=3});await until(async()=>(await sc()).mood==='chase',20000);await W(8000);s=await sc();
ok('score: three stars -> chase (drums and pulse play, mix is driving)',s.mood==='chase'&&(s.perLayer.drum||0)>d0+4&&(s.perLayer.pulse||0)>0&&s.gains.drum>0.7&&s.gains.pad<0.4,JSON.stringify({mood:s.mood,drum:s.perLayer.drum,pulse:s.perLayer.pulse,g:s.gains.drum}));
const rmsChase=s.rms;
await E(()=>{window.__nb3d.game.wanted=0});await W(3000);s=await sc();
ok('score: the stars go but the chase lingers',s.mood==='chase','mood '+s.mood);
ok('score: ...then settles back to day',await until(async()=>(await sc()).mood==='day',120000));
await E(()=>{window.__hour=23;window.__nb3d.game.hour=23});await until(async()=>(await sc()).mood==='night',20000);await W(5000);s=await sc();
ok('score: night is thinner (pad up, pluck lower than by day)',s.mood==='night'&&s.gains.pad>0.5&&s.gains.pluck<0.6,JSON.stringify({m:s.mood,pad:s.gains.pad,pluck:s.gains.pluck}));
await E(()=>{window.__hour=13;window.__nb3d.game.hour=13});await until(async()=>(await sc()).mood==='day',20000);
// the radio takes over in a car
await E(()=>{const N=window.__nb3d,G=N.game;const v=N.spawn('sedan',G.player.x+3,G.player.z,0);v.touched=true;G.inCar=v.id;G.radio=1});await until(async()=>(await sc()).mood==='off',20000);await W(5000);s=await sc();
ok('score: silent while the car radio plays',s.mood==='off'&&s.master<0.15,JSON.stringify({mood:s.mood,master:s.master}));
await E(()=>{const G=window.__nb3d.game;G.radio=0});ok('score: returns when the radio is off',await until(async()=>(await sc()).mood==='day',20000));
await E(()=>{const N=window.__nb3d,G=N.game;G.inCar=0});
ok('score: it knows which city it is in',s.region===region,'region '+s.region);
await E(()=>window.__nb3d.scoreMod.scoreSting('win'));await W(1500);s=await sc();
ok('score: the win phrase plays',(s.perLayer.sting||0)>=6,'sting notes '+(s.perLayer.sting||0));

// ---------------- cinematic scenes ----------------
const start=await E((region)=>{const N=window.__nb3d,G=N.game;N.game.wanted=0;N.progress.story=region==='tokyo'?5:0;const M=N.story.MISSIONS[N.progress.story],q=M.start();G.player.x=q.x;G.player.z=q.z;G.player.y=N.groundAt(q.x,q.z)+0.3;return {x:q.x,z:q.z,title:M.title,region:M.region||''}},region);
console.log('mission',JSON.stringify(start));
// control: the stick moves the player when no scene is playing
await E(()=>{window.__nb3d.game.cam.yaw=0}); // (the car section above left the camera looking the other way, towards a wall)
await E(()=>{const I=window.__nb3d.input;I.joyActive=true;I.joyX=0;I.joyY=1});const w0=await E(()=>({x:window.__nb3d.game.player.x,z:window.__nb3d.game.player.z}));await W(3500);const w1=await E(()=>({x:window.__nb3d.game.player.x,z:window.__nb3d.game.player.z}));await E(()=>{const I=window.__nb3d.input;I.joyActive=false;I.joyY=0});
ok('control: the stick walks the player (scene not playing)',Math.hypot(w1.x-w0.x,w1.z-w0.z)>0.3,'moved '+Math.hypot(w1.x-w0.x,w1.z-w0.z).toFixed(2));
await E((st)=>{const N=window.__nb3d,G=N.game;G.player.x=st.x;G.player.z=st.z;G.player.y=N.groundAt(st.x,st.z)+0.3},start);await W(2500);
const before=await E(()=>{const N=window.__nb3d;return {px:N.game.player.x,pz:N.game.player.z,t:N.story.mission.t}});
await E(()=>{window.__nb3d.story.startMission()});await W(2000);
let c=await E(()=>{const N=window.__nb3d,C=N.cine;return {on:C.on,lock:C.lock,kind:C.kind,dur:C.dur,locked:N.input.locked,mid:N.story.mission.id,bodyCine:document.body.classList.contains('cine'),camOn:C.cam.on,queue:C.queue.length}});
ok('cine: the mission opens with a scene (intro first, goal next)',c.on&&c.lock&&c.kind==='intro'&&c.queue===1&&c.mid>=0,JSON.stringify(c));
await until(async()=>E(()=>document.body.classList.contains('cine')),30000);c=await E(()=>({locked:window.__nb3d.input.locked,bodyCine:document.body.classList.contains('cine')}));
ok('cine: input is locked, the HUD steps aside',c.locked&&c.bodyCine,JSON.stringify(c));
// walk: the held stick must do nothing; the mission clock must stand still
await E(()=>{const I=window.__nb3d.input;I.joyActive=true;I.joyX=0;I.joyY=1;I.action=true;I.jump=true});
const p0=await E(()=>({x:window.__nb3d.game.player.x,z:window.__nb3d.game.player.z,t:window.__nb3d.story.mission.t}));await W(3000);
const p1=await E(()=>({x:window.__nb3d.game.player.x,z:window.__nb3d.game.player.z,t:window.__nb3d.story.mission.t,on:window.__nb3d.cine.on}));
ok('cine: a held stick does not move the player',Math.hypot(p1.x-p0.x,p1.z-p0.z)<0.05&&p1.on,'moved '+Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(3));
ok('cine: the mission clock stands still',Math.abs(p1.t-p0.t)<0.001,'t '+p0.t+' -> '+p1.t);
// the camera: where is it?
const look=async(label,tfrac)=>{await E((tf)=>{const C=window.__nb3d.cine;C.t=C.dur*tf;window.__nb3d.cineMod.updateCine(0);},tfrac);const r=await E(()=>{const N=window.__nb3d,C=N.cine,P=N.game.player,c=C.cam;const d=Math.hypot(c.pos.x-P.x,c.pos.y-P.y-1.4,c.pos.z-P.z);return {finite:[c.pos.x,c.pos.y,c.pos.z,c.look.x,c.look.y,c.look.z,c.fov].every(Number.isFinite),d:+d.toFixed(2),fov:c.fov,kind:C.kind,k:+C.k.toFixed(2),py:+(c.pos.y-N.groundAt(c.pos.x,c.pos.z)).toFixed(2)}});console.log(' ',label,JSON.stringify(r));return r;};
let r=await look('intro 20%',0.2);ok('cine: intro camera is finite, 1.5-8 m from the player, above ground',r.finite&&r.d>1.5&&r.d<8&&r.py>0.2,JSON.stringify(r)+' side '+await E(()=>window.__nb3d.cine.side.toFixed(2)));
await p.screenshot({path:'jp/rdr_intro_a.png',timeout:180000});
r=await look('intro 90%',0.9);ok('cine: intro end shot ok',r.finite&&r.d>1.5&&r.d<8&&r.py>0.2,JSON.stringify(r));await p.screenshot({path:'jp/rdr_intro_b.png',timeout:180000});
await E(()=>{const I=window.__nb3d.input;I.joyActive=false;I.joyY=0});
// let the intro end by itself, goal scene follows
await E(()=>{const C=window.__nb3d.cine;C.t=C.dur-0.02});await W(2500);
c=await E(()=>{const C=window.__nb3d.cine;return {on:C.on,kind:C.kind,q:C.queue.length,k:+C.k.toFixed(2)}});
ok('cine: the goal shot follows the intro',c.on&&c.kind==='goal'&&c.q===0,JSON.stringify(c));
r=await look('goal 50%',0.5);ok('cine: goal camera is at the player\'s eyes, above ground',r.finite&&r.py>0.8&&r.d<3,JSON.stringify(r));await p.screenshot({path:'jp/rdr_goal.png',timeout:180000});
// skip
await E(()=>window.__nb3d.cineMod.skipCine());await until(async()=>E(()=>window.__nb3d.cine.k<0.02),40000);await W(500);
c=await E(()=>{const N=window.__nb3d,C=N.cine;return {on:C.on,lock:C.lock,locked:N.input.locked,k:+C.k.toFixed(2),body:document.body.classList.contains('cine'),t:N.story.mission.t,mid:N.story.mission.id}});
ok('cine: skip ends the scene, controls and HUD come back, the mission goes on',!c.on&&!c.lock&&!c.locked&&c.k<0.05&&!c.body&&c.mid>=0,JSON.stringify(c));
await W(2000);const t2=await E(()=>window.__nb3d.story.mission.t);ok('cine: the mission clock runs again',t2>c.t,'t '+c.t+' -> '+t2);
await E(()=>{window.__nb3d.game.cam.yaw=0;const I=window.__nb3d.input;I.joyActive=true;I.joyY=1});const q0=await E(()=>({x:window.__nb3d.game.player.x,z:window.__nb3d.game.player.z}));await until(async()=>E((q)=>Math.hypot(window.__nb3d.game.player.x-q.x,window.__nb3d.game.player.z-q.z)>0.5,q0),30000);const q1=await E(()=>({x:window.__nb3d.game.player.x,z:window.__nb3d.game.player.z}));await E(()=>{const I=window.__nb3d.input;I.joyActive=false;I.joyY=0});
if(Math.hypot(q1.x-q0.x,q1.z-q0.z)<=0.5)console.log('  walk debug',JSON.stringify(await E(()=>{const N=window.__nb3d,I=N.input,P=N.game.player;const near=N.vehicles.filter(v=>Math.hypot(v.x-P.x,v.z-P.z)<8).map(v=>[v.def.kind,+(v.x-P.x).toFixed(1),+(v.z-P.z).toFixed(1),v.parked,v.dead]);const bl=[[0,-1],[0,1],[1,0],[-1,0]].map(([dx,dz])=>N.cityMod.pointBlocked(P.x+dx*0.6,P.y+0.8,P.z+dz*0.6));return {near,blockedNSEW:bl,yaw:N.game.cam.yaw,joy:[I.joyActive,I.joyX,I.joyY],cine:N.cine.on,x:P.x,y:P.y,z:P.z,sp:P.speed,vy:P.vy,grounded:P.grounded,crouch:P.crouch,styling:N.game.styling,stam:N.game.stamina,over:!!N.crime.law.over,fps:N.game.fps}})));
ok('cine: the player can walk again',Math.hypot(q1.x-q0.x,q1.z-q0.z)>0.5,'moved '+Math.hypot(q1.x-q0.x,q1.z-q0.z).toFixed(2));

// the scene ends when the world moves on: enter a car that is moving -> no scene is started at all
await E(()=>{const N=window.__nb3d,G=N.game;const v=N.spawn('sedan',G.player.x+3,G.player.z,0);v.touched=true;v.vz=15;v.vx=0;G.inCar=v.id;});
const safe=await E(()=>window.__nb3d.cineMod.cineSafe());ok('cine: no scene while driving at speed',safe===false);
await E(()=>{const N=window.__nb3d,G=N.game;const v=N.vehicles.find(q=>q.id===G.inCar);if(v){v.vx=v.vz=0;}});
ok('cine: a scene is fine in a stopped car',await until(async()=>E(()=>window.__nb3d.cineMod.cineSafe()),8000));
await E(()=>{window.__nb3d.game.inCar=0});

// a win scene: finish the mission (go to the marker)
await E(()=>{const N=window.__nb3d,G=N.game,m=N.story.mission.marker;if(m){G.player.x=m.x;G.player.z=m.z;G.player.y=N.groundAt(m.x,m.z)+0.3;}});
const won=await until(async()=>E(()=>window.__nb3d.cine.on&&window.__nb3d.cine.kind==='win'),30000);
ok('cine: finishing the mission plays a win scene',won,'story '+(await E(()=>window.__nb3d.progress.story)));
if(won){r=await look('win 60%',0.6);ok('cine: win camera ok',r.finite&&r.d>2&&r.d<14&&r.py>0.2,JSON.stringify(r));await p.screenshot({path:'jp/rdr_win.png',timeout:180000});
  s=await sc();ok('score: the win phrase played at the end of the mission',(s.perLayer.sting||0)>=12,'sting notes '+(s.perLayer.sting||0));}
await E(()=>window.__nb3d.cineMod.skipCine());await W(2500);
ok('cine: skipping the win scene returns control',await E(()=>!window.__nb3d.cine.lock&&!window.__nb3d.input.locked));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
