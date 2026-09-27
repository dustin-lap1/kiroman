const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'fs';
const b = await chromium.launch();
const pg = await b.newPage({viewport:{width:1920,height:1080}});
pg.on('pageerror',e=>console.log('ERR',e.message));pg.on('console',m=>{if(m.type()=='error')console.log('CONSOLE',m.text())});
await pg.goto('file://'+process.cwd()+'/'+(process.env.PAGE||'index.html'));await pg.evaluate(()=>window.ready);await pg.waitForTimeout(500);
const OUT=process.env.OUT||'stills';fs.mkdirSync(OUT,{recursive:true});
for (const t of process.argv.slice(2).map(Number)){await pg.evaluate(t=>render(t),t);await pg.screenshot({path:`${OUT}/t${String(t).padStart(6,'0')}.jpg`,type:'jpeg',quality:80});}
await b.close();
