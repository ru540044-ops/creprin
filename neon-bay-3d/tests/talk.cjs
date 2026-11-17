// Talking to people on the street. usage: node talk.cjs <html> [region]
// Greeting (the answer changes with reputation), asking the way (the nearest place of that kind goes on the map and the
// stranger points the right way), gossip (and the rumour that leads to the next job), picking on someone, the person
// standing still while you talk, and not being offered a chat when armed or in a car.
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);if(errs.length<4)console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const ok=(name,v,extra='')=>console.log((v?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));
const until=async(f,ms=40000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await W(400);}return false;};
await E(()=>{const G=window.__nb3d.game;G.hour=13;G.money=500;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;G.wanted=0;window.__pin=setInterval(()=>{window.__nb3d.game.hour=13},2000);});
// somebody to talk to: a walker, put 1.2 m from the player
async function setup(){
  return E(()=>{const N=window.__nb3d,G=N.game,P=G.player;G.inCar=0;G.where='out';G.arms.cur='fist';N.eventsMod.ev.choice=null;N.talkMod.talkState.ped=null;
    const clear=(o)=>!N.doors.some(d=>Math.hypot(d.x-o.x,d.z-o.z)<5)&&!N.BDOORS.some(d=>Math.hypot(d.x-o.x,d.z-o.z)<5)&&!N.cityMod.isWater(o.x,o.z); // a door nearby would take the prompt
    const q=N.peds.find(o=>(o.state==='walk'||o.state==='idle')&&o.hp>0&&clear(o))||N.peds.find(clear);if(!q)return null;
    P.x=q.x+1.1;P.z=q.z;P.y=q.y;P.speed=0;q.state='idle';q.t=30;return {id:q.id,x:q.x,z:q.z}});}
let ped=await setup();
if(!ped){await W(8000);ped=await setup();}
ok('setup: there are people about',!!ped,JSON.stringify(ped));
await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id&&n.id.startsWith('talk:')}),30000);
let near=await E(()=>window.__nb3d.game.near);
ok('prompt: someone close by can be talked to',near&&near.id==='talk:'+ped.id&&/話しかける/.test(near.label),JSON.stringify(near));
// armed: the mug prompt, not the chat
await E(()=>{const N=window.__nb3d;N.game.arms.owned.pistol=true;N.game.arms.cur='pistol'});await W(1500);
near=await E(()=>window.__nb3d.game.near);ok('armed: no chat is offered (the mug prompt stays)',!near||!near.id.startsWith('talk:'),JSON.stringify(near));
await E(()=>{window.__nb3d.game.arms.cur='fist'});await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);
// open the conversation
await E(()=>{window.__nb3d.input.action=true});
ok('talk: the action button opens a conversation panel',await until(async()=>E(()=>{const c=window.__nb3d.eventsMod.ev.choice;return c&&/さん（/.test(c.title)}),15000));
let info=await E(()=>{const c=window.__nb3d.eventsMod.ev.choice;return {title:c.title,labels:c.options.map(o=>o.label)}});console.log('  ',JSON.stringify(info));
ok('talk: greet / ask the way / gossip / pick on / leave',info.labels.length===5&&info.labels[0]==='挨拶する'&&info.labels[1]==='道を聞く');
await W(1200);const dom=await E(()=>({btns:document.querySelectorAll('.choiceBox button').length}));ok('talk: it is drawn as a panel',dom.btns===5,JSON.stringify(dom));
// the person stays put and looks at you
const stay=async()=>{const a=await E((id)=>{const q=window.__nb3d.peds.find(o=>o.id===id);const P=window.__nb3d.game.player;return {x:q.x,z:q.z,st:q.state,yaw:q.yaw,want:Math.atan2(P.x-q.x,P.z-q.z)}},ped.id);await W(6000);const c=await E((id)=>{const q=window.__nb3d.peds.find(o=>o.id===id);return {x:q.x,z:q.z,st:q.state}},ped.id);return {moved:Math.hypot(c.x-a.x,c.z-a.z),st:c.st,faces:Math.abs(Math.atan2(Math.sin(a.yaw-a.want),Math.cos(a.yaw-a.want)))<0.4}};
const s1=await stay();ok('talk: the person stands still and faces you while the panel is open',s1.moved<0.3&&s1.st==='idle'&&s1.faces,JSON.stringify(s1));
// greet: neutral reputation
await E(()=>{window.__nb3d.progress.stats.flags.rep=0});
await E(()=>{window.__nb3d.eventsMod.ev.choice.options[0].pick()});
let said=await E(()=>(window.__nb3d.story.talk.queue[0]||{}).text||'');ok('greet: a polite answer at neutral reputation',/こんにちは/.test(said),said);
// release: they walk on after a moment
const rel=await until(async()=>E((id)=>{const q=window.__nb3d.peds.find(o=>o.id===id);return !window.__nb3d.talkMod.talkState.ped},ped.id),20000);ok('greet: afterwards the person is released',rel);
// good name / bad name
const greetWith=async(r)=>{ped=await setup();await E((r)=>{window.__nb3d.progress.stats.flags.rep=r},r);await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);await E(()=>{window.__nb3d.story.talk.queue.length=0;window.__nb3d.eventsMod.ev.choice.options[0].pick()});return E(()=>(window.__nb3d.story.talk.queue[0]||{}).text||'');};
const good=await greetWith(6);ok('greet: a good name is recognised',/評判/.test(good),good);
const bad=await greetWith(-6);ok('greet: a bad name is avoided',/目をそらして/.test(bad),bad);
await E(()=>{window.__nb3d.progress.stats.flags.rep=0});
// ask the way
ped=await setup();await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);
await E(()=>{window.__nb3d.eventsMod.ev.choice.options[1].pick()});
const ask=await E(()=>{const c=window.__nb3d.eventsMod.ev.choice;return c&&{title:c.title,labels:c.options.map(o=>o.label+' '+(o.sub||''))}});console.log('  ask',JSON.stringify(ask));
ok('ask: the kinds of place this city has are offered, with distance and direction',ask&&ask.labels.length>=4&&ask.labels.some(l=>/ラーメン/.test(l))&&ask.labels.some(l=>/コンビニ/.test(l))&&ask.labels.every(l=>/やめる|約\d+m (北|東|南|西)/.test(l)),JSON.stringify(ask&&ask.labels));
await E(()=>{window.__nb3d.game.waypoint=null;window.__nb3d.story.talk.queue.length=0});
const pick=await E(()=>{const N=window.__nb3d,P=N.game.player;const o=N.eventsMod.ev.choice.options.find(o=>/コンビニ/.test(o.label));o.pick();const n=N.placesMod?null:null;return {wp:N.game.waypoint&&{x:Math.round(N.game.waypoint.x),z:Math.round(N.game.waypoint.z)},px:Math.round(P.x),pz:Math.round(P.z),said:(N.story.talk.queue[0]||{}).text||''}});
console.log('  picked',JSON.stringify(pick));
ok('ask: the nearest convenience store goes on the map',!!pick.wp&&Math.hypot(pick.wp.x-pick.px,pick.wp.z-pick.pz)<600);
const dir=await E(()=>{const N=window.__nb3d,P=N.game.player,w=N.game.waypoint;const a=Math.atan2(w.x-P.x,-(w.z-P.z)),k=Math.round(a/(Math.PI/4));return ['北','北東','東','南東','南','南西','西','北西','北'][((k%8)+8)%8]});
ok('ask: the stranger points the right way and says how far',pick.said.includes(dir)&&/\d+m/.test(pick.said)&&/コンビニ|店|STORE|MART|MINI|[A-Za-z]/.test(pick.said),'said "'+pick.said+'" (compass says '+dir+')');
// gossip: a rumour that points at the next job
await E(()=>{const N=window.__nb3d;N.game.waypoint=null;N.progress.story=Math.min(N.progress.story,0);});
ped=await setup();await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);
await E(()=>{window.__nb3d.story.talk.queue.length=0;window.__nb3d.eventsMod.ev.choice.options[2].pick()});
const g=await E(()=>{const N=window.__nb3d;const M=N.story.nextMission(),s=M&&M.start();return {said:(N.story.talk.queue[0]||{}).text||'',wp:N.game.waypoint,start:s&&{x:s.x,z:s.z},here:N.story.missionElsewhere()}});
console.log('  gossip',JSON.stringify(g));
ok('gossip: they tell you something about the neighbourhood',g.said.length>8,g.said);
if(!g.here)ok('gossip: with a job waiting here, the rumour puts it on the map',g.wp&&g.start&&Math.hypot(g.wp.x-g.start.x,g.wp.z-g.start.z)<2,JSON.stringify(g.wp));
// pick on someone: reputation down, they run
ped=await setup();await E(()=>{window.__nb3d.progress.stats.flags.rep=0});await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);
await E(()=>{window.__nb3d.eventsMod.ev.choice.options[3].pick()});await W(1500);
const pr=await E((id)=>{const q=window.__nb3d.peds.find(o=>o.id===id);return {rep:window.__nb3d.progress.stats.flags.rep||0,st:q&&q.state,said:(window.__nb3d.story.talk.queue[0]||{}).text||''}},ped.id);
ok('provoke: reputation drops and the person runs',pr.rep===-1&&(pr.st==='flee'||pr.st==='walk'||pr.st==='cower'),JSON.stringify(pr));
// walking away closes the conversation
ped=await setup();await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);
await E(()=>{window.__nb3d.game.player.x+=9});await W(2500);ok('leave: walking away closes the panel and frees the person',await E(()=>!window.__nb3d.eventsMod.ev.choice&&!window.__nb3d.talkMod.talkState.ped));
// not in a car, not during a scene
await E(()=>{const N=window.__nb3d,G=N.game;const v=N.spawn('sedan',G.player.x+4,G.player.z,0);v.touched=true;G.inCar=v.id});await W(1500);
ok('car: no chat from the driver\'s seat',await E(()=>{const n=window.__nb3d.game.near;return !n||!n.id.startsWith('talk:')}));
await E(()=>{window.__nb3d.game.inCar=0});
// a picture of the panel
ped=await setup();await until(async()=>E(()=>{const n=window.__nb3d.game.near;return n&&n.id.startsWith('talk:')}),20000);await E(()=>{window.__nb3d.input.action=true});await until(async()=>E(()=>!!window.__nb3d.eventsMod.ev.choice),15000);await W(2500);await p.screenshot({path:'jp/talk_panel.png',timeout:180000});
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
