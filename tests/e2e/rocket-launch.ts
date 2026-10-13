import { expect, type Page } from "@playwright/test";

// The rocket's launch phase is brief (LAUNCH_DURATION in
// components/RocketCursor.tsx, ~240ms), and an island launch has no route of
// its own, so the cursor is back to "idle" moments later. Polling
// data-transition-phase for "launching" after an action races that window and
// misses it whenever the page is busy. Instead, listen for the cursor's own
// phase events before acting, then check that a launch happened.
type Probe = Window & { __rocketLaunched?: boolean };

export async function watchRocketLaunch(page: Page) {
  await page.evaluate(() => {
    const probe = window as Probe;
    probe.__rocketLaunched = false;
    document.addEventListener("rocket-transition-change", event => {
      if ((event as CustomEvent<{ phase: string }>).detail.phase === "launching") probe.__rocketLaunched = true;
    });
  });
}

export async function expectRocketLaunched(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as Probe).__rocketLaunched === true)).toBe(true);
}
