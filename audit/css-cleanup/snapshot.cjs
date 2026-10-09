// node snapshot.cjs <outDir> [selectors.json]
// For every route × width × scroll state: a PNG screenshot, the computed style
// of every element, and (optionally) which candidate selectors match anything.
const path = require("path"), fs = require("fs");
const ROOT = "/Users/carterwang/Documents/vibe coded projects/resumewebsite";
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"));
const out = process.argv[2], selFile = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const candidates = selFile ? JSON.parse(fs.readFileSync(selFile, "utf8")).filter(x => x.missing.length).map(x => x.sel) : [];
const routes = ["/", "/2.0", "/2.0#work", "/2.0#writing", "/2.0#projects", "/2.0#hello", "/work", "/writing", "/projects", "/resume", "/new"];
const slug = r => r.replace(/[^a-z0-9]+/gi, "_") || "root";
(async () => {
  const b = await chromium.launch();
  const matched = new Set();
  for (const [w, h, mobile] of [[1280, 800, false], [390, 844, true]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const p = await c.newPage();
    for (const r of routes) {
      for (const scroll of r.startsWith("/2.0") ? [0] : [0, 600]) {
        await p.goto("http://127.0.0.1:3300" + r, { waitUntil: "load" });
        await p.waitForTimeout(1500);
        if (scroll) { await p.evaluate(y => scrollTo(0, y), scroll); await p.waitForTimeout(600); }
        const key = `${w}-${slug(r)}-${scroll}`;
        await p.screenshot({ path: `${out}/${key}.png`, fullPage: !r.startsWith("/2.0") });
        const data = await p.evaluate(cands => {
          const strip = sel => sel.replace(/::?(before|after|placeholder|selection|marker|backdrop|-webkit-[a-z-]+)(\([^)]*\))?/g, "")
            .replace(/:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|empty)(?![\w-])/g, "") || "*";
          const hits = cands.filter(sel => { try { return Boolean(document.querySelector(strip(sel))); } catch { return true; } });
          const styles = [];
          const all = document.querySelectorAll("*");
          for (const el of all) {
            for (const pseudo of [null, "::before", "::after"]) {
              const cs = getComputedStyle(el, pseudo);
              if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
              let s = "";
              for (let i = 0; i < cs.length; i++) { const n = cs[i]; s += n + ":" + cs.getPropertyValue(n) + ";"; }
              const id = el.tagName + (el.id ? "#" + el.id : "") + "." + (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").trim().replace(/\s+/g, ".") + (pseudo || "");
              styles.push([id, s]);
            }
          }
          return { hits, styles };
        }, candidates);
        data.hits.forEach(x => matched.add(x));
        fs.writeFileSync(`${out}/${key}.styles.json`, JSON.stringify(data.styles));
      }
    }
    await c.close();
  }
  if (selFile) fs.writeFileSync(`${out}/matched-candidates.json`, JSON.stringify([...matched], null, 1));
  console.log("done; candidate selectors that matched somewhere:", matched.size);
  await b.close();
})();
