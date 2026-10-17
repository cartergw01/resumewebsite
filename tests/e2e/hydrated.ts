import type { Page } from "@playwright/test";

// Next's router stores its state with a same-URL history.replaceState once a
// page has hydrated or a client navigation has settled (~1s in WebKit).
// Leaving before then, WebKit reports that late replace as a competing
// navigation, so wait until the stored route tree is the current page's.
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const state = history.state as { __NA?: boolean; __PRIVATE_NEXTJS_INTERNALS_TREE?: unknown } | null;
    if (!state?.__NA) return false;
    const segment = location.pathname.split("/")[1];
    return !segment || JSON.stringify(state.__PRIVATE_NEXTJS_INTERNALS_TREE ?? "").includes(`"${segment}"`);
  });
}
