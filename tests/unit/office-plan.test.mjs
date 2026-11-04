import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OFFICE_PORTFOLIO, officeCanStand, officeObjects, officeRoomAt, officeRoute, officeStops, officeView } from "../../lib/office-plan.ts";

const inside = ([x, y], [left, top, width, height]) => x >= left && x <= left + width && y >= top && y <= top + height;
const copy = readFileSync(new URL("../../content/work.md", import.meta.url), "utf8");

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
    if (id === "now") { assert(copy.includes("[886 Studios]")); continue; } // The job's name.
    if (id === "side") { assert(titles.includes("Korobra Capital")); continue; } // Names the section's fund.
    assert(titles.includes(label), `"${label}" is not a heading in content/work.md`);
  }
});

test("objects in a room are real links, and he can reach them", () => {
  for (const item of officeObjects) {
    if (item.person) assert(item.href.startsWith("https://www.886studios.com/"), `${item.id} should open a page on 886's site`);
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
  for (const id of ["kai", "kevin", "patryk", "max", "jimmy"]) assert.equal(person(id).room, "accelerator");
  const founders = officeObjects.filter(item => item.label === "Founders");
  const inCommunity = founders.filter(item => item.room === "community");
  assert(inCommunity.length >= 6 && inCommunity.length <= 7, `${inCommunity.length} founders in Community & content`);
  assert(founders.some(item => item.room === "founders"), "the coffee chat needs its founder");
  for (const founder of founders) assert.equal(founder.href, OFFICE_PORTFOLIO);
});

test("Contrary Research is bigger than Slug Fund Investment Group", () => {
  const area = id => { const [, , width, height] = officeStops.find(room => room.id === id).floor; return width * height; };
  assert(area("research") > area("slug"));
});
