// tunnel camera stays in the bore + train sound levels + the portal again + a mountain view. usage: node tun3.cjs <html> <region>
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'fukuoka';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await (await b.newContext({viewport:{width:800,height:450}})).newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'medium',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const env=(hr)=>E((hr)=>{const G=window.__nb3d.game;G.hour=hr;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.wet=0;G.weather.next=9999;},hr);
const shot=async(n)=>p.screenshot({path:'jp/t3_'+region+'_'+n+'.png',timeout:240000}).then(()=>console.log('shot',n)).catch(e=>console.log('shot fail',n,e.message.slice(0,80)));
const I=await E(()=>{const C=window.__nb3d.cityMod;return {has:C.SHIN.has,T:C.TUN,gate:C.SHIN.gate}});
await env(10);
await E(()=>{const G=window.__nb3d.game;window.__nb3dCamOverride={p:[0,90,0],t:[-900,120,300]};G.player.x=0;G.player.z=6;});await settle();await W(1500);await shot('mtn');
if(I.has){
  const T=I.T;
  await E(([T])=>{const G=window.__nb3d.game;window.__nb3dCamOverride={p:[T.x+10,26,T.portal+80],t:[T.x,20,T.portal]};G.player.x=T.x+10;G.player.z=T.portal+90;},[T]);await settle();await W(1500);await shot('portal');
  // swing the on-foot camera sideways first, then board: the camera must end up behind the train, inside the bore
  await E(()=>{window.__nb3dCamOverride=null;const G=window.__nb3d.game;G.cam.yaw=1.3;window.__nb3d.japanMod.shinAction('jp:board:14');});await W(1200);
  await E(([T])=>{const v=window.__nb3d.playerCar();v.z=T.portal-60;v.vz=-42;},[T]);
  for(let k=0;k<12;k++){await W(500);const tun=await E(()=>window.__nb3d.game.tunnel);if(tun>0.95)break;}
  console.log('bore',JSON.stringify(await E(()=>{const N=window.__nb3d,v=N.playerCar();return {tun:N.game.tunnel.toFixed(2),camYaw:N.game.cam.yaw.toFixed(2),trainYaw:v.yaw.toFixed(2),z:Math.round(v.z),snd:N.trainAudioState()}})));
  await shot('bore');
  // full power at speed: inverter, rolling, wind
  await E(()=>{window.__nb3d.input.gas=true;});await W(2500);
  console.log('power',JSON.stringify(await E(()=>({kmh:Math.round(Math.abs(window.__nb3d.playerCar().vz)*3.6),snd:window.__nb3d.trainAudioState()}))));
  await E(()=>{window.__nb3d.input.gas=false;const v=window.__nb3d.playerCar();window.__nb3d.remove(v);window.__nb3d.game.inCar=0;});await W(1500);
  console.log('off train',JSON.stringify(await E(()=>({snd:window.__nb3d.trainAudioState()}))));
}
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
