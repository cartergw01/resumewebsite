import assert from "node:assert/strict";
import test from "node:test";
import { officeRoute, officeStops } from "../../lib/office-plan.ts";

const inside = ([x, y], [left, top, width, height]) => x >= left && x <= left + width && y >= top && y <= top + height;
const floors = [[24, 24, 400, 376], [424, 72, 272, 456], [64, 400, 360, 176]];
// Independent collision bounds for tabletops, counters and partitions in the drawing.
// Chairs and sofas are destinations: the worker must be able to sit in them.
const solids = [
  [64, 75, 116, 31], [284, 90, 90, 44], [285, 228, 38, 12], [349, 228, 38, 12],
  [506, 108, 132, 36], [524, 296, 112, 65], [80, 416, 116, 28], [80, 444, 28, 56],
  [177, 250, 26, 32], [278, 224, 4, 31],
  [422, 72, 4, 116], [422, 228, 4, 100], [422, 400, 4, 128],
  [462, 72, 4, 76], [462, 180, 4, 150], [462, 366, 4, 162],
  [24, 350, 180, 4], [256, 350, 168, 4], [64, 398, 126, 4], [340, 398, 84, 4],
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
          assert(!solids.some(box => inside(p, box)), `route crossed furniture or a wall at ${p}`);
        }
      }
    });
  }
}
