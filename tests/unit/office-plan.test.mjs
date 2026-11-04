import assert from "node:assert/strict";
import test from "node:test";
import { officeRoute, officeStops, officeView } from "../../lib/office-plan.ts";

const inside = ([x, y], [left, top, width, height]) => x >= left && x <= left + width && y >= top && y <= top + height;
// Where a person can stand: floors, the corridor, and the doorways between them.
const floors = [
  [4, 36, 80, 80], [88, 36, 96, 80], [188, 36, 80, 80], [272, 36, 64, 80],
  [4, 120, 332, 32],
  [4, 184, 80, 80], [88, 184, 112, 80], [204, 184, 64, 80], [272, 184, 64, 80],
  [36, 116, 16, 4], [128, 116, 16, 4], [220, 116, 16, 4], [296, 116, 16, 4],
  [36, 152, 16, 32], [136, 152, 16, 32], [244, 152, 16, 32], [296, 152, 16, 32],
];
// Independent collision bounds for the furniture in the drawing.
const solids = [
  [8, 34, 16, 32], [28, 48, 40, 22], [112, 40, 14, 18],
  [93, 66, 26, 14], [149, 66, 26, 14], [93, 88, 26, 14], [149, 88, 26, 14],
  [192, 46, 30, 22], [234, 46, 30, 22], [200, 66, 12, 14], [243, 66, 12, 14],
  [274, 38, 38, 22], [278, 62, 38, 22],
  [5, 153, 30, 36], [53, 153, 30, 36], [8, 204, 28, 24], [56, 214, 20, 20],
  [92, 196, 42, 22], [158, 196, 42, 22], [92, 222, 42, 22], [158, 222, 42, 22],
  [208, 190, 34, 22], [219, 208, 12, 14], [208, 230, 28, 24],
  [276, 186, 18, 16], [314, 186, 20, 24], [290, 228, 26, 20],
];

for (const from of officeStops) {
  for (const to of officeStops.filter(stop => stop !== from)) {
    test(`${from.id} to ${to.id} stays on the floor and clears furniture and walls`, () => {
      const route = officeRoute(from, to);
      assert.deepEqual(route[0], from.point);
      assert.deepEqual(route.at(-1), to.point);
      assert(inside(from.point, from.box));
      assert(inside(to.point, to.box));
      for (let i = 1; i < route.length; i++) {
        const start = route[i - 1], end = route[i];
        assert(start[0] === end[0] || start[1] === end[1], "no diagonal wall shortcuts");
        for (let part = 0; part <= 100; part++) {
          const p = [start[0] + (end[0] - start[0]) * part / 100, start[1] + (end[1] - start[1]) * part / 100];
          assert(floors.some(box => inside(p, box)), `route left the office at ${p}`);
          assert(!solids.some(box => inside(p, box)), `route crossed furniture at ${p}`);
        }
      }
    });
  }
}

test("every room sits inside the drawing", () => {
  for (const { id, box: [x, y, width, height] } of officeStops) {
    assert(x >= 0 && x + width <= officeView.width && y >= 0 && y + height <= officeView.height, `${id} runs off the map`);
  }
});
