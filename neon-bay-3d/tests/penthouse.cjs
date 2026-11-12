// The tower penthouse: walk in, out through the glass door onto the balcony (and not over the rail), the telescope view,
// the 3D city below by day and by night. usage: node penthouse.cjs <html>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>{errs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message,(e.stack||'').slice(0,300))});p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(()=>{try{if(!localStorage.getItem('nb3d.testinit')){localStorage.clear();localStorage.setItem('nb3d.testinit','1');localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'low',tutorialDone:true}));localStorage.setItem('neonbay3d.region','tokyo');}}catch(e){}});
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=30000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<30&&(await E(()=>window.__nb3d.input.action));k++)await W(300);await W(800);};
const hour=(h)=>E((h)=>{const G=window.__nb3d.game;G.hour=h;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;},h);
// own it (so the inside works as a home) and go in
await E(()=>{const G=window.__nb3d.game;G.homes=['tower'];G.money=5000;const d=window.__nb3d.doors.find(o=>o.id==='h_tower');G.player.x=d.x+Math.sin(d.ang)*0.4;G.player.z=d.z+Math.cos(d.ang)*0.4;G.player.y=0.2;});
console.log('door',await waitNear('h_tower'));await act();
const I=await E(()=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];return {where:G.where,name:I&&I.name,ox:I.ox,oz:I.oz,d:I.d,bal:I.balcony}});console.log('inside',JSON.stringify(I));
const put=(x,z)=>E(([x,z])=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];G.player.x=I.ox+x;G.player.z=I.oz+z;},[x,z]);
const local=()=>E(()=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];return [+(G.player.x-I.ox).toFixed(2),+(G.player.z-I.oz).toFixed(2)]});
// walk north through the sliding door onto the balcony, then try to keep going (the rail stops you)
await put(-1,-5);await E(()=>{const N=window.__nb3d;N.game.cam.yaw=0;N.input.joyActive=true;N.input.joyX=0;N.input.joyY=1;});
for(let k=0;k<40;k++){await W(400);const l=await local();if(l[1]<-11)break;}
await E(()=>{const N=window.__nb3d;N.input.joyActive=false;N.input.joyY=0;});console.log('walked north to',JSON.stringify(await local()),'(balcony edge is z',-I.d/2-I.bal.depth,')');
// the glass beside the door stops you
await put(-6,-6);await E(()=>{const N=window.__nb3d;N.game.cam.yaw=0;N.input.joyActive=true;N.input.joyY=1;});for(let k=0;k<15;k++)await W(400);await E(()=>{const N=window.__nb3d;N.input.joyActive=false;N.input.joyY=0;});console.log('into the glass at x=-6 ->',JSON.stringify(await local()));
// screenshots: the room looking out, day and night; from the balcony rail
const shot=async(n,P,T,h)=>{await hour(h);await E(([P,T])=>{const N=window.__nb3d,I=N.INTERIORS[N.game.where];window.__nb3dCamOverride={p:[I.ox+P[0],-50+P[1],I.oz+P[2]],t:[I.ox+T[0],-50+T[1],I.oz+T[2]]};},[P,T]);await W(3500);await p.screenshot({path:'jp/pent_'+n+'.png',timeout:180000});console.log('shot',n);};
await shot('room_day',[6,1.7,6],[-3,1.2,-12],14);await shot('room_night',[6,1.7,6],[-3,1.2,-12],21.5);
await shot('balcony_day',[-3,1.7,-9.5],[-60,-90,-300],10);await shot('balcony_dusk',[-3,1.7,-9.5],[-60,-90,-300],18.0);await shot('balcony_night',[-3,1.7,-9.5],[-60,-90,-300],22);
await E(()=>{window.__nb3dCamOverride=null});
// the telescope
await put(1.0,-10.0);console.log('telescope',await waitNear('home:view'));await act();await W(3000);console.log('view mode',await E(()=>window.__nb3d.game.toast));await p.screenshot({path:'jp/pent_telescope.png',timeout:180000});
await act();console.log('back',await E(()=>window.__nb3d.game.toast));
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
