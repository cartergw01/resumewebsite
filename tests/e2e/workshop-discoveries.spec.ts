import { pickUp } from "./workshop-actions";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const specs = JSON.parse(readFileSync(new URL("../../content/workshop-curios.json", import.meta.url), "utf8")) as {id:string;name:string}[];

async function pick(page: Page, id: string) {
  const dialog=page.getByRole("dialog");
  // Tapping the ball on the court shoots it; picking it up is in the directory.
  if (id==="basketball" && !await dialog.count()) await pickUp(page,"hoop");
  if (await dialog.count()) await dialog.getByRole("button",{name:"All objects",exact:true}).click();
  else {
    await pickUp(page,id);
    await expect(page.locator("dialog[data-discovery]")).toHaveAttribute("data-discovery",id);
    return;
  }
  await page.locator(`[data-discovery-choice="${id}"]`).click();
  await expect(page.locator("dialog[data-discovery]")).toHaveAttribute("data-discovery",id);
  await expect(page.locator("#discovery-title")).toBeFocused();
}

test("every prop has a reachable marker and models load only on discovery",async({page})=>{
  const models:string[]=[];
  page.on("request",request=>{if(request.url().includes("/workshop/")&&request.url().endsWith(".glb"))models.push(request.url());});
  await page.goto("/#projects");
  // The existing poker case is the project entry, with its model still
  // available through the directory instead of a second overlapping target.
  await expect(page.locator("[data-curio]")).toHaveCount(specs.length - 1);
  await expect(page.locator('[data-curio="poker-set"]')).toHaveCount(0);
  await expect(page.locator("#projects [data-island-visual]")).toHaveAttribute("data-parallax","on");
  expect(models).toEqual([]);
  const blocked=await page.locator("[data-curio]").evaluateAll(nodes=>nodes.flatMap(node=>{
    const pin=node.querySelector("span")!.getBoundingClientRect();
    return node.contains(document.elementFromPoint(pin.x,pin.y))?[]:[node.getAttribute("data-curio")];
  }));
  expect(blocked).toEqual([]);
  await pick(page,"starship");
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({timeout:20_000});
  await expect(page.getByText("Picked up from the island.", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\d+ of \d+ discovered/)).toHaveCount(0);
  expect(models).toHaveLength(1);
  await expect(page.getByRole("link",{name:"SpaceX",exact:true})).toHaveAttribute("href","https://research.contrary.com/company/spacex");
  await page.getByRole("button",{name:"Rotate model right"}).click();
  await expect(page.locator("[data-model-turns]")).toHaveAttribute("data-model-turns","1");
  await page.getByRole("button",{name:"Reset view"}).click();
  await expect(page.locator("[data-model-turns]")).toHaveAttribute("data-model-turns","0");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-curio="starship"]')).toBeFocused();
  await expect(page.locator('[data-curio="starship"]')).toHaveCSS("outline-style", "none");
  await page.reload();
  await expect(page.locator('[data-object-position="starship"]')).toHaveAttribute("data-found","true");
  await expect(page.getByRole("button",{name:/Explore \d+ objects/})).toHaveCount(0);
});

test("all exported props can be picked up and inspected",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop","Mobile covers representative models and every hit marker.");
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/#projects");
  for(const spec of specs){
    await pick(page,spec.id);
    await expect(page.locator('[data-model-state="ready"]'),spec.id).toBeVisible({timeout:15_000});
    await expect(page.getByRole("heading",{name:spec.name,exact:true})).toBeVisible();
  }
  await expect(page.getByText(/\d+ of \d+ discovered/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("basketball, synth, clocks, lights, and hidden poker set give real rewards",async({page},testInfo)=>{
  await page.goto("/#projects");
  await pick(page,"basketball");
  const power=page.getByRole("slider",{name:"Shot power",exact:true});
  await power.focus();for(let i=0;i<14;i++)await page.keyboard.press("ArrowRight");
  await page.getByRole("button",{name:"Shoot",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Swish"})).toHaveText("Swish. Two points.");
  await expect(page.getByText("2 points · 1 shot",{exact:true})).toBeVisible();
  await pick(page,"keyboard");
  await page.getByRole("button",{name:"Enable sound",exact:true}).click();
  await expect(page.getByRole("button",{name:"Sound on",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"C",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:/^C$/})).toBeVisible();
  await pick(page,"watches");
  await expect(page.getByRole("region",{name:"World clocks"})).toContainText("Taipei");
  await expect(page.getByRole("region",{name:"World clocks"})).toContainText("San Francisco");
  await pick(page,"lightstick");
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible({timeout:15_000});
  await page.getByRole("button",{name:"Turn light stick on",exact:true}).click();
  await expect(page.getByRole("button",{name:"Turn light stick off",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.screenshot({path:`/tmp/carter-discovery-${testInfo.project.name}.png`});
  await pick(page,"desk-lamp");
  await page.getByRole("button",{name:"Turn workshop lights off",exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-projects-lights","off");
  await pick(page,"poker-set");
  await page.getByRole("button",{name:"Play poker",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("button",{name:"20%",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-curio="hoop"]')).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe("hidden");
});

test("search, keyboard, reduced motion, and failed model fallback remain usable",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.route("**/workshop/headphones-*.glb",route=>route.abort());
  await page.goto("/#projects");
  await pickUp(page,"headphones");
  await page.getByRole("button",{name:"All objects",exact:true}).click();
  const search=page.getByRole("searchbox");
  await expect(search).toHaveCSS("font-size","16px");
  await search.fill("nothing matches");
  await expect(page.getByRole("status")).toContainText("No objects found.");
  await search.fill("AirPods");
  await expect(page.locator("[data-discovery-choice]")).toHaveCount(1);
  await page.locator('[data-discovery-choice="headphones"]').click();
  await expect(page.locator('[data-model-state="error"]')).toBeVisible({timeout:15_000});
  await expect(page.getByRole("img",{name:"AirPods Max on the island",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Close discovery",exact:true}).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button",{name:"Next object",exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-curio="headphones"]')).toBeFocused();
});
