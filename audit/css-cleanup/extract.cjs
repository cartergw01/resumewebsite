// List every selector in app/globals.css with its source line and whether its
// class names exist anywhere in the site's code (outside globals.css).
const fs=require("fs"),path=require("path");const ROOT="/Users/carterwang/Documents/vibe coded projects/resumewebsite";
const postcss=require(path.join(ROOT,"node_modules/postcss"));
const css=fs.readFileSync(path.join(ROOT,"app/globals.css"),"utf8");
const corpus=[];const walk=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(!/node_modules|\.next/.test(p))walk(p)}else if(/\.(tsx?|jsx?|mdx?|json|html)$/.test(f.name))corpus.push(fs.readFileSync(p,"utf8"))}};
for(const d of ["app","components","lib","content","public"]) if(fs.existsSync(path.join(ROOT,d))) walk(path.join(ROOT,d));
const text=corpus.join("\n");
// Class names assembled at runtime, e.g. `world-${id}`: any class with such a
// prefix counts as present.
const prefixes=[...text.matchAll(/([a-zA-Z][\w-]*-)\$\{/g)].map(m=>m[1]);
const seen=new Map();const present=c=>prefixes.some(p=>c.startsWith(p))||(()=>{if(!seen.has(c))seen.set(c,new RegExp(`(^|[^\\w-])${c.replace(/[-]/g,"\\-")}([^\\w-]|$)`).test(text));return seen.get(c)})();
const root=postcss.parse(css);const out=[];
root.walkRules(rule=>{if(rule.parent&&rule.parent.type==="atrule"&&/keyframes/.test(rule.parent.name))return;
  const ctx=[];let p=rule.parent;while(p&&p.type!=="root"){if(p.type==="atrule")ctx.unshift("@"+p.name+" "+p.params);else if(p.type==="rule")ctx.unshift(p.selector);p=p.parent}
  for(const sel of rule.selectors){const classes=[...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m=>m[1]);
    const missing=classes.filter(c=>!present(c));
    out.push({line:rule.source.start.line,ctx:ctx.join(" | "),sel,classes,missing});}});
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));
const impossible=out.filter(x=>x.missing.length);
console.log("selectors",out.length,"with a class missing from all source:",impossible.length);
const tokens={};impossible.forEach(x=>x.missing.forEach(c=>tokens[c]=(tokens[c]||0)+1));console.log(Object.entries(tokens).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+"×"+n).join(" "));
