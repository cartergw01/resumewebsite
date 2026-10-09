const fs=require("fs");const [A,B]=process.argv.slice(2);
const norm=s=>s.replace(/__[A-Za-z_]+?_[0-9a-f]{6}/g,"__FONT").replace(/__variable_[0-9a-f]{6}/g,"__VAR");
const load=f=>JSON.parse(fs.readFileSync(f)).map(([id,s])=>[norm(id),norm(s)]).filter(([id])=>!/^(HTML|HEAD|META|LINK|SCRIPT|STYLE|TITLE|NOSCRIPT|BODY)\b/.test(id)||id.startsWith("BODY"));
let total=0,diffs=0;const notes=[];
for(const k of fs.readdirSync(A).filter(f=>f.endsWith(".styles.json"))){let a=load(`${A}/${k}`),b=load(`${B}/${k}`);
  // Align on element identity; unmatched elements are reported.
  let i=0,j=0;while(i<a.length&&j<b.length){if(a[i][0]===b[j][0]){total++;if(a[i][1]!==b[j][1]){const pa=Object.fromEntries(a[i][1].split(";").filter(Boolean).map(x=>[x.slice(0,x.indexOf(":")),x.slice(x.indexOf(":")+1)]));const pb=Object.fromEntries(b[j][1].split(";").filter(Boolean).map(x=>[x.slice(0,x.indexOf(":")),x.slice(x.indexOf(":")+1)]));const props=Object.keys({...pa,...pb}).filter(p=>pa[p]!==pb[p]);if(props.length)diffs++;if(props.length&&notes.length<40)notes.push(`${k} ${a[i][0].slice(0,60)}: ${props.slice(0,5).map(p=>`${p}=${(pa[p]||"").slice(0,40)}→${(pb[p]||"").slice(0,40)}`).join(" ; ")}`)}i++;j++;}
    else{const ahead=b.slice(j,j+5).findIndex(x=>x[0]===a[i][0]);if(ahead>0){notes.push(`${k} only after: ${b.slice(j,j+ahead).map(x=>x[0].slice(0,50)).join(", ")}`);j+=ahead}else{notes.push(`${k} only before: ${a[i][0].slice(0,50)}`);i++}}}}
console.log("elements compared:",total,"with any computed-style difference:",diffs);notes.forEach(n=>console.log("  ",n));
