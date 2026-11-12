// Usable shops: convenience store (buy, carry, use, hold-up prompt), ramen (ticket + seat), cafe / bar / pharmacy / diner counters, storefront signs.
// usage: node shop.cjs <html> [region]
const {chromium}=require('playwright');
(async()=>{const html=process.argv[2],region=process.argv[3]||'tokyo';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:false})).newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript((r)=>{try{localStorage.setItem('nb3d.debug','1');localStorage.setItem('neonbay3d.settings.v1',JSON.stringify({quality:'medium',tutorialDone:true}));localStorage.setItem('neonbay3d.region',r);}catch(e){}},region);
await p.goto('file://'+html);await p.waitForSelector('.ttl .mbtn.primary:not([disabled])',{timeout:600000});await p.click('.ttl .mbtn.primary');await p.waitForTimeout(2500);
const E=(f,a)=>p.evaluate(f,a),W=(ms)=>p.waitForTimeout(ms);
const near=()=>E(()=>{const n=window.__nb3d.game.near;return n?n.id+'|'+n.label:'none'});
const waitNear=async(pre,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){const n=await near();if(n.startsWith(pre))return n;await W(300);}return 'NONE:'+(await near());};
const act=async()=>{const w0=await E(()=>window.__nb3d.game.where+'|'+window.__nb3d.game.ui+'|'+window.__nb3d.game.fadeT);await E(()=>{window.__nb3d.input.action=true});for(let k=0;k<40;k++){await W(400);const w1=await E(()=>window.__nb3d.game.where+'|'+window.__nb3d.game.ui+'|'+window.__nb3d.game.fadeT);if(w1!==w0||!(await E(()=>window.__nb3d.input.action)))break;}await W(900);};
const settle=async()=>{for(let k=0;k<50;k++){await W(1000);if(await E(()=>window.__nb3d.cityStream.pending)===0&&k>2)break;}};
const st=()=>E(()=>{const N=window.__nb3d,G=N.game;return {where:G.where,name:N.INTERIORS[G.where]&&N.INTERIORS[G.where].name,money:G.money,hp:Math.round(G.health),items:G.items,ui:G.ui,buffs:Object.fromEntries(Object.entries(N.shopsMod.buffs).map(([k,v])=>[k,Math.round(v)])),ticket:N.shopsMod.meal.ticket&&N.shopsMod.meal.ticket.id,toast:G.toast}});
await E(()=>{const G=window.__nb3d.game;G.money=1000;G.hour=14;G.weather.kind='clear';G.weather.cloud=0;G.weather.rain=0;G.weather.next=9999;});
// shop doors by type
const D=await E(()=>{const N=window.__nb3d,out={},cnt={};for(const d of N.BDOORS){if(d.kind!=='shop')continue;const k=N.cityMod&&0;const key=(N.shopKeyOf||(()=>''))(d);void k;void key;}
  // the shop type is not exported on the hook: derive it from the interior generator through the label lists
  return null;});
const doors=await E(()=>{const N=window.__nb3d,B=N.BDOORS.filter(d=>d.kind==='shop'),by={};const names={konbini:['QWIK 24','NEON MART','BAY 24','よるマート'],ramen:['ラーメン 一番','麺屋 潮','RAMEN TOKO','博多 ラーメン'],cafe:['CAFE MOKA','BEAN BAY','カフェ 灯','HARBOR COFFEE'],bar:['BAR NIGHTJAR','NEON LOUNGE','BAR 月','BLUE NOTE'],pharmacy:['BAY 薬局','GREEN CROSS','ドラッグ ベイ','CARE+'],boutique:['BOUTIQUE LUNA','MODE BAY','STUDIO 8','SELECT']};
  const cnt={};for(const d of B){for(const k in names)if(names[k].includes(d.label)){cnt[k]=(cnt[k]||0)+1;const dist=Math.hypot(d.x,d.z);if(!by[k]||dist<by[k].dist)by[k]={id:d.id,x:d.x,z:d.z,ang:d.ang,label:d.label,dist};}}
  return {by,cnt,total:B.length};});
console.log('shop doors',JSON.stringify({cnt:doors.cnt,total:doors.total,konbini:doors.by.konbini&&doors.by.konbini.label}));
const goDoor=async(d)=>{await E((d)=>{const G=window.__nb3d.game;if(G.where!=='out'){G.where='out';}G.ui='';G.player.x=d.x+Math.sin(d.ang)*0.4;G.player.z=d.z+Math.cos(d.ang)*0.4;G.player.y=0.2;},d);return waitNear(d.id);};
const stand=(x,z)=>E(([x,z])=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];G.player.x=I.ox+x;G.player.z=I.oz+z;},[x,z]);
// ---- exterior: the storefront sign by day and at night ----
{const d=doors.by.konbini;await E((d)=>{const G=window.__nb3d.game,nx=Math.sin(d.ang),nz=Math.cos(d.ang);G.player.x=d.x+nx*9;G.player.z=d.z+nz*9;window.__nb3dCamOverride={p:[d.x+nx*13-nz*5,2.6,d.z+nz*13+nx*5],t:[d.x,3.2,d.z]};},d);await settle();await W(1500);await p.screenshot({path:'jp/shop_'+region+'_front_day.png',timeout:180000});
 await E(()=>{window.__nb3d.game.hour=21});await W(2500);await p.screenshot({path:'jp/shop_'+region+'_front_night.png',timeout:180000});await E(()=>{window.__nb3d.game.hour=14;window.__nb3dCamOverride=null});}
// ---- convenience store ----
console.log('konbini door',await goDoor(doors.by.konbini));await act();console.log('inside',JSON.stringify(await st()));
await E(()=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];window.__nb3dCamOverride={p:[I.ox-1.5,-50+2.6,I.oz+5.6],t:[I.ox+0.5,-50+1.1,I.oz-4]};});await W(2500);await p.screenshot({path:'jp/shop_'+region+'_konbini_in.png',timeout:180000});
await E(()=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];window.__nb3dCamOverride={p:[I.ox+1.2,-50+2.2,I.oz-1.5],t:[I.ox+5.2,-50+1.2,I.oz+4.2]};});await W(2000);await p.screenshot({path:'jp/shop_'+region+'_konbini_counter.png',timeout:180000});
await E(()=>{window.__nb3dCamOverride=null;window.__nb3d.game.health=40;});
await stand(6.2,2.5);console.log('counter prompt',await waitNear('shop:konbini'));await act();console.log('panel',JSON.stringify(await st()));
await p.screenshot({path:'jp/shop_'+region+'_konbini_panel.png'});
// the eating scene covers the screen for a few seconds: tap it away before the next purchase
const noEat=async()=>{for(let k=0;k<3&&(await p.locator('.eatWrap').count());k++){await E(()=>{const e=document.querySelector('.eatWrap');if(e)e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));});await W(400);}};
const eatShot=async(n)=>{for(let k=0;k<20&&!(await p.locator('.eatWrap').count());k++)await W(200);const on=await p.locator('.eatWrap').count();if(on){await W(1600);await p.screenshot({path:'jp/eat_'+n+'.png',timeout:180000});}const txt=on?await p.locator('.eatCard').innerText():'';await noEat();return on?'scene: '+txt.replace(/\n/g,' '):'NO EAT SCENE';};
const buy=async(name)=>{await noEat();await p.locator('.shopRow',{hasText:name}).locator('button').click();await W(250);};
await noEat();await p.locator('.shopRow',{hasText:'おにぎり'}).locator('button').click();await W(350);await p.screenshot({path:'jp/shop_bagfly_'+region+'.png',timeout:180000});console.log('flying into the bag',await p.locator('.flyItem').count(),'| bag',await p.locator('.shopBag').innerText());await W(800);await buy('おにぎり');await buy('エナジードリンク');await buy('からあげ');
console.log('after buying',JSON.stringify(await st()),'msg:',await p.textContent('.shopMsg').catch(()=>''));
await noEat();await p.locator('.shop .pHome').click();await W(300);
console.log('chips',JSON.stringify(await p.locator('.itemChip').allTextContents()));
await p.locator('.itemChip',{hasText:'🍙'}).click();await W(300);console.log('ate onigiri',JSON.stringify(await st()),'|',await eatShot('onigiri_'+region));
await noEat();await p.locator('.itemChip',{hasText:'⚡'}).click();await W(300);
console.log('energy: stamina while sprinting',JSON.stringify(await E(async()=>{const N=window.__nb3d,G=N.game;return {free:N.shopsMod.freeSprint(),buff:Math.round(N.shopsMod.buffs.energy)}})));
// gun drawn: the till becomes a hold-up
await E(()=>{const A=window.__nb3d.game.arms;A.owned.pistol=true;A.ammo.pistol=24;A.mag.pistol=12;A.cur='pistol';});console.log('armed prompt',await waitNear('rob'));
await E(()=>{window.__nb3d.game.arms.cur='fist'});console.log('unarmed prompt',await waitNear('shop:konbini'));
// save / load keeps the pocket
console.log('saved items',await E(()=>{window.__nb3d.game.started&&0;const s=JSON.parse(localStorage.getItem('neonbay3d.save.v1')||'{}');return JSON.stringify(s.items)}));
// ---- ramen: ticket machine, then a booth ----
console.log('ramen door',await goDoor(doors.by.ramen));await act();console.log('inside',JSON.stringify(await st()));
await E(()=>{const N=window.__nb3d,G=N.game,I=N.INTERIORS[G.where];window.__nb3dCamOverride={p:[I.ox-5.2,-50+2.3,I.oz+3.6],t:[I.ox+1.5,-50+1.1,I.oz-2.6]};});await W(2500);await p.screenshot({path:'jp/shop_'+region+'_ramen_in.png',timeout:180000});await E(()=>{window.__nb3dCamOverride=null});
await stand(0.6,-0.95);console.log('seat without ticket',await waitNear('ramen:eat'));await act();console.log(' ->',(await st()).toast);
await stand(5.4,3.2);console.log('machine',await waitNear('shop:ramen'));await act();await p.screenshot({path:'jp/shop_'+region+'_ramen_panel.png'});
await E(()=>{window.__nb3d.game.health=30});await buy('博多ラーメン');await W(1200);console.log('ticket',JSON.stringify(await st()));
await stand(0.6,-0.95);console.log('seat with ticket',await waitNear('ramen:eat'));await act();console.log('eating',await eatShot('ramen_'+region));await W(1500);console.log('ate',JSON.stringify(await st()));
// ---- the other counters ----
for(const k of ['cafe','bar','pharmacy','boutique']){const d=doors.by[k];if(!d){console.log(k,'no door');continue;}
  await goDoor(d);await act();const I=await E(()=>{const N=window.__nb3d,I=N.INTERIORS[N.game.where];return {name:I.name,acts:I.acts}});if(!I.acts){console.log(k,'NO ACTS',I.name);continue;}
  await stand(I.acts[0].x,I.acts[0].z);const n=await waitNear(I.acts[0].id);await act();const s=await st();
  if(k==='boutique'){console.log(k,n,'studio:',await p.locator('.studio,.styleWrap,[class*=style]').count());await p.keyboard.press('Escape');await p.locator('button',{hasText:'閉じる'}).first().click({timeout:3000}).catch(()=>{});await p.locator('button',{hasText:'完了'}).first().click({timeout:2000}).catch(()=>{});await W(500);continue;}
  const first=await p.locator('.shopRow b').first().textContent();await p.locator('.shopRow button').first().click();await W(300);console.log(' eating',await eatShot(k+'_'+region));console.log(k,n,'|',first,'|',JSON.stringify({money:(await st()).money,buffs:(await st()).buffs,msg:await p.textContent('.shopMsg').catch(()=>'')}));
  await noEat();await p.locator('.shop .pHome').click();await W(300);}
// ---- the hand-made diner and the first QWIK 24 ----
for(const id of ['diner','store']){const d=await E((id)=>{const q=window.__nb3d.doors.find(o=>o.id===id);return q&&{id:q.id,x:q.x,z:q.z,ang:q.ang}},id);if(!d){console.log(id,'no door in this city');continue;}
  console.log(id,'door',await goDoor(d));await act();const s=await st();console.log(id,'inside',s.name,s.where);
  if(id==='diner'){await stand(0,-3.3);console.log(' prompt',await waitNear('shop:diner'));}else{await stand(6.2,2.5);console.log(' prompt',await waitNear('shop:konbini'));}}
console.log('errors',JSON.stringify(errs.slice(0,10)));await b.close();})();
