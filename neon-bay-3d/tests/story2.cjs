// Story chapter 2 (missions 6-13): each city's missions are started at their marker and played through to the reward.
// Walking/driving between places is replaced by teleporting, and losing the police by clearing the wanted level
// (both are covered by other tests); everything else goes through the game's own checks.
// usage: node story2.cjs <html> <region>
const {chromium}=require('playwright');
const PLAN={tokyo:[5,11,12],osaka:[6,7],nara:[8],fukuoka:[9],naha:[10]};
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=40000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<30&&(await E(()=>window.__nb3d.input.action));k++)await W(300);await W(600);};
const st=()=>E(()=>{const N=window.__nb3d,m=N.story.mission,s=N.story.storyStatus();return {id:m.id,step:m.step,fail:m.fail,goal:s?s.text:'',story:N.progress.story,money:N.game.money,wanted:N.game.wanted,marker:m.marker&&{x:Math.round(m.marker.x),z:Math.round(m.marker.z)}}});
/** wait until the mission's step number changes (or the mission ends) */
const tick=async()=>{const t0=await E(()=>window.__nb3d.story.mission.t);for(let k=0;k<60;k++){await W(250);const m=await E(()=>({t:window.__nb3d.story.mission.t,id:window.__nb3d.story.mission.id}));if(m.id<0||m.t>t0+0.06)return;}};
const stepOn=async(from,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){const s=await st();if(s.id<0||s.step!==from){await tick();return await st();}await W(400);}return {...(await st()),STUCK:true};};
/** put the player (or the car they are in) on the current marker */
const toMarker=()=>E(()=>{const N=window.__nb3d,G=N.game,m=N.story.mission.marker;if(!m)return 'no marker';const v=N.playerCar();if(v){v.x=m.x;v.z=m.z;v.vx=v.vz=0;v.y=N.groundAt(m.x,m.z)+0.4;}G.player.x=m.x;G.player.z=m.z;if(!v)G.player.y=Math.max(G.player.y,N.groundAt(m.x,m.z))+0.3;return 'ok'});
const car=()=>E(()=>{const N=window.__nb3d,G=N.game;if(N.playerCar())return;const v=N.spawn('sedan',G.player.x,G.player.z,0);v.touched=true;G.inCar=v.id;});
const outCar=()=>E(()=>{window.__nb3d.game.inCar=0});
const noEat=async()=>{for(let k=0;k<40&&(await E(()=>!!document.querySelector('.eatCard')));k++)await W(500);};
const log=(...a)=>console.log(...a);
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.money=500;G.weather.kind='clear';G.weather.rain=0;G.weather.next=9999;window.__pin=setInterval(()=>{window.__nb3d.game.hour=13},2000);});
log('region',region,'missions',await E(()=>window.__nb3d.story.MISSIONS.length));
// a mission of another city is not offered here
const other=region==='tokyo'?6:5;
log('gate',JSON.stringify(await E((i)=>{const N=window.__nb3d;N.progress.story=i;const M=N.story.MISSIONS[i],s=M.start();N.game.player.x=s.x;N.game.player.z=s.z;N.story.updateStory(0.05);return {elsewhere:N.story.missionElsewhere(),near:N.story.storyNear(),marker:N.story.mission.marker}},other)));

async function begin(i){
  await outCar();
  const s=await E((i)=>{const N=window.__nb3d,G=N.game;N.progress.story=i;G.wanted=0;const M=N.story.MISSIONS[i],s=M.start();G.player.x=s.x;G.player.z=s.z;G.player.y=N.groundAt(s.x,s.z)+0.3;return {title:M.title,reward:M.reward,steps:M.steps.length,elsewhere:N.story.missionElsewhere()}},i);
  const n=await waitNear('story|ミッション「'+s.title);await act();await tick();const a=await st();
  log(`\n== ${i+1}「${s.title}」 steps ${s.steps} reward ${s.reward} elsewhere '${s.elsewhere}' near ${n.slice(0,40)} -> started ${a.id===i} goal: ${a.goal}`);
  return {...s,money:a.money};
}
async function done(i,m){const s=await st();log(`   finished: story ${s.story} (want ${i+1}) money +${s.money-m.money} (want >= ${m.reward}) ${s.story===i+1&&s.money-m.money>=m.reward-200?'OK':'NG'} fail '${s.fail}'`);}
/** a "go there" step */
async function go(){const s=await st();const r=await toMarker();const n=await stepOn(s.step);log(`   go [${s.goal.slice(0,34)}] ${r} -> step ${n.step}${n.STUCK?' STUCK':''}${n.id<0?' (mission ended)':''}`);return n;}
async function inCar(){const s=await st();await car();const n=await stepOn(s.step);log(`   in car -> step ${n.step}${n.STUCK?' STUCK':''} ${n.goal.slice(0,50)}`);}
async function lose(){const s=await st();log(`   wanted ${s.wanted} [${s.goal.slice(0,40)}]`);await E(()=>{const N=window.__nb3d;N.game.wanted=0;N.crime.law&&(N.crime.law.unseen=0)});const n=await stepOn(s.step);log(`   cleared -> ${n.id<0?'mission ended':'step '+n.step}${n.STUCK?' STUCK':''}`);}
async function chase(){
  let s=await st();const t0=await E(()=>{const t=window.__nb3d.story.mission.target;return t&&{x:t.x,z:t.z,kind:t.def.kind,hp:t.hp,d:Math.hypot(t.x-window.__nb3d.game.player.x,t.z-window.__nb3d.game.player.z)}});
  await W(12000);
  const t1=await E(()=>{const t=window.__nb3d.story.mission.target;return t&&{x:t.x,z:t.z}});
  log(`   chase [${s.goal.slice(0,40)}] target ${t0?t0.kind+' at '+Math.round(t0.d)+' m':'NONE'} moved ${t0&&t1?Math.hypot(t1.x-t0.x,t1.z-t0.z).toFixed(1):'-'} m in 12 s`);
  // keep up with it (teleport behind), then wreck it to the threshold
  await E(()=>{const N=window.__nb3d,t=N.story.mission.target,v=N.playerCar();if(!t)return;if(v){v.x=t.x-Math.sin(t.yaw)*14;v.z=t.z-Math.cos(t.yaw)*14;v.vx=v.vz=0;}N.game.player.x=t.x;N.game.player.z=t.z;t.hp=t.def.hp*0.4;});
  let n=await stepOn(s.step,90000);log(`   stopped -> step ${n.step}${n.STUCK?' STUCK':''} ${n.goal.slice(0,40)}`);
  await outCar();await E(()=>{const N=window.__nb3d,k=N.story.mission.data.book,G=N.game;if(k){G.player.x=k.x;G.player.z=k.z;G.player.y=N.groundAt(k.x,k.z)+0.3;}});
  s=n;n=await stepOn(s.step);log(`   picked up -> ${n.id<0?'mission ended':'step '+n.step}${n.STUCK?' STUCK':''}`);
}

for(const i of PLAN[region]||[]){
  const m=await begin(i);
  if(i===5){ // west: to the Shinkansen gate
    await go();
  } else if(i===6){ // osaka manners: eat at a stall, car, coin parking (and the time limit)
    const y=await E(()=>{const N=window.__nb3d,C=N.cityMod,G=N.game;const k=C.SIG.yatai.findIndex(q=>!q.senbei);const q=C.SIG.yatai[k];if(!q)return null;const a=q.a||0;G.player.x=q.x+Math.sin(a)*2.2;G.player.z=q.z+Math.cos(a)*2.2;return {k,food:q.food}});
    let n=await waitNear('jp:yatai');if(n.startsWith('NONE')){ // stalls face different ways: try round it
      for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){await E(([k,a])=>{const N=window.__nb3d,q=N.cityMod.SIG.yatai[k],G=N.game;G.player.x=q.x+Math.sin(a)*2.2;G.player.z=q.z+Math.cos(a)*2.2;},[y.k,a]);n=await waitNear('jp:yatai',6000);if(!n.startsWith('NONE'))break;}}
    log('   stall',y&&y.food,n.slice(0,50));const s0=await st();await act();let s=await stepOn(s0.step);log(`   ate -> step ${s.step}${s.STUCK?' STUCK':''} ${s.goal.slice(0,30)}`);await noEat();
    await inCar();
    // time runs out first: the mission fails and can be started again
    await E(()=>{window.__nb3d.story.mission.timer=0.01});for(let k=0;k<40&&(await st()).id>=0;k++)await W(500);s=await st();log(`   time out -> mission ended ${s.id<0} story still ${s.story} banner ${JSON.stringify(await E(()=>(document.querySelector('.banner')||{}).innerText||''))}`);
    const m2=await begin(i);
    await E(()=>{const N=window.__nb3d;N.game.items.onigiri=1;N.game.health=50;N.shopsMod.useItem('onigiri')});s=await stepOn(0);log(`   ate an onigiri from the pocket -> step ${s.step}`);await noEat();await inCar();
    s=await st();log('   lot marker',JSON.stringify(s.marker),s.goal.slice(0,60));await toMarker();const pn=await waitNear('coin:park');await act();const n2=await stepOn(s.step);log(`   ${pn.slice(0,30)} parked -> ${n2.id<0?'mission ended':'step '+n2.step}${n2.STUCK?' STUCK':''}`);
    await done(i,m2);continue;
  } else if(i===7){ // collection: three stores, then the police
    const shops=await E(()=>window.__nb3d.story.mission.data.shops.map(d=>[Math.round(d.x),Math.round(d.z)]));log('   shops',JSON.stringify(shops));
    await go();await go();await go();await lose();
  } else if(i===8){ // nara: feed a deer, the great hall, the pagoda
    let s=await st();log('   stall marker',JSON.stringify(s.marker));await toMarker();const n=await waitNear('nara:senbei');await act();log('   bought',n.slice(0,40),'senbei',await E(()=>window.__nb3d.game.items.senbei));
    await E(()=>{const N=window.__nb3d,G=N.game,D=N.deerMod.deer;let b=null,bd=1e9;for(const d of D){const q=Math.hypot(d.x-G.player.x,d.z-G.player.z);if(q<bd&&d.state!=='rest'){bd=q;b=d;}}G.player.x=b.x+1.2;G.player.z=b.z;});
    const fn=await waitNear('nara:feed');await act();s=await stepOn(0);log(`   ${fn.slice(0,30)} fed -> step ${s.step}${s.STUCK?' STUCK':''} ${s.goal}`);
    await go();log('   inside the hall?',JSON.stringify(await E(()=>{const N=window.__nb3d,G=N.game;return {y:+G.player.y.toFixed(2),where:G.where}})));await go();
  } else if(i===9){ // hakata: ramen, then the chase
    let s=await st();await E(()=>{const N=window.__nb3d;N.shopsMod.buyGoods('ramen',{id:'t',name:'餃子',sub:'',price:4,heal:20,ticket:true});N.shopsMod.eatMeal()});await W(3000);log('   gyoza does not count: step',(await st()).step);await noEat();
    await E(()=>{const N=window.__nb3d;N.shopsMod.buyGoods('ramen',{id:'t',name:'博多ラーメン',sub:'',price:8,heal:100,ticket:true});N.shopsMod.eatMeal()});s=await stepOn(0);log(`   ramen -> step ${s.step}${s.STUCK?' STUCK':''}`);await noEat();
    await inCar();await chase();
  } else if(i===10){ // naha: car, the castle, the port against the clock with the police
    await inCar();await go();const s=await st();log(`   port run: wanted ${s.wanted} ${s.goal}`);await go();
  } else if(i===11){ // the ledger: bank, police, garage
    await go();await lose();await go();
  } else if(i===12){ // the end: chase, pick up, garage
    await inCar();await chase();await go();
  }
  await done(i,m);
  await p.screenshot({path:'jp/story2_'+region+'_'+(i+1)+'.png',timeout:180000}).catch(()=>{});
}
log('talk',JSON.stringify(await E(()=>(document.querySelector('.talk')||{}).innerText||'')));
log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
