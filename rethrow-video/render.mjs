const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import { spawn } from 'child_process';
const [,, idx, n, total] = process.argv; const FPS=30;
const frames=Math.ceil(Number(total)*FPS); const per=Math.ceil(frames/Number(n));
const a=Number(idx)*per, b=Math.min(frames,a+per);
const b0 = await chromium.launch();
const pg = await b0.newPage({viewport:{width:1920,height:1080}});
await pg.goto('file://'+process.cwd()+'/'+(process.env.PAGE||'index.html'));await pg.evaluate(()=>window.ready);await pg.waitForTimeout(800);
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-r',String(FPS),(process.env.SEGDIR||'.')+`/seg${idx}.mp4`],{stdio:['pipe','inherit','inherit']});
for(let f=a;f<b;f++){await pg.evaluate(t=>render(t),f/FPS);const buf=await pg.screenshot({type:'jpeg',quality:94});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(f%300==0)console.log(`w${idx} ${f}/${b}`)}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b0.close();console.log(`w${idx} done`);
