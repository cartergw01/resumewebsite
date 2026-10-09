const fs=require("fs"),path=require("path");const ROOT="/Users/carterwang/Documents/vibe coded projects/resumewebsite";
const postcss=require(path.join(ROOT,"node_modules/postcss"));
const file=path.join(ROOT,"app/globals.css");const before=fs.readFileSync(file,"utf8");
const dead=new Set(JSON.parse(fs.readFileSync(process.argv[2],"utf8")).filter(x=>x.missing.length).map(x=>x.sel));
const matched=new Set(JSON.parse(fs.readFileSync(process.argv[3],"utf8")));
for(const m of matched) dead.delete(m);
const root=postcss.parse(before);let removedSel=0,removedRules=0;
root.walkRules(rule=>{if(rule.parent&&rule.parent.type==="atrule"&&/keyframes/.test(rule.parent.name))return;
  const keep=rule.selectors.filter(s=>!dead.has(s));removedSel+=rule.selectors.length-keep.length;
  if(!keep.length){rule.remove();removedRules++;}else if(keep.length!==rule.selectors.length){{const indent=(rule.raws.before||"").split("\n").pop();rule.selector=keep.join(",\n"+indent);}}});
// Drop at-rules emptied by the above (media queries etc.), repeatedly.
let changed=true;while(changed){changed=false;root.walkAtRules(a=>{if(a.nodes&&a.nodes.length===0&&!/keyframes|font-face|theme|layer/.test(a.name)){a.remove();changed=true;}});}
// Keyframes no longer referenced anywhere in the site.
let corpus="";const walk=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(!/node_modules|\.next/.test(p))walk(p)}else if(/\.(tsx?|css)$/.test(f.name)&&p!==file)corpus+=fs.readFileSync(p,"utf8")}};
for(const d of ["app","components","lib"]) walk(path.join(ROOT,d));
const rest=root.toString();const droppedFrames=[];
root.walkAtRules(/keyframes$/,a=>{const name=a.params.trim();const uses=(rest.match(new RegExp(`\\b${name}\\b`,"g"))||[]).length-1;if(uses<=0&&!new RegExp(`\\b${name}\\b`).test(corpus)){a.remove();droppedFrames.push(name)}});
const after=root.toString().replace(/\n{3,}/g,"\n\n");fs.writeFileSync(file,after);
console.log({removedSel,removedRules,droppedFrames,linesBefore:before.split("\n").length,linesAfter:after.split("\n").length,bytesBefore:before.length,bytesAfter:after.length});
