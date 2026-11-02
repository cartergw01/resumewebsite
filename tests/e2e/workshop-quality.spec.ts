import { pickUp } from "./workshop-actions";
import { expect, test } from "@playwright/test";

test("object browsing reuses one renderer and stays idle between interactions", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Chromium provides the performance instrumentation.");
  await page.addInitScript(() => {
    const probe = { draws: 0, longTasks: [] as number[] };
    Object.assign(window, { workshopProbe: probe });
    new PerformanceObserver(list => probe.longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: "longtask", buffered: true });
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const draw = prototype.drawElements;
      prototype.drawElements = function (...args) {
        if (this.canvas instanceof HTMLCanvasElement && this.canvas.closest("[data-model-state]")) probe.draws++;
        return draw.apply(this, args);
      };
    }
  });
  await page.goto("/#projects");
  const start = performance.now();
  await pickUp(page,"basketball");
  await expect(page.getByRole("dialog")).toBeVisible();
  const openMs = performance.now() - start;
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({ timeout: 20_000 });
  const firstModelMs = performance.now() - start;
  expect(page.workers().some(worker=>worker.url().includes("/_next/static/"))).toBe(true);
  await page.locator("[data-model-state] canvas").evaluate(canvas => Object.assign(window, { firstWorkshopCanvas: canvas }));
  const timings: number[] = [];
  for (let i = 0; i < 4; i++) {
    const began = performance.now();
    await page.getByRole("button", { name: "Next object →", exact: true }).click();
    await expect(page.locator('[data-model-state="ready"]')).toBeVisible({ timeout: 15_000 });
    timings.push(Math.round(performance.now() - began));
  }
  const idleDraws = await page.evaluate(async () => {
    const w = window as Window & { workshopProbe?: { draws: number } };
    // Sample a settled viewer, after its resize observer has flushed.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = w.workshopProbe!.draws;
    await new Promise(resolve => setTimeout(resolve, 300));
    return w.workshopProbe!.draws - before;
  });
  const metrics = await page.evaluate(() => {
    const w = window as Window & { firstWorkshopCanvas?: HTMLCanvasElement; workshopProbe?: { longTasks:number[] } };
    return { sameCanvas: w.firstWorkshopCanvas === document.querySelector("[data-model-state] canvas"), longTasks: w.workshopProbe!.longTasks.map(Math.round) };
  });
  console.log(JSON.stringify({ openMs: Math.round(openMs), firstModelMs: Math.round(firstModelMs), nextObjectMs: timings, idleDraws, ...metrics }));
  expect(idleDraws).toBe(0);
  expect(metrics.sameCanvas).toBe(true);
  await page.getByRole("button", { name: "All objects", exact:true }).click();
  await page.locator('[data-discovery-choice="lugia"]').click();
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => (window as Window & {firstWorkshopCanvas?:HTMLCanvasElement}).firstWorkshopCanvas === document.querySelector("[data-model-state] canvas"))).toBe(true);
});

test("failed downloads and GPU context loss recover, and close releases the renderer", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "Mobile engines exercise the recovery paths.");
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  let fail = true;
  await page.route("**/workshop/headphones-*.glb", route => fail ? route.abort() : route.continue());
  await page.goto("/#projects");
  await pickUp(page,"headphones");
  await expect(page.locator('[data-model-state="error"]')).toBeVisible();
  fail=false;
  await page.getByRole("button",{name:"Try 3D again",exact:true}).click();
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({timeout:15_000});
  await page.locator("[data-model-state] canvas").evaluate((canvas:HTMLCanvasElement)=>canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(page.locator('[data-model-state="error"]')).toBeVisible();
  await page.getByRole("button",{name:"Try 3D again",exact:true}).click();
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({timeout:15_000});
  await page.locator("[data-model-state] canvas").evaluate((canvas:HTMLCanvasElement)=>Object.assign(window,{closedWorkshopContext:canvas.getContext("webgl2")}));
  await page.getByRole("button",{name:"Close discovery",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as Window & {closedWorkshopContext?:WebGL2RenderingContext}).closedWorkshopContext!.isContextLost())).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("switching away from a slow model cancels it without overwriting the next object", async ({page},info)=>{
  test.skip(info.project.name!=="mobile","Chromium inspects request cancellation.");
  let release:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/workshop/basketball-*.glb",async route=>{await gate;await route.continue().catch(()=>{});});
  await page.goto("/#projects");
  const requested=page.waitForRequest("**/workshop/basketball-*.glb");
  await pickUp(page,"basketball");
  await requested;
  const aborted=page.waitForEvent("requestfailed",{predicate:request=>request.url().includes("/workshop/basketball-")});
  await page.getByRole("button",{name:"Next object →",exact:true}).click();
  release();
  await aborted;
  await expect(page.getByRole("heading",{name:"Basketball hoop",exact:true})).toBeVisible();
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({timeout:15_000});
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-curio="basketball"]')).toBeFocused();
});

test("small phone through tablet keeps inspection and close controls within reach", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-webkit", "WebKit covers the responsive inspector matrix.");
  test.setTimeout(60_000);
  await page.setViewportSize({width:320,height:568});
  await page.goto("/#projects");
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:768,height:1024}]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('main[data-scene]')).toHaveAttribute('data-scene','projects');
    await pickUp(page,"lightstick");
    await expect(page.locator('[data-model-state="ready"]')).toBeVisible({ timeout:15_000 });
    await page.getByRole("button", { name: "Light the hearts", exact:true }).click();
    await expect(page.getByRole("button", { name: "Dim the hearts", exact:true })).toHaveAttribute("aria-pressed", "true");
    const dialog = page.getByRole("dialog");
    await dialog.evaluate(node => { node.scrollTop = node.scrollHeight; });
    const close = await page.getByRole("button", { name:"Close discovery", exact:true }).boundingBox();
    expect(close!.y).toBeGreaterThanOrEqual(0);
    expect(close!.height).toBeGreaterThanOrEqual(44);
    expect(close!.y + close!.height).toBeLessThanOrEqual(viewport.height);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path:`/tmp/workshop-polish-scrolled-${viewport.width}x${viewport.height}.png` });
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path:`/tmp/workshop-polish-${viewport.width}x${viewport.height}.png` });
    await page.getByRole("button", { name:"Close discovery", exact:true }).click();
    await expect(page.locator('[data-curio="lightstick"]')).toBeFocused();
  }
});

test("a vertical swipe over the model scrolls the mobile inspector", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mobile", "CDP drives a native touch gesture in Chromium.");
  await page.setViewportSize({width:390,height:568});
  await page.goto("/#projects");
  await pickUp(page,"basketball");
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({timeout:15_000});
  const canvas = await page.locator("[data-model-state] canvas").boundingBox();
  const dialog=page.getByRole("dialog");
  await dialog.evaluate(node=>{node.scrollTop=0;});
  const scrollY=await page.evaluate(()=>window.scrollY);
  const cdp=await context.newCDPSession(page);
  const before=await page.locator("[data-model-state] canvas").screenshot();
  const horizontalY=canvas!.y+canvas!.height/2, horizontalX=canvas!.x+canvas!.width*.25;
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:horizontalX,y:horizontalY}]});
  for(let step=1;step<=8;step++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:horizontalX+step*18,y:horizontalY}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  expect((await page.locator("[data-model-state] canvas").screenshot()).equals(before)).toBe(false);
  expect(await dialog.evaluate(node=>node.scrollTop)).toBe(0);
  const x=canvas!.x+canvas!.width/2, y=canvas!.y+canvas!.height*.75;
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  for(let step=1;step<=8;step++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y-step*18}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect.poll(()=>dialog.evaluate(node=>node.scrollTop)).toBeGreaterThan(50);
  expect(await page.evaluate(()=>window.scrollY)).toBe(scrollY);
});

test("a slow connection and CPU keep loading dismissible without eager workshop downloads",async({page,context},info)=>{
  test.skip(info.project.name!=="mobile","Chromium supplies CPU and network throttling.");
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const assets:string[]=[];page.on("request",request=>{if(request.url().includes("/workshop/"))assets.push(request.url());});
  await page.goto("/#projects");
  await expect(page.locator('[data-curio="shield"]')).toBeVisible();
  expect(assets).toEqual([]);
  const cdp=await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:200_000,uploadThroughput:100_000});
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
  await pickUp(page,"shield");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button",{name:"Close discovery",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-curio="shield"]')).toBeFocused();
  expect(errors).toEqual([]);
});
