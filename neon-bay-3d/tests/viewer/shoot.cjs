// Draw car models in the viewer (tests/viewer/viewer.ts) and save one picture per model.
// usage: node tests/viewer/shoot.cjs <bundle.js> <kind[,kind...]> <outdir> [views] [colour]
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const [js,kinds,out,views,colour,extra]=process.argv.slice(2);
const html=path.join(path.dirname(js),'viewer.html');fs.writeFileSync(html,'<!doctype html><meta charset="utf-8"><body><script src="'+path.basename(js)+'"></script>');
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:1600,height:1350}})).newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message,(e.stack||'').slice(0,400)));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,200))});
for(const k of kinds.split(',')){await p.goto('file://'+html+'?k='+k+(views?'&views='+views:'')+(colour?'&c='+encodeURIComponent(colour):'')+(extra?'&'+extra:''));await p.waitForFunction(()=>window.__done,null,{timeout:120000});await p.locator('canvas').screenshot({path:path.join(out,'view_'+k+'.png')});console.log('shot',k);}
await b.close();})();
