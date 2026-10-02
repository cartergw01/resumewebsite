import { expect, test } from "@playwright/test";
import { artworkTransform, artworkOutline } from "../../lib/artwork-perspective";

test("perspective artwork maps every corner of a tilted surface", async ({ page }) => {
  // The fourth point deliberately differs from the affine parallelogram.
  const corners = [[38, 20], [260, 43], [24, 177], [281, 204]];
  const transform = artworkTransform(corners, 320, 200);
  const actual = await page.evaluate((value) => {
    const matrix = new DOMMatrix(value);
    return [[0, 0], [320, 0], [0, 200], [320, 200]].map(([x, y]) => {
      const point = matrix.transformPoint(new DOMPoint(x, y));
      return [point.x / point.w, point.y / point.w];
    });
  }, transform);
  actual.forEach((point, index) => {
    // Browsers round parsed CSS matrix coefficients; stay within 1/50 pixel.
    expect(Math.abs(point[0] - corners[index][0])).toBeLessThan(0.02);
    expect(Math.abs(point[1] - corners[index][1])).toBeLessThan(0.02);
  });
  expect(artworkOutline(corners)).toBe("M38 20L260 43L281 204L24 177Z");
});
