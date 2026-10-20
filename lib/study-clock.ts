// The study clock keeps Taipei time, independent of the visitor's timezone.
// Both the projected SVG and the 3D flight use these same hand proportions.
export const STUDY_TIME_ZONE = "Asia/Taipei";
export type StudyClockFace = { corners: number[][] };
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: STUDY_TIME_ZONE, hourCycle: "h23",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

export const CLOCK_HANDS = {
  hour: { length: .62, width: .035, tail: .12 },
  minute: { length: .86, width: .026, tail: .12 },
  second: { length: .94, width: .009, tail: .22 },
} as const;
export type ClockHand = keyof typeof CLOCK_HANDS;

export function studyTime(date = new Date()) {
  const parts = formatter.formatToParts(date);
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value ?? 0);
  const hour = part("hour"), minute = part("minute"), second = part("second");
  return {
    label: formatter.format(date),
    hour: (hour % 12) * 30 + minute / 2 + second / 120,
    minute: minute * 6 + second / 10,
    second: second * 6,
  };
}

// Dial coordinates: x points right, y points up; angles run clockwise.
export function clockHandPoints(name: ClockHand, angle: number): [number, number][] {
  const { length, width, tail } = CLOCK_HANDS[name];
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return [[-width, -tail], [-width, length * .8], [0, length], [width, length * .8], [width, -tail]]
    .map(([x, y]) => [x * c + y * s, y * c - x * s]);
}
