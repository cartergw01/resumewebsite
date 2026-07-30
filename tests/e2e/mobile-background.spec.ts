import { expect, test, type Page } from "@playwright/test";

async function canvasSignature(page: Page) {
  return page.getByTestId("work-starfield").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return { hash: 0, paintedSamples: 0 };

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    let paintedSamples = 0;

    for (let index = 0; index < pixels.length; index += 16) {
      hash ^= pixels[index];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 1];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 2];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 3];
      hash = Math.imul(hash, 16777619);
      if (pixels[index + 3] > 0) paintedSamples += 1;
    }

    return { hash: hash >>> 0, paintedSamples };
  });
}

test("mobile galaxy remains static while the page scrolls", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile atmosphere behavior.");

  await page.goto("/work");
  await expect(page.getByTestId("work-starfield")).toBeVisible();
  await expect.poll(async () => (await canvasSignature(page)).paintedSamples).toBeGreaterThan(10);

  const beforeScroll = await canvasSignature(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await page.waitForTimeout(250);

  expect(await canvasSignature(page)).toEqual(beforeScroll);
});
