import { expect, test } from "@playwright/test";

test("mobile islands and map labels keep clear of navigation at different heights", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "One browser covers the responsive size matrix; touch is tested separately.");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2.0#projects");
  await expect(page.locator('[data-island-orbit="projects"]')).toHaveAttribute("data-orbit-ready", "true", { timeout: 60_000 });
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:667,height:375}]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('main[data-scene]')).toHaveAttribute('data-scene', 'projects');
    await expect(page.locator('#projects [data-orbit-controls]')).toHaveCount(0);
    await page.locator('#projects [data-island-link]').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => {
      const [hint, nav] = await Promise.all([page.locator('#projects [data-orbit-controls]').boundingBox(), page.locator('[data-scene-nav]').boundingBox()]);
      return Math.max(nav!.y - (hint!.y + hint!.height), nav!.x - (hint!.x + hint!.width));
    }).toBeGreaterThan(8);
    await page.keyboard.press('r');
    await expect(page.locator('#projects [data-orbit-controls]')).toHaveCount(0);
    await expect(page.locator('[data-next-scene]')).toBeHidden();
  }
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]) {
    await page.setViewportSize(viewport);
    for (const id of ["intro", "hello"]) {
      await page.goto(id === "intro" ? "/2.0" : "/2.0#hello");
      await expect(page.locator('main[data-scene]')).toHaveAttribute('data-scene', id);
      const prompt = (await page.locator('[data-next-scene]').boundingBox())!;
      for (const label of await page.locator(`#${id} [data-overview-island] > span:last-child`).all()) {
        const box = (await label.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThan(prompt.y - 6);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (id === 'hello') for (const link of await page.locator('#hello [aria-label="Contact"] a').all()) {
        const box = (await link.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test("phone headers prioritize routes while contact remains available below content", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Only phones use the compact header.");
  for (const route of ["work", "writing", "projects"]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole('navigation', {name:'Social links'})).toBeHidden();
    await expect(page.getByRole('link', {name:'Back to islands'})).toBeVisible();
    await expect(page.getByRole('navigation', {name:'Primary navigation'}).getByRole('link', {name:route,exact:false})).toBeVisible();
    const contact = page.getByRole('navigation', {name:'Contact',exact:true});
    await contact.scrollIntoViewIfNeeded();
    await expect(contact).toBeInViewport();
    for (const link of await contact.getByRole('link').all()) {
      const box = (await link.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(contact.getByRole('link',{name:'Email'})).toHaveAttribute('href', /^mailto:/);
  }
});

test("each island gives immediate touch feedback on its landmark and clears it on cancellation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', {configurable:true,value:Object.assign(new EventTarget(),{saveData:true})}));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [world, surface] of [["work","entryWindow"],["writing","spread"],["projects","screen"]]) {
    await page.goto(`/2.0#${world}`);
    const link = page.locator(`#${world} [data-island-link]`);
    await link.dispatchEvent('pointerdown', {pointerType:'touch',isPrimary:true,pointerId:1,button:0,clientX:180,clientY:400});
    const light = link.locator(`svg:has([data-touch-surface="${surface}"])`);
    await expect(light).toHaveCSS('opacity', '0.8');
    await link.dispatchEvent('pointercancel', {pointerType:'touch',pointerId:1});
    await expect(light).toHaveCSS('opacity', '0');
    await expect(page).toHaveURL(new RegExp(`#${world}$`));
    await expect(page.locator('[data-island-stage]')).not.toHaveAttribute('data-entering');
  }
});

test("phone project previews keep their crop during interaction with the action beside the title", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/projects');
  const project = page.getByRole('link', {name:'Open TaipeiFlix live project in a new tab'});
  const image = project.locator('[data-project-shot] img');
  const crop = await image.evaluate(el => getComputedStyle(el).transform);
  expect(await image.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeGreaterThan(1.3);
  await project.hover();
  await expect(image).toHaveCSS('transform', crop);
  await project.focus();
  await expect(image).toHaveCSS('transform', crop);
  const [title, shot, action] = await Promise.all([project.locator('strong').boundingBox(), project.locator('[data-project-shot]').boundingBox(), project.locator('em').boundingBox()]);
  expect(title!.y + title!.height).toBeLessThan(shot!.y);
  expect(action!.y + action!.height).toBeLessThan(shot!.y);
  expect(action!.x).toBeGreaterThan(title!.x + title!.width);
});
