import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OFFICE_PORTFOLIO, officeCanStand, officeDetailAt, officeDetails, officeObjectAt, officeObjects, officeRoomAt, officeRoute, officeStops, officeView } from "../../lib/office-plan.ts";

const inside = ([x, y], [left, top, width, height]) => x >= left && x <= left + width && y >= top && y <= top + height;
const copy = readFileSync(new URL("../../content/work.md", import.meta.url), "utf8");

test("every animated detail can be approached from its room without crossing furniture", () => {
  for (const detail of officeDetails) {
    const [left, top, width, height] = detail.reach;
    const candidates = [];
    for (let x = left; x <= left + width; x++) {
      for (let y = top; y <= top + height; y++) {
        if (officeCanStand(x, y) && officeDetailAt(x, y, "up") === detail.id) candidates.push([x, y]);
      }
    }
    candidates.sort((a, b) => Math.hypot(a[0] - left - width / 2, a[1] - top - height / 2) - Math.hypot(b[0] - left - width / 2, b[1] - top - height / 2));
    const start = officeStops.find(room => room.id === detail.room).point;
    const reachable = candidates.some(point => {
      const route = officeRoute(start, point);
      for (let i = 1; i < route.length; i++) {
        if (route[i][0] !== route[i - 1][0] && route[i][1] !== route[i - 1][1]) return false;
        for (let share = 0; share <= 1; share += .05) {
          const [x, y] = route[i - 1].map((value, axis) => value + (route[i][axis] - value) * share);
          if (!officeCanStand(x, y)) return false;
        }
      }
      return true;
    });
    assert(reachable, `${detail.id} cannot be approached without crossing furniture`);
  }
});

test("screens and wall details respond to proximity and facing", () => {
  assert.equal(officeDetailAt(44, 74, "up"), "desk");
  assert.equal(officeDetailAt(44, 74, "down"), null);
  assert.equal(officeDetailAt(260, 204, "left"), "korobra");
  assert.equal(officeDetailAt(266, 204, "right"), "code");
  assert.equal(officeDetailAt(238, 84, "up"), "pipeline");
  assert.equal(officeDetailAt(238, 79.5, "up"), "pipeline", "stopping against the chair keeps the board lit");
  assert.equal(officeDetailAt(216, 79.5, "up"), "scan", "stopping against the laptop table keeps its screen awake");
  assert.equal(officeDetailAt(238, 84, "down"), null);
  assert.equal(officeDetailAt(258, 84, "up"), "cafe-window");
  assert.equal(officeDetailAt(44, 104, "up"), null, "the doorway is too far from the desk");
  assert.equal(officeDetailAt(238, 134, "up"), null, "the hallway cannot wake a room");
});

for (const from of officeStops) {
  for (const to of officeStops.filter(stop => stop !== from)) {
    test(`${from.id} to ${to.id} walks in straight runs through the doors`, () => {
      const route = officeRoute(from.point, to.point);
      assert.deepEqual(route[0], from.point);
      assert.deepEqual(route.at(-1), to.point);
      assert(route.length <= 10, `too many turns: ${route.length}`);
      for (let i = 1; i < route.length; i++) {
        const start = route[i - 1], end = route[i];
        assert(start[0] === end[0] || start[1] === end[1], "no diagonals");
        for (let part = 0; part <= 100; part++) {
          const x = start[0] + (end[0] - start[0]) * part / 100, y = start[1] + (end[1] - start[1]) * part / 100;
          assert(officeCanStand(x, y), `route hit something at ${x}, ${y}`);
        }
      }
    });
  }
}

test("he can stand where each room sends him, and is then in that room", () => {
  for (const stop of officeStops) {
    assert(officeCanStand(...stop.point), `${stop.id} seat is blocked`);
    assert.equal(officeRoomAt(...stop.point), stop.id);
    const [x, y, width, height] = stop.box;
    assert(x >= 0 && x + width <= officeView.width && y >= 0 && y + height <= officeView.height, `${stop.id} runs off the map`);
  }
});

test("a route can start from anywhere he has walked to", () => {
  const route = officeRoute([101, 137], officeStops[5].point);
  assert.deepEqual(route.at(-1), officeStops[5].point);
  for (let i = 1; i < route.length; i++) assert(route[i - 1][0] === route[i][0] || route[i - 1][1] === route[i][1]);
});

test("room names are the copy's own words, never shortened", () => {
  const titles = [...copy.matchAll(/^#{1,3}\s+(.+)$/gm)].map(match => match[1]);
  for (const { id, label } of officeStops) {
    if (id === "now") { assert(copy.includes("886 Studios")); continue; } // The job's name.
    if (id === "side") { assert(titles.includes("Korobra Capital")); continue; } // Names the section's fund.
    assert(titles.includes(label), `"${label}" is not a heading in content/work.md`);
  }
});

test("objects in a room are real links, and he can reach them", () => {
  for (const item of officeObjects) {
    if (item.person) assert(!item.href || item.href.startsWith("https://www.886studios.com/"), `${item.id} should open a page on 886's site`);
    else assert(copy.includes(`(${item.href})`), `${item.id} links to ${item.href}, which content/work.md does not`);
    const stop = officeStops.find(room => room.id === item.room);
    const [x, y, width, height] = item.reach;
    let reachable = false;
    for (let a = x; a <= x + width; a++) for (let b = y; b <= y + height; b++) if (officeCanStand(a, b)) reachable = true;
    assert(reachable, `nowhere to stand for ${item.id}`);
    assert(inside([x + width / 2, y + height / 2], stop.box), `${item.id} is outside its room`);
  }
});

test("people open their own pages, and founders open the portfolio", () => {
  const person = id => officeObjects.find(item => item.id === id);
  assert.equal(person("kai").href, "https://www.886studios.com/team/kai");
  assert.equal(person("kevin").href, "https://www.886studios.com/team/kevin-lin");
  assert.equal(person("patryk").href, "https://www.886studios.com/team/patryk");
  assert.equal(person("max").href, "https://www.886studios.com/team/max");
  assert.equal(person("jameson").href, "https://www.886studios.com/team/jameson");
  assert.equal(person("chris").href, "https://www.886studios.com/team/chris");
  for (const id of ["kai", "kevin", "patryk", "max", "jimmy", "jameson", "chris", "freya", "ginny"]) assert.equal(person(id).room, "accelerator");
  for (const id of ["freya", "ginny"]) assert.equal(person(id).href, undefined, `${id} has no page on 886's site yet`);
  const founders = officeObjects.filter(item => item.label === "Founders");
  const inCommunity = founders.filter(item => item.room === "community");
  assert(inCommunity.length >= 10, `${inCommunity.length} founders in Community & content`);
  assert(founders.some(item => item.room === "founders"), "the coffee chat needs its founder");
  for (const founder of founders) assert.equal(founder.href, OFFICE_PORTFOLIO);
});

test("Contrary Research is bigger than Slug Fund Investment Group", () => {
  const area = id => { const [, , width, height] = officeStops.find(room => room.id === id).floor; return width * height; };
  assert(area("research") > area("slug"));
});

test("both outer ikigai aisles and the cross aisle stay clear, with seats still solid", () => {
  for (const x of [100, 184]) {
    for (let y = 60; y <= 112; y++) assert(officeCanStand(x, y), `blocked aisle at ${x}, ${y}`);
    // A click can reach each end through actual walkable floor too.
    const route = officeRoute([140, 112], [x, 60]);
    for (let i = 1; i < route.length; i++) {
      const [a, b] = [route[i - 1], route[i]];
      for (let part = 0; part <= 100; part++) {
        assert(officeCanStand(a[0] + (b[0] - a[0]) * part / 100, a[1] + (b[1] - a[1]) * part / 100));
      }
    }
  }
  for (let x = 100; x <= 184; x++) assert(officeCanStand(x, 80), `blocked cross aisle at ${x}`);
  for (const x of [113, 127, 155, 169]) for (const y of [68, 88]) assert(!officeCanStand(x, y), "cannot walk through a seat");
});

test("every ikigai guest can be approached from multiple directions", () => {
  for (const item of officeObjects.filter(item => item.room === "accelerator" && item.person)) {
    const [x, y, width, height] = item.box;
    const [cx, cy] = [x + width / 2, y + height - 2];
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
      for (let distance = 7; distance <= 18; distance++) {
        const point = [cx + dx * distance, cy + dy * distance];
        if (officeCanStand(...point) && officeObjectAt(...point)?.id === item.id) return true;
      }
      return false;
    });
    assert(directions.length >= 2, `${item.id} can only be approached from ${directions.length} directions`);
  }
  assert.equal(officeObjectAt(100, 72)?.id, "max");
  assert.equal(officeObjectAt(184, 72)?.id, "chris");
  assert.equal(officeObjectAt(127, 60)?.id, "patryk");
  assert.equal(officeObjectAt(113, 81)?.id, "ginny");
  assert.equal(officeObjectAt(191, 72), null, "cannot talk through a room wall");
});
