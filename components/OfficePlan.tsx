import { useId, type ReactNode, type Ref } from "react";
import { officeProject, officeStops, officeView, type OfficeStopId } from "@/lib/office-plan";
import styles from "./OfficeExplorer.module.css";

type Tone = readonly [string, string, string];
const wood: Tone = ["#c9a074", "#a07b54", "#8a6844"];
const pale: Tone = ["#e8dcc4", "#c7b99d", "#b5a688"];
const wall: Tone = ["#f6eedd", "#dcd1b9", "#cbbfa5"];
const sage: Tone = ["#84937a", "#6a7860", "#5a674f"];
const seat: Tone = ["#6f8270", "#596a5a", "#4b5a4c"];
const dark: Tone = ["#39443f", "#232b28", "#1b2220"];
const paper: Tone = ["#f8f1e0", "#d9d0ba", "#cbc2ac"];
const steel: Tone = ["#8f9694", "#6f7674", "#5e6463"];

const at = (x: number, y: number, z = 0) => officeProject([x, y], z).join(",");
const Flat = ({ x, y, w, d, z = 0, fill, opacity }: { x: number; y: number; w: number; d: number; z?: number; fill: string; opacity?: number }) =>
  <polygon fill={fill} opacity={opacity} points={`${at(x, y, z)} ${at(x + w, y, z)} ${at(x + w, y + d, z)} ${at(x, y + d, z)}`} />;

/** A solid seen from above: its top, the face toward +y, the face toward +x. */
function Box({ x, y, w, d, h, z = 0, tone }: { x: number; y: number; w: number; d: number; h: number; z?: number; tone: Tone }) {
  const top = z + h;
  return <g>
    <polygon fill={tone[1]} points={`${at(x, y + d, z)} ${at(x + w, y + d, z)} ${at(x + w, y + d, top)} ${at(x, y + d, top)}`} />
    <polygon fill={tone[2]} points={`${at(x + w, y, z)} ${at(x + w, y + d, z)} ${at(x + w, y + d, top)} ${at(x + w, y, top)}`} />
    <polygon fill={tone[0]} points={`${at(x, y, top)} ${at(x + w, y, top)} ${at(x + w, y + d, top)} ${at(x, y + d, top)}`} />
  </g>;
}

// Art drawn flat, then laid on a wall. Local x runs along the wall, local y runs down.
const onBackWall = (x: number, y: number, z: number) => { const [a, b] = officeProject([x, y], z); return `matrix(.866 .5 0 1 ${a} ${b})`; };
const onSideWall = (x: number, y: number, z: number) => { const [a, b] = officeProject([x, y], z); return `matrix(.866 -.5 0 1 ${a} ${b})`; };

const Shadow = ({ x, y, w, d }: { x: number; y: number; w: number; d: number }) => <Flat x={x + 3} y={y + 3} w={w + 3} d={d + 3} fill="#2a2a2038" />;
const Rug = ({ x, y, w, d, fill = "#a9ae92" }: { x: number; y: number; w: number; d: number; fill?: string }) => <>
  <Flat x={x} y={y} w={w} d={d} fill={fill} opacity={.72} />
  <Flat x={x + 5} y={y + 5} w={w - 10} d={d - 10} fill="#f4ecd930" />
</>;

/** `back` is the side of the seat its backrest stands on. */
function Chair({ x, y, back }: { x: number; y: number; back: "x+" | "x-" | "y+" | "y-" }) {
  const rest = back === "y-" ? <Box x={x - 9} y={y - 10} w={18} d={3} z={13} h={12} tone={seat} />
    : back === "x-" ? <Box x={x - 10} y={y - 9} w={3} d={18} z={13} h={12} tone={seat} /> : null;
  const front = back === "y+" ? <Box x={x - 9} y={y + 7} w={18} d={3} z={13} h={12} tone={seat} />
    : back === "x+" ? <Box x={x + 7} y={y - 9} w={3} d={18} z={13} h={12} tone={seat} /> : null;
  return <g>
    <Shadow x={x - 9} y={y - 9} w={18} d={18} />
    <Box x={x - 2} y={y - 2} w={4} d={4} h={10} tone={dark} />
    {rest}
    <Box x={x - 10} y={y - 10} w={20} d={20} z={10} h={4} tone={seat} />
    {front}
  </g>;
}

function Desk({ x, y, w, d, tone = wood }: { x: number; y: number; w: number; d: number; tone?: Tone }) {
  return <g>
    <Shadow x={x} y={y} w={w} d={d} />
    <Box x={x + 3} y={y + 3} w={4} d={d - 6} h={16} tone={dark} />
    <Box x={x + w - 7} y={y + 3} w={4} d={d - 6} h={16} tone={dark} />
    <Box x={x} y={y} w={w} d={d} z={16} h={4} tone={tone} />
  </g>;
}

function Monitor({ x, y, z = 20, w = 30, chart = false }: { x: number; y: number; z?: number; w?: number; chart?: boolean }) {
  return <g>
    <Box x={x + w / 2 - 2} y={y} w={4} d={3} z={z} h={5} tone={dark} />
    <Box x={x} y={y} w={w} d={3} z={z + 5} h={18} tone={dark} />
    <polygon className={styles.screen} points={`${at(x + 2, y + 3, z + 7)} ${at(x + w - 2, y + 3, z + 7)} ${at(x + w - 2, y + 3, z + 21)} ${at(x + 2, y + 3, z + 21)}`} />
    {chart && <polyline className={styles.chart} points={`${at(x + 4, y + 3, z + 9)} ${at(x + w * .3, y + 3, z + 12)} ${at(x + w * .5, y + 3, z + 11)} ${at(x + w * .72, y + 3, z + 16)} ${at(x + w - 4, y + 3, z + 19)}`} />}
  </g>;
}

function Sheet({ x, y, z, w = 14, d = 18 }: { x: number; y: number; z: number; w?: number; d?: number }) {
  return <g>
    <Flat x={x} y={y} w={w} d={d} z={z} fill="#f8f1e0" />
    <path className={styles.paperLine} d={`M${at(x + 2, y + 4, z)} L${at(x + w - 2, y + 4, z)} M${at(x + 2, y + 8, z)} L${at(x + w - 2, y + 8, z)} M${at(x + 2, y + 12, z)} L${at(x + w - 5, y + 12, z)}`} />
  </g>;
}

function Mug({ x, y, z }: { x: number; y: number; z: number }) {
  const [cx, cy] = officeProject([x, y], z);
  return <g>
    <path fill="#efe5d0" d={`M${cx - 4} ${cy}v-6h8v6a4 2 0 0 1-8 0Z`} />
    <ellipse cx={cx} cy={cy - 6} rx="4" ry="2" fill="#6b4d38" />
    <path className={styles.steam} d={`M${cx - 2} ${cy - 10}q-3-4 0-8m4 2q3-4 0-8`} />
  </g>;
}

function Plant({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  const [cx, cy] = officeProject([x, y]);
  return <g transform={`translate(${cx} ${cy}) scale(${size})`}>
    <ellipse cx="4" cy="2" rx="14" ry="7" fill="#2a2a2038" />
    <path fill="#a98f74" d="M-9-14h18l-3 14a6 3 0 0 1-12 0Z" />
    <ellipse cy="-14" rx="9" ry="3.5" fill="#6d5a47" />
    {[-52, -24, 0, 26, 54].map(angle => <path key={angle} fill={angle % 4 ? "#5f7c55" : "#6f8f62"} d="M0-14c-8-12-7-24 0-34c7 10 8 22 0 34Z" transform={`rotate(${angle} 0 -14)`} />)}
  </g>;
}

function Lamp({ x, y, z = 0, h = 26 }: { x: number; y: number; z?: number; h?: number }) {
  const [cx, cy] = officeProject([x, y], z);
  return <g>
    <ellipse cx={cx} cy={cy} rx="6" ry="3" fill="#39403a" />
    <path d={`M${cx} ${cy}V${cy - h}`} stroke="#39403a" strokeWidth="2" />
    <path fill="#e1cb99" d={`M${cx - 4} ${cy - h - 8}h8l4 9h-16Z`} />
  </g>;
}

/** Glass and frames set into a wall, with the city's lights beyond them. */
function BackWindow({ x, y, w, z = 24, h = 38 }: { x: number; y: number; w: number; z?: number; h?: number }) {
  return <g transform={onBackWall(x, y, z + h)}>
    <rect width={w} height={h} fill="#16233a" />
    {[.14, .3, .46, .63, .8].map((u, index) => <rect key={u} x={w * u} y={h - 7 - index % 3 * 6} width="3" height="3" fill="#f4d9a0" opacity=".7" />)}
    <path d={`M${w / 2} 0v${h}`} stroke="#a9b8b2" strokeWidth="1.5" />
    <rect width={w} height={h} fill="none" stroke="#a9b8b2" strokeWidth="2.5" />
  </g>;
}

// The island the office stands on, in the same green and stone as the homepage's.
const noise = (index: number) => ((index * 2654435761) >>> 0) % 1000 / 1000;
const rim = [[-14, -14], [120, -22], [300, -14], [446, -20], [454, 36], [600, 32], [716, 60], [726, 130], [738, 220], [728, 330], [736, 430], [730, 546], [640, 552], [540, 560], [456, 556], [444, 600], [380, 608], [300, 604], [220, 606], [130, 600], [56, 592], [28, 440], [-20, 428], [-24, 220]] as const;
const frontEdge = rim.slice(6, 21).reverse();
// Stone tapers from the rim to a jagged keel, darkening as it falls away from the lights.
const keelX = officeProject([520, 520])[0];
const tier = ([x, y]: readonly [number, number], index: number, amount: number) => {
  const reach = Math.pow(Math.sin(Math.PI * index / (frontEdge.length - 1)), .9);
  const [sx, sy] = officeProject([x, y], -10);
  const depth = (24 + 118 * reach * (.66 + .5 * noise(index + 3))) * amount;
  const pull = amount * (.2 + .22 * noise(index + 11));
  return `${Math.round(sx + (keelX - sx) * pull)},${Math.round(sy + depth)}`;
};
const stone = [["#4c4a48", "#43413f", "#3a3937"], ["#5c5954", "#524f4b", "#474542"]];
const rockFacets = frontEdge.slice(1).map((point, index) => {
  const previous = frontEdge[index];
  const faces = stone[Math.abs(point[0] - previous[0]) > Math.abs(point[1] - previous[1]) ? 0 : 1];
  const [a, b] = [at(previous[0], previous[1], -10), at(point[0], point[1], -10)];
  const [c, d] = [tier(previous, index, .48), tier(point, index + 1, .48)];
  const [e, f] = [tier(previous, index, 1), tier(point, index + 1, 1)];
  const shade = (offset: number) => faces[(index + offset) % 3];
  return {
    soil: `${at(previous[0], previous[1])} ${at(point[0], point[1])} ${b} ${a}`,
    facets: [
      [`${e} ${f} ${d}`, "#1d1e22"], [`${e} ${d} ${c}`, "#26272b"],
      [`${c} ${d} ${b}`, shade(1)], [`${c} ${b} ${a}`, shade(0)],
    ],
  };
});

function Island() {
  return <g>
    {rockFacets.map((facet, index) => <g key={index}>
      {facet.facets.map(([points, fill]) => <polygon key={points} fill={fill} stroke={fill} strokeWidth=".5" points={points} />)}
      <polygon fill="#4a3f33" points={facet.soil} />
    </g>)}
    <polygon fill="#2f402c" points={rim.map(point => at(point[0], point[1])).join(" ")} />
    <polyline fill="none" stroke="#475c3f" strokeWidth="2" points={frontEdge.map(point => at(point[0], point[1])).join(" ")} />
    {([[706, 500, 1], [716, 300, .8], [690, 58, .9], [14, 410, 1], [480, 546, .7]] as const).map(([x, y, size]) => {
      const [cx, cy] = officeProject([x, y]);
      return <g key={`${x}-${y}`} transform={`translate(${cx} ${cy}) scale(${size})`}>
        <ellipse cx="3" cy="1" rx="12" ry="5" fill="#16201488" />
        <path fill="#3b5438" d="M-13-8 0-40 13-8Z" /><path fill="#4a6743" d="M-10-22 0-50 10-22Z" />
      </g>;
    })}
  </g>;
}

/** Taipei 101 across the city, fading into the dark above the right wing. */
function Tower({ fade }: { fade: string }) {
  const floors = Array.from({ length: 7 }, (_, index) => 86 + index * 36);
  return <g fill={`url(#${fade})`}>
    <path d="M902 12v34M897 46h10l3 14h-16Z" stroke="#7fa5a4" strokeWidth="1" />
    {floors.map(y => <g key={y}>
      <path d={`M880 ${y - 26}h44l6 36h-56Z`} />
      <path d={`M874 ${y + 10}h56`} stroke="#e6c79466" strokeWidth="1.5" />
      {[886, 896, 906, 916].map((x, index) => <rect key={x} x={x} y={y - 16 + (index % 2) * 10} width="4" height="3" fill="#f4d9a0" opacity=".42" />)}
    </g>)}
    <path d="M870 338l-10 60h86l-10-60Z" />
  </g>;
}

function Wall({ x, y, w, d, h = 28 }: { x: number; y: number; w: number; d: number; h?: number }) {
  return <Box x={x} y={y} w={w} d={d} h={h} tone={wall} />;
}

function Station({ id, active, children }: { id: OfficeStopId; active: OfficeStopId | null; children: ReactNode }) {
  return <g className={styles.station} data-station={id} data-active={active === id}>{children}</g>;
}

const spines = ["#7b4a3a", "#3e5a63", "#c49a5a", "#55624b", "#8c8574", "#a35f44", "#30414d", "#b8a988"];
/** One side of the Contrary shelves: real deep dives were written in this room. */
function Shelves({ x, y, w }: { x: number; y: number; w: number }) {
  return <g>
    <Box x={x} y={y} w={w} d={13} h={62} tone={pale} />
    {[50, 34, 18, 4].map((z, row) => <g key={z}>
      <polygon fill="#5c4b3a" points={`${at(x + 2, y + 13, z)} ${at(x + w - 2, y + 13, z)} ${at(x + w - 2, y + 13, z + 12)} ${at(x + 2, y + 13, z + 12)}`} />
      {Array.from({ length: Math.floor((w - 8) / 6) }, (_, index) => {
        const left = x + 4 + index * 6, tall = 8 + noise(index + row * 11) * 3;
        return noise(index * 3 + row) > .16 && <polygon key={index} fill={spines[Math.floor(noise(index + row * 7) * spines.length)]} points={`${at(left, y + 13, z)} ${at(left + 5, y + 13, z)} ${at(left + 5, y + 13, z + tall)} ${at(left, y + 13, z + tall)}`} />;
      })}
    </g>)}
  </g>;
}

/** The founder pipeline pinned to the booth wall: fewer notes each column along. */
function Pipeline({ x, y, z }: { x: number; y: number; z: number }) {
  return <g transform={onBackWall(x, y, z)}>
    <rect width="104" height="34" fill="#f1e8d4" />
    {[5, 4, 2, 1].map((count, column) => Array.from({ length: count }, (_, row) => <rect key={`${column}-${row}`} x={5 + column * 25} y={3 + row * 6} width="20" height="4.5" fill={["#e6c794", "#b9c9a4", "#d39b7c", "#7fa5a4"][column]} />))}
  </g>;
}

/** A small, directly drawn office: every station is backed by an HTML button. */
export default function OfficePlan({ workerRef, glowRef, lit, active }: { workerRef: Ref<SVGGElement>; glowRef: Ref<SVGGElement>; lit: OfficeStopId | null; active: OfficeStopId }) {
  const id = useId();
  const [night, hole, warm, halo, fade] = ["night", "hole", "warm", "halo", "fade"].map(name => `${id}${name}`);
  const stop = officeStops.find(item => item.id === active)!;
  const [startX, startY] = officeProject(stop.point);
  const body = [
    `${at(18, 18)} ${at(424, 18)} ${at(424, 66)} ${at(704, 66)} ${at(704, 536)} ${at(432, 536)} ${at(432, 584)} ${at(58, 584)} ${at(58, 400)} ${at(18, 400)}`,
    `${at(18, 400, 76)} ${at(18, 18, 76)} ${at(424, 18, 76)} ${at(424, 18)} ${at(426, 26)} ${at(18, 400)}`,
    `${at(424, 66, 76)} ${at(704, 66, 76)} ${at(704, 66)} ${at(704, 74)} ${at(424, 90)}`,
    `${at(58, 576, 76)} ${at(58, 396, 76)} ${at(428, 396, 42)} ${at(432, 576)} ${at(58, 576)}`,
    `${at(704, 72, 24)} ${at(704, 536, 24)} ${at(432, 536, 24)} ${at(432, 584, 24)} ${at(58, 584, 24)} ${at(58, 584)} ${at(432, 584)} ${at(432, 536)} ${at(704, 536)} ${at(704, 72)}`,
  ];
  return <svg className={styles.drawing} viewBox={`0 0 ${officeView.width} ${officeView.height}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={hole}><stop offset=".45" stopColor="#000" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      <radialGradient id={warm}><stop offset="0" stopColor="#ffd696" stopOpacity=".32" /><stop offset="1" stopColor="#ffc877" stopOpacity="0" /></radialGradient>
      <radialGradient id={halo}><stop offset="0" stopColor="#fff3cf" /><stop offset=".22" stopColor="#ffdf9e" stopOpacity=".8" /><stop offset="1" stopColor="#ffcf7a" stopOpacity="0" /></radialGradient>
      <linearGradient id={fade} x1="0" y1="20" x2="0" y2="390" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#4f7a7c" /><stop offset=".65" stopColor="#253d44" /><stop offset="1" stopColor="#101a22" /></linearGradient>
      <mask id={night} maskUnits="userSpaceOnUse" x="0" y="0" width={officeView.width} height={officeView.height}>
        {body.map(points => <polygon key={points} points={points} fill="#fff" />)}
        {officeStops.map(item => {
          const [cx, cy] = officeProject(item.light);
          return <g key={item.id} className={styles.station} data-station={item.id} data-active={lit === item.id}>
            <ellipse className={styles.lightHole} fill={`url(#${hole})`} cx={cx} cy={cy - 18} rx={item.reach * 1.5} ry={item.reach * 1.02} />
          </g>;
        })}
        <g ref={glowRef} style={{ transform: `translate(${startX}px, ${startY}px)` }}>
          <ellipse fill={`url(#${hole})`} cy="-16" rx="62" ry="42" opacity=".62" />
        </g>
      </mask>
    </defs>

    <Tower fade={fade} />
    <Island />

    <g>
      <polygon fill="#d9ceb6" points={`${at(24, 24)} ${at(424, 24)} ${at(424, 352)} ${at(24, 352)}`} />
      <path stroke="#8a795c26" strokeWidth="1" d={Array.from({ length: 12 }, (_, index) => `M${at(24, 50 + index * 26)} L${at(424, 50 + index * 26)}`).join(" ")} />
      <polygon fill="#a9a99b" points={`${at(24, 352)} ${at(424, 352)} ${at(424, 400)} ${at(24, 400)}`} />
      <polygon fill="#a9a99b" points={`${at(424, 72)} ${at(464, 72)} ${at(464, 528)} ${at(424, 528)}`} />
      <path stroke="#7c7d7030" strokeWidth="1" d={Array.from({ length: 12 }, (_, index) => `M${at(424, 96 + index * 36)} L${at(464, 96 + index * 36)}`).join(" ")} />
      <polygon fill="#c5cabb" points={`${at(464, 72)} ${at(696, 72)} ${at(696, 264)} ${at(464, 264)}`} />
      <polygon fill="#d1c1a5" points={`${at(464, 264)} ${at(696, 264)} ${at(696, 528)} ${at(464, 528)}`} />
      <polygon fill="#cfc3ae" points={`${at(64, 400)} ${at(424, 400)} ${at(424, 576)} ${at(64, 576)}`} />
      <path stroke="#8a795c20" strokeWidth="1" d={Array.from({ length: 6 }, (_, index) => `M${at(64, 426 + index * 26)} L${at(424, 426 + index * 26)}`).join(" ")} />
    </g>

    {/* Tall back walls, then everything else from far to near. */}
    <Box x={18} y={18} w={406} d={6} h={74} tone={wall} />
    <Box x={18} y={24} w={6} d={376} h={74} tone={wall} />
    <polygon fill="#ece2cd" points={`${at(24, 24)} ${at(424, 24)} ${at(424, 24, 74)} ${at(24, 24, 74)}`} />
    <polygon fill="#e2d7c0" points={`${at(24, 24)} ${at(24, 400)} ${at(24, 400, 74)} ${at(24, 24, 74)}`} />
    <BackWindow x={196} y={24} w={52} />
    <g transform={onSideWall(24, 208, 62)}>
      <rect width="74" height="38" fill="#16233a" />
      {[10, 22, 38, 50, 62].map((u, index) => <rect key={u} x={u} y={28 - index % 3 * 7} width="3" height="3" fill="#f4d9a0" opacity=".7" />)}
      <path d="M37 0v38" stroke="#a9b8b2" strokeWidth="1.5" /><rect width="74" height="38" fill="none" stroke="#a9b8b2" strokeWidth="2.5" />
    </g>
    <text className={styles.wallSign} transform={onBackWall(34, 24, 50)}>886 STUDIOS</text>

    <Station id="now" active={lit}>
      <Plant x={46} y={48} size={.9} />
      <Desk x={64} y={75} w={116} d={31} />
      <Monitor x={99} y={80} />
      <Sheet x={73} y={84} z={20} /><Box x={101} y={95} w={27} d={7} z={20} h={1.5} tone={paper} />
      <Mug x={146} y={96} z={20} /><Lamp x={166} y={88} z={20} />
      <Chair x={114} y={120} back="y+" />
    </Station>

    <Station id="accelerator" active={lit}>
      <g transform={onBackWall(266, 24, 66)}>
        <rect width="136" height="46" fill="#fbf7ec" stroke="#8f9694" strokeWidth="2" />
        <path d="M12 12h46M12 20h34M12 28h40" stroke="#5d7a8c" strokeWidth="2" strokeLinecap="round" />
        <path d="M72 34c10-20 22-20 32-8 6 7 12 2 20-16" fill="none" stroke="#b5583f" strokeWidth="2" strokeLinecap="round" />
        {[[70, 8, "#e6c794"], [86, 8, "#b9c9a4"], [102, 8, "#d39b7c"]].map(([x, y, fill]) => <rect key={x} x={x as number} y={y as number} width="11" height="11" fill={fill as string} />)}
      </g>
      <Rug x={254} y={68} w={150} d={100} />
      <Chair x={329} y={76} back="y-" /><Chair x={266} y={112} back="x-" />
      <Desk x={284} y={90} w={90} d={44} />
      <Sheet x={300} y={100} z={20} w={17} d={22} /><Sheet x={324} y={104} z={20} /><Mug x={358} y={110} z={20} />
      <Chair x={392} y={112} back="x+" /><Chair x={329} y={155} back="y+" />
    </Station>

    <Station id="community" active={lit}>
      <Rug x={54} y={234} w={150} d={64} fill="#b19e7f" />
      <Shadow x={64} y={246} w={96} d={36} />
      <Box x={64} y={246} w={96} d={9} z={0} h={28} tone={sage} />
      <Box x={64} y={255} w={96} d={27} h={14} tone={sage} />
      <Box x={64} y={246} w={8} d={36} h={20} tone={sage} /><Box x={152} y={246} w={8} d={36} h={20} tone={sage} />
      <Box x={177} y={250} w={26} d={32} h={14} tone={wood} /><Mug x={190} y={266} z={14} />
      {/* The mic for founder events, and string lights over the sofa. */}
      <path d={`M${at(214, 296)} L${at(214, 296, 40)}`} stroke="#39403a" strokeWidth="2.5" />
      <circle cx={officeProject([214, 296], 44)[0]} cy={officeProject([214, 296], 44)[1]} r="4" fill="#39403a" />
      <path d={`M${at(40, 232, 72)} L${at(40, 232)} M${at(208, 232, 66)} L${at(208, 232)}`} stroke="#5b5a4c" strokeWidth="2" />
      <path className={styles.festoonCord} d={`M${at(40, 232, 72)} Q${at(124, 232, 42)} ${at(208, 232, 66)}`} />
    </Station>

    <Station id="founders" active={lit}>
      <Box x={278} y={218} w={118} d={6} h={46} tone={pale} />
      <Pipeline x={282} y={224} z={44} />
      {[304, 368].map(x => <g key={x}>
        <Desk x={x - 19} y={228} w={38} d={12} />
        <Monitor x={x - 12} y={228} w={24} />
        <Chair x={x} y={250} back="y+" />
      </g>)}
    </Station>

    {/* The aisle's south wall, with the studio's door in it. */}
    <Wall x={20} y={348} w={184} d={8} /><Wall x={256} y={348} w={172} d={8} />
    <Wall x={420} y={68} w={8} d={120} /><Wall x={420} y={228} w={8} d={124} />

    {/* The personal space, reached from the corridor. */}
    <Box x={58} y={400} w={6} d={176} h={74} tone={wall} />
    <polygon fill="#e2d7c0" points={`${at(64, 400)} ${at(64, 576)} ${at(64, 576, 74)} ${at(64, 400, 74)}`} />
    <Wall x={58} y={396} w={132} d={8} h={40} /><Wall x={340} y={396} w={88} d={8} h={40} />
    <g transform={onSideWall(64, 548, 60)}>
      <rect width="120" height="26" fill="#a98f74" />
      {Array.from({ length: 18 }, (_, index) => <rect key={index} x={4 + index * 6.2} y={26 - 8 - noise(index) * 12} width="5" height={8 + noise(index) * 12} fill={spines[index % spines.length]} />)}
    </g>
    <Station id="side" active={lit}>
      <Shadow x={80} y={416} w={116} d={28} /><Shadow x={80} y={444} w={28} d={56} />
      <Box x={84} y={418} w={4} d={78} h={16} tone={dark} /><Box x={188} y={420} w={4} d={20} h={16} tone={dark} />
      <Box x={80} y={416} w={116} d={28} z={16} h={4} tone={wood} /><Box x={80} y={444} w={28} d={56} z={16} h={4} tone={wood} />
      <Monitor x={118} y={420} w={40} chart />
      <Box x={86} y={452} w={16} d={22} z={20} h={1.5} tone={steel} />
      <Box x={168} y={424} w={18} d={14} z={20} h={5} tone={paper} /><Box x={170} y={426} w={18} d={14} z={25} h={5} tone={paper} />
      <Mug x={110} y={434} z={20} />
      <Chair x={148} y={468} back="y+" />
      {/* The moped from the traffic game. */}
      <g>
        <Shadow x={196} y={520} w={30} d={12} />
        <Box x={196} y={522} w={36} d={9} z={7} h={7} tone={["#b5583f", "#924433", "#7d3a2c"]} />
        <Box x={222} y={522} w={8} d={9} z={14} h={16} tone={["#b5583f", "#924433", "#7d3a2c"]} />
        <Box x={198} y={522} w={18} d={9} z={14} h={3} tone={dark} />
        {[200, 228].map(x => { const [cx, cy] = officeProject([x, 532], 5); return <ellipse key={x} cx={cx} cy={cy} rx="6" ry="6.5" fill="#23292a" />; })}
      </g>
    </Station>
    <Station id="about" active={lit}>
      {/* The bike against the wall. */}
      <g transform={onBackWall(346, 404, 24)} fill="none" stroke="#39505a" strokeWidth="2">
        <circle cx="10" cy="14" r="10" /><circle cx="50" cy="14" r="10" />
        <path d="M10 14 24 14 40 0H20L24 14M40 0l10 14M20 0l-2-5M40 0l-1-7h6" />
      </g>
      <Rug x={282} y={439} w={118} d={69} fill="#a8a68c" />
      <Shadow x={298} y={452} w={60} d={40} />
      <Box x={298} y={452} w={60} d={9} h={26} tone={sage} />
      <Box x={298} y={461} w={60} d={31} h={13} tone={sage} />
      <Box x={298} y={452} w={8} d={40} h={18} tone={sage} /><Box x={350} y={452} w={8} d={40} h={18} tone={sage} />
      <Box x={374} y={460} w={24} d={22} h={15} tone={wood} /><Lamp x={392} y={464} z={15} h={22} />
      {/* Poker chips and a hand of cards, then a ball by the sofa. */}
      {([[378, 472, "#b5433a", 3], [386, 476, "#f2ead8", 2]] as const).map(([x, y, fill, count]) => {
        const [cx, cy] = officeProject([x, y], 15);
        return <g key={x}>{Array.from({ length: count }, (_, index) => <ellipse key={index} cx={cx} cy={cy - index * 2.2} rx="4" ry="2" fill={fill} stroke="#00000030" strokeWidth=".5" />)}</g>;
      })}
      {(() => { const [cx, cy] = officeProject([270, 524]); return <g transform={`translate(${cx} ${cy})`}>
        <ellipse cx="2" cy="1" rx="11" ry="5" fill="#2a2a2038" />
        <circle cy="-10" r="10" fill="#c9702f" />
        <path d="M-10-10h20M0-20v20M-7-17q5 7 0 14M7-17q-5 7 0 14" fill="none" stroke="#5c2f12" strokeWidth="1" />
      </g>; })()}
    </Station>
    <Plant x={396} y={424} size={.8} />

    {/* The corridor's east walls stand in front of everything west of them. */}
    <Wall x={420} y={396} w={8} d={136} />
    <Wall x={460} y={68} w={8} d={80} /><Wall x={460} y={180} w={8} d={150} /><Wall x={460} y={366} w={8} d={166} />
    <Box x={424} y={66} w={278} d={6} h={74} tone={wall} />
    <polygon fill="#ece2cd" points={`${at(424, 72)} ${at(696, 72)} ${at(696, 72, 74)} ${at(424, 72, 74)}`} />

    <Station id="research" active={lit}>
      <Shelves x={478} y={72} w={180} />
      <Plant x={675} y={96} size={.8} />
      <Desk x={506} y={108} w={132} d={36} />
      <Monitor x={535} y={113} w={33} />
      <Box x={539} y={134} w={26} d={7} z={20} h={1.5} tone={paper} />
      {[0, 3, 6, 9].map((z, index) => <Box key={z} x={586 + index % 2} y={116} w={18} d={22} z={20 + z} h={3} tone={paper} />)}
      <Lamp x={625} y={124} z={20} />
      <Chair x={552} y={164} back="y+" />
      {[0, 14].map(y => <Box key={y} x={648} y={166 + y} w={28} d={14} h={30 - y} tone={steel} />)}
      {[0, 4, 8, 12].map(z => <Box key={z} x={496} y={206} w={22} d={16} z={z} h={4} tone={z % 8 ? paper : ["#c2d1cc", "#9fb0ab", "#8c9e99"]} />)}
    </Station>

    <Box x={464} y={260} w={236} d={8} h={36} tone={wall} />
    <g transform={onBackWall(482, 268, 34)}>
      <path d="M0 0v18L50 9Z" fill="#26476f" /><path d="M6 6.5h22M6 11h14" stroke="#f0c94a" strokeWidth="2" />
    </g>

    <Station id="slug" active={lit}>
      <Rug x={490} y={282} w={178} d={108} fill="#a29a7d" />
      <Chair x={552} y={283} back="y-" /><Chair x={606} y={283} back="y-" /><Chair x={504} y={332} back="x-" />
      <Desk x={524} y={296} w={112} d={65} />
      <Sheet x={540} y={308} z={20} w={23} d={30} /><Sheet x={590} y={320} z={20} w={20} d={26} /><Mug x={574} y={312} z={20} />
      {/* A banana slug, the mascot of UC Santa Cruz. */}
      {(() => { const [cx, cy] = officeProject([616, 310], 20); return <g transform={`translate(${cx} ${cy})`}>
        <path fill="#f0c94a" d="M-13 2c-1-5 6-8 13-8 5 0 7-5 9-7 2 3 3 7 2 10C10 2 2 4-13 2Z" />
        <path d="M9-13l-1-4m3 4 2-3" stroke="#a88a24" strokeWidth="1" />
        <circle cx="-4" cy="-2" r="1" fill="#a88a24" /><circle cx="1" cy="-3" r="1" fill="#a88a24" />
      </g>; })()}
      <Chair x={654} y={332} back="x+" /><Chair x={552} y={380} back="y+" /><Chair x={606} y={380} back="y+" />
    </Station>
    <Plant x={668} y={462} />

    {/* Front walls, cut low to show the rooms. */}
    <Box x={696} y={72} w={8} d={460} h={22} tone={wall} />
    <Box x={464} y={528} w={240} d={8} h={22} tone={wall} />
    <Box x={64} y={576} w={368} d={8} h={22} tone={wall} />
    <Box x={424} y={528} w={8} d={56} h={22} tone={wall} />
    <Box x={424} y={528} w={44} d={8} h={22} tone={wall} />

    {/* Night falls on the building; a lit station is a hole in it. */}
    <rect className={styles.darkness} mask={`url(#${night})`} width={officeView.width} height={officeView.height} />

    {officeStops.map(item => {
      const [cx, cy] = officeProject(item.light);
      return <g key={item.id} className={styles.station} data-station={item.id} data-active={lit === item.id}>
        <ellipse className={styles.wash} fill={`url(#${warm})`} cx={cx} cy={cy - 8} rx={item.reach * 1.3} ry={item.reach * .8} />
      </g>;
    })}
    {/* The bulbs themselves stay above the dark. */}
    {([["now", 166, 88, 52], ["research", 625, 124, 52], ["about", 392, 464, 42]] as const).map(([station, x, y, z]) => {
      const [cx, cy] = officeProject([x, y], z);
      return <g key={station} className={styles.station} data-station={station} data-active={lit === station}>
        <circle className={styles.bulb} fill={`url(#${halo})`} cx={cx} cy={cy} r="26" />
      </g>;
    })}
    <g className={styles.station} data-station="community" data-active={lit === "community"}>
      {[.12, .3, .5, .7, .88].map(t => {
        const lift = 72 * (1 - t) * (1 - t) + 2 * 42 * (1 - t) * t + 66 * t * t;
        const [cx, cy] = officeProject([40 + t * 168, 232], lift);
        return <circle key={t} className={styles.bulb} fill={`url(#${halo})`} cx={cx} cy={cy} r="11" />;
      })}
    </g>
    {([["accelerator", 329, 112], ["founders", 336, 262], ["slug", 580, 330], ["side", 138, 440]] as const).map(([station, x, y]) => {
      const [cx, cy] = officeProject([x, y], 76);
      return <g key={station} className={styles.station} data-station={station} data-active={lit === station}>
        <path className={styles.pendantCord} d={`M${cx} ${cy - 44}V${cy - 8}`} />
        <path className={styles.pendant} d={`M${cx - 4} ${cy - 9}h8l5 9h-18Z`} />
        <circle className={styles.bulb} fill={`url(#${halo})`} cx={cx} cy={cy + 2} r="24" />
      </g>;
    })}

    <g className={styles.worker} ref={workerRef} data-walking="false" style={{ transform: `translate(${startX}px, ${startY}px)` }}>
      <g data-worker-facing>
        <g className={styles.workerBody}>
          <ellipse fill="#16181630" cx="1" cy="1" rx="10" ry="5" />
          <path className={styles.leftLeg} d="M-3-14v13" /><path className={styles.rightLeg} d="M3-14v13" />
          <path fill="#c4623f" d="M-8-30q0-4 4-4h8q4 0 4 4v15q0 2-2 2H-6q-2 0-2-2Z" />
          <path d="M-8-29l-2 12M8-29l2 12" stroke="#d9b08c" strokeWidth="3" strokeLinecap="round" />
          <circle fill="#d9b08c" cy="-41" r="8" />
          <path data-worker-hair="front" fill="#2c2620" d="M-8-41a8 8 0 0 1 16 0q-3-4-8-4t-8 4Z" />
          <path data-worker-hair="back" fill="#2c2620" d="M-8-41a8 8 0 0 1 16 0q0 5-3 7H-5q-3-2-3-7Z" />
        </g>
      </g>
    </g>
  </svg>;
}
