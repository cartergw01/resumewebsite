// Compare two snapshot dirs: computed styles element by element, and screenshots pixel by pixel.
const path=require("path"),fs=require("fs");const ROOT="/Users/carterwang/Documents/vibe coded projects/resumewebsite";
const {chromium}=require(path.join(ROOT,"node_modules/@playwright/test"));
const [A,B]=process.argv.slice(2);
(async()=>{const keys=fs.readdirSync(A).filter(f=>f.endsWith(".styles.json")).map(f=>f.replace(".styles.json",""));
let styleDiffs=0;const notes=[];
for(const k of keys){const a=JSON.parse(fs.readFileSync(`${A}/${k}.styles.json`)),b=JSON.parse(fs.readFileSync(`${B}/${k}.styles.json`));
  if(a.length!==b.length){notes.push(`${k}: element count ${a.length} vs ${b.length}`);styleDiffs++;continue;}
  for(let i=0;i<a.length;i++){if(a[i][0]!==b[i][0]||a[i][1]!==b[i][1]){styleDiffs++;
    const pa=Object.fromEntries(a[i][1].split(";").filter(Boolean).map(x=>{const j=x.indexOf(":");return [x.slice(0,j),x.slice(j+1)]}));
    const pb=Object.fromEntries(b[i][1].split(";").filter(Boolean).map(x=>{const j=x.indexOf(":");return [x.slice(0,j),x.slice(j+1)]}));
    const props=Object.keys({...pa,...pb}).filter(p=>pa[p]!==pb[p]);
    if(notes.length<30)notes.push(`${k}: ${a[i][0].slice(0,70)} → ${props.slice(0,4).map(p=>`${p}: ${pa[p]} | ${pb[p]}`).join("; ")}`);}}}
const b=await chromium.launch();const p=await b.newPage();const px=[];
for(const k of keys){const ia=fs.readFileSync(`${A}/${k}.png`).toString("base64"),ib=fs.readFileSync(`${B}/${k}.png`).toString("base64");
  const r=await p.evaluate(async([ia,ib])=>{const load=s=>new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.src="data:image/png;base64,"+s});const [x,y]=await Promise.all([load(ia),load(ib)]);
    if(x.width!==y.width||x.height!==y.height)return {size:`${x.width}x${x.height} vs ${y.width}x${y.height}`};
    const c=new OffscreenCanvas(x.width,x.height),g=c.getContext("2d");g.drawImage(x,0,0);const da=g.getImageData(0,0,x.width,x.height).data;g.clearRect(0,0,x.width,x.height);g.drawImage(y,0,0);const db=g.getImageData(0,0,x.width,x.height).data;
    let n=0;for(let i=0;i<da.length;i+=4){if(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2])>24)n++}return {changed:n,total:da.length/4};},[ia,ib]);
  px.push([k,r]);}
await b.close();
console.log("style snapshots:",keys.length,"elements differing:",styleDiffs);notes.forEach(n=>console.log("  ",n));
for(const [k,r] of px) if(r.size||r.changed) console.log("  px",k,JSON.stringify(r));
console.log("screenshots identical:",px.filter(([,r])=>!r.size&&!r.changed).length,"/",px.length);})();
