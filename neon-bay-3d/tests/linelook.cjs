// Screenshots along the Tokaido line (no driving): Tokyo, suburbs, rice fields, a tunnel portal, passing a station,
// Mt Fuji from the right window, the sea. usage: node linelook.cjs <html>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message)});
await p.addInitScript(()=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}}catch(e){}});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
await E(()=>{const G=window.__nb3d.game;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;window.__nb3d.lineMod.startLine('osaka','seat');});await W(3000);
for(const [km,view,n,h] of [[2,0,'tokyo',11],[33,1,'suburb',11],[133,2,'paddy',11],[97.7,0,'portal',11],[341,0,'station',11],[118,1,'fuji',11],[75,2,'sea',16.5],[352,3,'outside',11]]){
  await E(([km,view,h])=>{const L=window.__nb3d.lineMod.line;L.s=km*1000;L.view=view;window.__nb3d.game.hour=h;},[km,view,h]);await W(5000);await p.screenshot({path:'jp/look_'+n+'.png',timeout:180000});console.log('shot',n);}
console.log('errors',JSON.stringify(errs));await b.close();})();
