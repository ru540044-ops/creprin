// Admin speed multipliers: car x1..x5 (top speed, braking, no tunnelling through walls) and the bullet train (ATC scaling, safe stop).
// usage: node spd.cjs <html>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const run=async(owner)=>{
const ctx=await b.newContext({viewport:{width:844,height:390}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((owner)=>{try{localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}catch(e){}
  window.claude={use:async(n)=>n==='user'?{isOwner:async()=>owner}:null};},owner);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
if(!owner){ // a guest cannot change the multipliers, and they stay at 1
  console.log('guest',JSON.stringify(await E(()=>{const A=window.__nb3d.adminMod;A.setCarSpeed(5);A.setTrainSpeed(5);return {is:A.admin.is,car:A.admin.carSpeed,train:A.admin.trainSpeed}})));
  console.log('guest errors',JSON.stringify(errs));await ctx.close();return;
}
// --- UI: the admin app has the two sliders and preset rows ---
await p.click('.phoneChip');await W(500);await p.locator('.appIc',{hasText:'管理者'}).click();await W(500);
await p.locator('.adSlider:has-text("車のスピード") + .adRow button',{hasText:'×3'}).click();
await p.locator('.adSlider:has-text("新幹線のスピード") + .adRow button',{hasText:'×4'}).click();await W(300);
console.log('ui set',JSON.stringify(await E(()=>{const A=window.__nb3d.adminMod.admin;return {car:A.carSpeed,train:A.trainSpeed,carLabel:document.querySelector('.adSlider span').textContent,saved:localStorage.getItem('neonbay3d.admin.v1')}})));
await p.screenshot({path:'jp/spd_admin.png'});
await p.locator('.adTog',{hasText:'車無敵'}).click();await W(200);
await p.click('.pHome');await W(400);
// --- car: top speed and braking by multiplier, on an endless flat (position is reset every step) ---
const carTest=(k)=>E((k)=>{const N=window.__nb3d,A=N.adminMod,G=N.game;A.setCarSpeed(k);
  const old=N.playerCar();if(old){G.inCar=0;N.remove(old);}
  const x0=N.cityMod.AIRPORT.x0+400,z0=-165,v=N.spawn('sedan',x0,z0,Math.PI/2,'#fff');v.touched=true;G.inCar=v.id;
  const ctl={thr:1,brake:0,steer:0,hb:false};let t100=-1;
  for(let i=0;i<60*40;i++){N.drive(v,ctl,1/60);v.x=x0;v.z=z0;if(t100<0&&Math.hypot(v.vx,v.vz)>100/3.6)t100=i/60;}
  const top=Math.hypot(v.vx,v.vz);let dist=0,t=0;
  while(Math.hypot(v.vx,v.vz)>1&&t<120){const ox=v.x,oz=v.z;N.drive(v,{thr:0,brake:1,steer:0,hb:false},1/60);dist+=Math.hypot(v.x-ox,v.z-oz);v.x=x0;v.z=z0;t+=1/60;}
  // steady turn: lateral acceleration available at half the top speed
  v.vx=top*0.5;v.vz=0;v.yaw=Math.PI/2;let yr=0;for(let i=0;i<30;i++){N.drive(v,{thr:0.6,brake:0,steer:1,hb:false},1/60);v.x=x0;v.z=z0;yr=Math.abs(v.yr);}
  const sp=Math.hypot(v.vx,v.vz);
  return {k,topKmh:Math.round(top*3.6),t100:+t100.toFixed(2),brakeS:+t.toFixed(1),brakeM:Math.round(dist),turnRadius:Math.round(sp/Math.max(1e-6,yr)),gear:v.gear};},k);
for(const k of [1,2,3.5,5])console.log('car',JSON.stringify(await carTest(k)));
// --- no tunnelling: full throttle at x5 into a building wall in the real game loop ---
const wall=await E(()=>{const N=window.__nb3d,A=N.adminMod,G=N.game,C=N.cityMod;A.setCarSpeed(5);
  // a wide building facing a straight road: drive along the road line x and then steer... simpler: aim straight at the long face of a big downtown block from across the street
  const old=N.playerCar();if(old){G.inCar=0;N.remove(old);}
  let best=null;for(const bb of N.buildings){if(bb.h<30||bb.x1-bb.x0<40||bb.z1-bb.z0<25||bb.shape||bb.y0>1)continue;const k=C.blockAt((bb.x0+bb.x1)/2,(bb.z0+bb.z1)/2);if(!k||k.zone!=='downtown')continue;
    // the road north of the block runs along x; we come down the cross street (along z) from the north if that street lines up with the building
    best=bb;break;}
  const cx=(best.x0+best.x1)/2;
  // start 260 m north of its north face on the same x, but that is inside other blocks: instead start on the street just north (7 m of road + sidewalk) -> too short. Use velocity injection: place the car 60 m north in the road axis and give it 250 m/s towards the wall.
  const v=N.spawn('sedan',cx,best.z0-12,0,'#fff');v.touched=true;G.inCar=v.id;v.vx=0;v.vz=250;
  return {wallZ:best.z0,farZ:best.z1,cx,id:v.id};});
await W(4000);
console.log('wall',JSON.stringify(await E((w)=>{const v=window.__nb3d.playerCar();return {z:+v.z.toFixed(1),wallZ:w.wallZ,farZ:w.farZ,inside:v.z>w.wallZ+1&&v.z<w.farZ,beyond:v.z>=w.farZ,speed:+Math.hypot(v.vx,v.vz).toFixed(1),hp:Math.round(v.hp),dead:v.dead}},wall)));
// the same from a long run-up along a real street: 5 blocks of road, then the T-end at a canal/edge is not guaranteed, so just check it stays on the map and alive
// --- train ---
await E(()=>{const N=window.__nb3d,G=N.game,old=N.playerCar();if(old){G.inCar=0;N.remove(old);}N.adminMod.setTrainSpeed(1);N.japanMod.shinAction('jp:board:14');});await W(800);
const trainTest=(k)=>E((k)=>{const N=window.__nb3d,A=N.adminMod,C=N.cityMod,S=C.SHIN,T=C.TUN;A.setTrainSpeed(k);const v=N.playerCar();
  // departure: 30 s at full power from the platform (northbound). updateTrain is not stepped here, so the trip never starts.
  v.yaw=Math.PI;v.x=S.x-S.track;v.z=S.stationZ-90;v.vz=0;const z0=v.z;let t=0;while(t<30&&v.z>T.portal+30){N.drive(v,{thr:1,brake:0,steer:0,hb:false},1/30);t+=1/30;}
  const dep={kmh:Math.round(Math.abs(v.vz)*3.6),m:Math.round(z0-v.z),t:+t.toFixed(1),atc:N.japanMod.atcLimit(v)};
  // arrival: southbound out of the tunnel at full power all the way: the ATC must stop it before the buffers
  v.yaw=0;v.x=S.x+S.track;v.z=T.portal-150;v.vz=120/3.6;let maxKmh=0,steps=0;const hi=S.z1-16-2;
  while(steps<30*400){N.drive(v,{thr:1,brake:0,steer:0,hb:false},1/30);maxKmh=Math.max(maxKmh,Math.abs(v.vz)*3.6);steps++;if(Math.abs(v.vz)<0.01&&steps>60)break;}
  return {k,dep,arr:{maxKmh:Math.round(maxKmh),stopGap:+(hi-v.z).toFixed(1),secs:Math.round(steps/30)}};},k);
for(const k of [1,2,5])console.log('train',JSON.stringify(await trainTest(k)));
// reload: the multipliers persist for the owner
await p.reload();await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});
console.log('persist',JSON.stringify(await E(()=>{const A=window.__nb3d.adminMod.admin;return {car:A.carSpeed,train:A.trainSpeed}})));
console.log('errors',JSON.stringify(errs.slice(0,8)));await ctx.close();};
await run(false);await run(true);await b.close();})();
