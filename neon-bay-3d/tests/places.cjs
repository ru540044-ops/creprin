// The map's places: filter chips, the nearest list, guide and skip to each kind (deer crackers, stalls, shrines/temples,
// stations, ramen, convenience stores), checking the right prompt is there on arrival. usage: node places.cjs <html> [region]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'nara';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message)});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(re,ms=30000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(re.test(n))return n;await W(300);}return 'NONE:'+(await near());};
const click=(sel,text)=>E(([sel,text])=>{const b=[...document.querySelectorAll(sel)].find(b=>b.innerText.includes(text));if(b)b.click();return b?b.innerText.replace(/\n/g,' '):null},[sel,text]);
const openMap=async()=>{await p.locator('.minimap').click();await p.waitForSelector('.placeCats',{timeout:60000});await W(800);};
await E(()=>{const G=window.__nb3d.game;G.hour=12;G.weather.kind='clear';G.weather.rain=0;G.weather.next=9999;G.money=500;});
await openMap();await W(2500);await p.screenshot({path:'jp/places_map_'+region+'.png',timeout:180000});
console.log('chips',await E(()=>[...document.querySelectorAll('.placeCats button')].map(b=>b.innerText).join(' / ')));
console.log('list (all)',await E(()=>[...document.querySelectorAll('.placeRow')].map(r=>r.innerText.replace(/\n/g,' ')).join(' || ')));
// each kind: pick its chip, skip to the nearest, check where we are and what the action button offers
const kinds=[['鹿せんべい',/nara:senbei/],['屋台',/jp:yatai/],['神社・寺',/jp:omikuji|jp:wait/],['駅・電車',/jp:train|jp:narast|jp:yamato|jp:shin/],['ラーメン',/^b\d+\|/],['コンビニ',/^b\d+\||^store/]];
for(const [chip,re] of kinds){
  if(!(await p.locator('.placeCats').count()))await openMap();
  const c=await click('.placeCats button',chip);if(!c){console.log(chip,'no chip');continue;}await W(800);
  const row=await E(()=>{const r=document.querySelector('.placeRow');return r?r.innerText.replace(/\n/g,' '):null});if(!row){console.log(chip,'no places in this city');continue;}
  const before=await E(()=>{const G=window.__nb3d.game;return {x:G.player.x,z:G.player.z,h:G.hour}});
  await click('.placeRow button','スキップ');await W(2500);
  const after=await E(()=>{const G=window.__nb3d.game;return {x:G.player.x,z:G.player.z,h:G.hour,toast:G.toast,map:!!document.querySelector('.placeCats')}});
  console.log(chip,'|',row,'| moved',Math.round(Math.hypot(after.x-before.x,after.z-before.z))+'m','| clock +'+Math.round(((after.h-before.h+24)%24)*60)+'min','|',after.toast,'| map closed',!after.map,'| prompt',await waitNear(re));
}
// guide: sets the destination and closes the map
await openMap();await click('.placeCats button','神社・寺');await W(600);await click('.placeRow button','案内');await W(800);
console.log('guide',JSON.stringify(await E(()=>({wp:window.__nb3d.game.waypoint,toast:window.__nb3d.game.toast}))));
// skip to the destination
await openMap();console.log('skip to waypoint button',await click('.row button','目的地へスキップ'));await W(1500);console.log(' ->',await E(()=>JSON.stringify({wp:window.__nb3d.game.waypoint,toast:window.__nb3d.game.toast})));
// refused while wanted
await E(()=>{window.__nb3d.game.wanted=2});await openMap();await click('.placeCats button','コンビニ');await W(600);await click('.placeRow button','スキップ');await W(800);console.log('wanted',await E(()=>window.__nb3d.game.toast),'| map still open',await E(()=>!!document.querySelector('.placeCats')));
await E(()=>{window.__nb3d.game.wanted=0});await p.screenshot({path:'jp/places_list_'+region+'.png',timeout:180000});
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
