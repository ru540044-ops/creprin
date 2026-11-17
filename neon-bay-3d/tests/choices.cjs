// Story decisions: a choice is put to the player in the mission, changes the reputation and the pay, is remembered
// (and saved), and changes what is said later. usage: node choices.cjs <html>   (Osaka: mission 8; the other missions are read directly)
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region='osaka';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const ok=(name,v,extra='')=>console.log((v?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));
const until=async(f,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await W(400);}return false;};
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.money=500;G.weather.kind='clear';G.weather.rain=0;G.weather.next=9999;window.__pin=setInterval(()=>{window.__nb3d.game.hour=13},2000);});
const skipScene=async()=>{await E(()=>window.__nb3d.cineMod.skipCine());await until(async()=>E(()=>!window.__nb3d.cine.lock),40000);};
const toMarker=()=>E(()=>{const N=window.__nb3d,G=N.game,m=N.story.mission.marker;if(!m)return 'no marker';G.player.x=m.x;G.player.z=m.z;G.player.y=Math.max(G.player.y,N.groundAt(m.x,m.z))+0.3;return 'ok'});
const step=()=>E(()=>window.__nb3d.story.mission.step);

/** play mission 8 (collection), picking option `pick` (0 or 1) at the decision; returns what happened */
async function playCollection(pick){
  await E(()=>{const N=window.__nb3d,G=N.game;G.wanted=0;N.progress.stats.flags.rep=0;delete N.progress.stats.flags.ch_collect;N.progress.story=7;const q=N.story.MISSIONS[7].start();G.player.x=q.x;G.player.z=q.z;G.player.y=N.groundAt(q.x,q.z)+0.3;G.inCar=0;N.eventsMod.ev.choice=null;});
  await W(1500);const m0=await E(()=>window.__nb3d.game.money);
  await E(()=>window.__nb3d.story.startMission());await skipScene();
  for(let k=0;k<3;k++){const s=await step();await toMarker();await until(async()=>(await step())!==s,40000);}
  const shown=await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);
  const info=await E(()=>{const c=window.__nb3d.eventsMod.ev.choice;return c&&{title:c.title,story:c.story,n:c.options.length,labels:c.options.map(o=>o.label),goal:window.__nb3d.story.storyStatus().text}});
  await until(async()=>E(()=>document.querySelectorAll('.choiceBox button').length>=2),30000); // the panel redraws every 150 ms: on a slow page it can be a while
  const dom=await E(()=>({box:!!document.querySelector('.choiceBox'),btns:document.querySelectorAll('.choiceBox button').length}));
  if(dom.btns<2)console.log('  DEBUG no panel:',JSON.stringify(await E(()=>{const N=window.__nb3d,c=N.eventsMod.ev.choice;return {choice:c&&c.title,where:N.game.where,overlay:[...document.querySelectorAll('.overlay')].map(o=>o.className+':'+o.innerText.slice(0,40)),studio:N.game.styling,phone:N.game.phone,ui:N.game.ui,cine:N.cine.on,fps:N.game.fps,paused:N.game.paused}})));
  await E((k)=>{document.querySelectorAll('.choiceBox button')[k].click()},pick);
  await until(async()=>E(()=>!window.__nb3d.eventsMod.ev.choice),10000);
  const after=await E(()=>{const N=window.__nb3d;return {ch:N.progress.stats.flags.ch_collect,rep:N.progress.stats.flags.rep,bonus:N.story.mission.data.bonus,step:N.story.mission.step}});
  // the police step: clear the stars to finish
  await until(async()=>E(()=>window.__nb3d.game.wanted>0),20000);await E(()=>{window.__nb3d.game.wanted=0});
  await until(async()=>E(()=>window.__nb3d.story.mission.id<0),30000);
  const end=await E((m0)=>{const N=window.__nb3d;return {story:N.progress.story,pay:N.game.money-m0,say:(N.story.talk.queue[0]||{}).text||'',banner:(document.querySelector('.banner')||{}).innerText||''}},m0);
  await skipScene();
  return {shown,info,dom,after,end};
}
let A=await playCollection(1); // きっちり取る
console.log('run A',JSON.stringify(A));
ok('choice: a decision is put to the player during the mission',A.shown&&A.info&&A.info.story===true&&A.info.n===2&&A.info.goal.startsWith('選べ'),JSON.stringify(A.info));
ok('choice: it is on screen as a panel with two buttons',A.dom.box&&A.dom.btns===2,JSON.stringify(A.dom));
ok('choice: picking "take it all" is remembered, costs reputation, adds to the pay',A.after.ch===2&&A.after.rep===-2&&A.after.bonus===2000,JSON.stringify(A.after));
ok('choice: the mission finishes with the pay changed ($9,000 + $2,000)',A.end.story===8&&A.end.pay===11000,'pay '+A.end.pay+' '+A.end.banner.replace(/\n/g,' '));
ok('choice: what the contact says afterwards depends on it',A.end.say.includes('さすがや'),A.end.say);
let B=await playCollection(0); // 見逃す
console.log('run B',JSON.stringify(B));
ok('choice: picking "let it go" gains reputation, costs pay ($9,000 - $2,000)',B.after.ch===1&&B.after.rep===2&&B.end.pay===7000,JSON.stringify(B.after)+' pay '+B.end.pay);
ok('choice: ...and the contact reacts differently',B.end.say.includes('甘い'),B.end.say);
// remembered across a reload
await E(()=>window.__nb3d.saveNow());await p.reload();await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await W(2500);
const kept=await E(()=>({ch:window.__nb3d.progress.stats.flags.ch_collect,rep:window.__nb3d.progress.stats.flags.rep,story:window.__nb3d.progress.story}));
ok('choice: the decision and the reputation survive a save and reload',kept.ch===1&&kept.rep===2&&kept.story===8,JSON.stringify(kept));
// the other decisions, read from the mission list
const M=await E(()=>{const N=window.__nb3d,S=N.story;const out={};const decs=S.MISSIONS.map((m,i)=>[i,m.title,m.steps.some(s=>{try{return s.goal().startsWith('選べ')}catch(e){return false}})]).filter(x=>x[2]);out.decides=decs.map(x=>x[1]);
  const f=N.progress.stats.flags;
  const get=(i,key,fl,v)=>{f[fl]=v;const m=S.MISSIONS[i];const l=typeof m[key]==='function'?m[key]():m[key];return l.map(x=>x.who+':'+x.text).join(' | ')};
  out.monk1=get(8,'outro','ch_monk',1);out.monk2=get(8,'outro','ch_monk',2);out.v1i=get(12,'intro','ch_vince',1);out.v2i=get(12,'intro','ch_vince',2);out.v1o=get(12,'outro','ch_vince',1);out.v2o=get(12,'outro','ch_vince',2);
  delete f.ch_monk;delete f.ch_vince;return out});
console.log('decisions in the story:',JSON.stringify(M.decides));
ok('choice: three missions carry a decision (collection, offering, Vince)',M.decides.length===3&&M.decides.includes('取り立て')&&M.decides.includes('古都の密会')&&M.decides.includes('帳簿'));
ok('choice: the Nara monk reacts to the offering',M.monk1!==M.monk2&&M.monk1.includes('御仏')&&!M.monk2.includes('御仏'));
ok('choice: the last mission opens and closes differently depending on what you did about Vince',M.v1i!==M.v2i&&M.v1o!==M.v2o&&M.v1o.includes('ありがとな')&&M.v2o.includes('覚えてろ'));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
