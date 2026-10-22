import { expect, test } from "@playwright/test";
import { createStudyClock } from "../../lib/study-clock-3d";

// A visitor outside Taiwan must still see Taipei time on the study wall.
test.use({ timezoneId: "Pacific/Honolulu" });

test("the 3D flight hands show the same wall-clock time", () => {
  test.skip(test.info().project.name !== "desktop", "The shared 3D clock math needs one check.");
  const clock = createStudyClock({ center: [1, 3.09, -1.81], radius: .181 });
  clock.update(Date.parse("2026-10-20T13:45:30Z")); // 21:45:30 in Taipei.
  for (const [name, angle] of [["hour", 292.75], ["minute", 273], ["second", 180]] as const) {
    const hand = clock.group.getObjectByName(`Study clock · ${name} hand`)!;
    expect(hand.rotation.z * -180 / Math.PI).toBeCloseTo(angle, 5);
  }
  clock.update(Date.parse("2026-10-20T16:00:00Z"));
  for (const name of ["hour", "minute", "second"]) {
    expect(clock.group.getObjectByName(`Study clock · ${name} hand`)!.rotation.z).toBeCloseTo(0);
  }
});

test("the luminous clock keeps Taipei time through lights-off, midnight, and return visits", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-20T02:15:30Z"));
  await page.goto("/#writing");
  const clock = page.locator("#writing [data-study-clock]");
  await expect(clock).toHaveAttribute("data-clock-time", "10:15:30");
  // Include minutes and seconds in the hour/minute hands, as a real clock does.
  await expect(clock.locator('[data-clock-hand="hour"]')).toHaveAttribute("data-angle", "307.75");
  await expect(clock.locator('[data-clock-hand="minute"]')).toHaveAttribute("data-angle", "93");
  await expect(clock.locator('[data-clock-hand="second"]')).toHaveAttribute("data-angle", "180");
  await page.getByRole("switch", { name: "study lights" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-writing-lights", "off");
  for (const hand of ["hour", "minute", "second"]) await expect(clock.locator(`[data-clock-hand="${hand}"]`)).toBeVisible();

  await page.clock.setFixedTime(new Date("2026-10-20T15:59:59Z"));
  await expect(clock).toHaveAttribute("data-clock-time", "23:59:59");
  await page.clock.setFixedTime(new Date("2026-10-20T16:00:00Z"));
  await expect(clock).toHaveAttribute("data-clock-time", "00:00:00");
  await expect(clock.locator('[data-clock-hand="hour"]')).toHaveAttribute("data-angle", "0");
  await expect(clock.locator('[data-clock-hand="minute"]')).toHaveAttribute("data-angle", "0");

  await page.getByRole("button", { name: "Show Projects island" }).click();
  await expect(page.locator("main[data-scene]")).toHaveAttribute("data-scene", "projects");
  await page.clock.setFixedTime(new Date("2026-10-20T19:30:00Z"));
  await page.getByRole("button", { name: "Show Writing island" }).click();
  await expect(clock).toHaveAttribute("data-clock-time", "03:30:00");
  await expect(clock.locator('[data-clock-hand="hour"]')).toHaveAttribute("data-angle", "105");
  // The clock resumes during arrival; wait for the island's URL to settle
  // before reloading, so this checks persistence rather than interrupting travel.
  await expect(page).toHaveURL(/#writing$/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-writing-lights", "off");
  await expect(clock).toHaveAttribute("data-clock-time", "03:30:00");
  await expect(clock.locator('[data-clock-hand="minute"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("the clock still updates with reduced motion and the book remains usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-20T04:00:00Z"));
  await page.goto("/#writing");
  const clock = page.locator("#writing [data-study-clock]");
  await expect(clock).toHaveAttribute("data-clock-time", "12:00:00");
  await page.clock.setFixedTime(new Date("2026-10-20T04:00:01Z"));
  await expect(clock).toHaveAttribute("data-clock-time", "12:00:01");
  await expect(clock.locator('[data-clock-hand="second"]')).toHaveAttribute("data-angle", "6");
  await page.getByRole("switch", { name: "study lights" }).click();
  await expect(clock.locator('[data-clock-hand="hour"]')).toBeVisible();
  await page.locator("#writing [data-island-link]").click();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.getByRole("heading", { name: "Writing", exact: true })).toBeVisible();
});
