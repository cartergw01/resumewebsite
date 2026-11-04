// Bake Three's existing room lighting once, rather than on every visitor's GPU.
// Run: node scripts/blender/bake_workshop_environment.mjs
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { DataUtils } from "three";
const require = createRequire(import.meta.url);
const webpackModule = require("next/dist/compiled/webpack/webpack"); webpackModule.init();
const root = path.resolve(import.meta.dirname, "../..");
const scratch = await mkdtemp(path.join(tmpdir(), "workshop-lighting-"));
let browser;
try {
  const entry = path.join(scratch, "entry.js");
  await writeFile(entry, `import * as THREE from ${JSON.stringify(require.resolve("three"))};
import { RoomEnvironment } from ${JSON.stringify(path.join(root,"node_modules/three/examples/jsm/environments/RoomEnvironment.js"))};
window.bake = async () => {
 const renderer = new THREE.WebGLRenderer();
 const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer);
 const target = generator.fromScene(room, .04, .1, 100, {size:64});
 const data = new Uint16Array(target.width*target.height*4);
 await renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height,data);
 const result = {width:target.width,height:target.height,data:Array.from(data)};
 target.dispose();room.dispose();generator.dispose();renderer.dispose();renderer.forceContextLoss();
 return result;
};`);
  await new Promise((resolve,reject) => webpackModule.webpack({mode:"none",optimization:{minimize:false},entry,output:{path:scratch,filename:"bake.js"},resolve:{modules:[path.join(root,"node_modules")]},performance:{hints:false}},(error,stats)=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):resolve()));
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.addScriptTag({content:await readFile(path.join(scratch,"bake.js"),"utf8")});
  const {width,height,data} = await page.evaluate(()=>window.bake());
  const pixels = new Uint8Array(width*height*4);
  for(let i=0;i<pixels.length;i+=4){
    const rgb=[0,1,2].map(channel=>Math.max(0,DataUtils.fromHalfFloat(data[i+channel])));
    const peak=Math.max(...rgb);
    if(peak<1e-32)continue;
    const exponent=Math.floor(Math.log2(peak))+1, scale=256/2**exponent;
    rgb.forEach((value,channel)=>{pixels[i+channel]=Math.min(255,Math.floor(value*scale));});
    pixels[i+3]=exponent+128;
  }
  const encoded=[];
  for(let y=0;y<height;y++){
    encoded.push(2,2,width>>8,width&255);
    for(let channel=0;channel<4;channel++){
      let x=0;
      while(x<width){
        const value=pixels[(y*width+x)*4+channel];
        let run=1;while(run<127&&x+run<width&&pixels[(y*width+x+run)*4+channel]===value)run++;
        if(run>=4){encoded.push(128+run,value);x+=run;continue;}
        const literal=[];
        while(x<width&&literal.length<128){
          const next=pixels[(y*width+x)*4+channel];
          let repeated=1;while(repeated<4&&x+repeated<width&&pixels[(y*width+x+repeated)*4+channel]===next)repeated++;
          if(repeated===4&&literal.length)break;
          literal.push(next);x++;
        }
        encoded.push(literal.length,...literal);
      }
    }
  }
  const bytes=Buffer.concat([Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`),Buffer.from(encoded)]);
  const name=`environment-${createHash("sha256").update(bytes).digest("hex").slice(0,8)}.hdr`;
  await writeFile(path.join(root,"public/workshop",name),bytes);
  await writeFile(path.join(root,"lib/workshop-environment.json"),JSON.stringify({src:`/workshop/${name}`,width,height},null,2)+"\n");
  console.log(`Baked ${width} × ${height} room lighting: ${Math.round(bytes.length/1024)} KB`);
} finally { await browser?.close(); await rm(scratch,{recursive:true,force:true}); }
