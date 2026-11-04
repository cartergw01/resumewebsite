import { useId, type Ref } from "react";
import { officeSize, officeStops, type OfficeStopId } from "@/lib/office-plan";
import styles from "./OfficeExplorer.module.css";

function Chair({ x, y, angle = 0 }: { x: number; y: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <rect className={styles.objectShadow} x="-11" y="-7" width="22" height="23" rx="7" />
    <rect className={styles.chair} x="-10" y="-10" width="20" height="22" rx="6" />
    <path className={styles.chairBack} d="M-9 9q9 5 18 0" />
  </g>;
}

function Plant({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <circle className={styles.objectShadow} cy="3" r="12" />
    <circle fill="#b6a28a" r="10" />
    <g className={styles.leaves}>
      {[0, 72, 144, 216, 288].map(angle => <ellipse key={angle} cy="-8" rx="5" ry="12" transform={`rotate(${angle})`} />)}
    </g>
    <circle fill="#74856c" r="4" />
  </g>;
}

function Lamp({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse className={styles.lampGlow} cx="-12" cy="9" rx="30" ry="20" />
    <circle fill="#4c5148" r="5" />
    <path d="M0 0 6-8-3-13" fill="none" stroke="#41483f" strokeWidth="3" strokeLinecap="round" />
    <path className={styles.lampShade} d="m-3-18 7 10h-15z" />
  </g>;
}

function Mug({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle cx="5" r="3" fill="none" stroke="#ede4d3" strokeWidth="2" />
    <circle r="5" fill="#eee4cf" /><circle r="3" fill="#71533d" />
    <path className={styles.steam} d="M-2-8q-4-4 0-8m6 6q4-4 0-8" />
  </g>;
}

const outerFloor = "M24 24H424V72H696V528H424V576H64V400H24Z";
const walls = "M24 204V24H424V72H696V528H424V576H64V400H24V244 M424 72V188m0 40v100m0 72v128 M24 352H204m52 0H424 M464 72v76m0 32v150m0 36v162 M464 264H696 M64 400h126m150 0h84";

/** A small, directly drawn office: every station is backed by an HTML button. */
export default function OfficePlan({ workerRef, active }: { workerRef: Ref<SVGGElement>; active: OfficeStopId }) {
  const grain = useId();
  const stop = officeStops.find(item => item.id === active)!;
  return <svg className={styles.drawing} viewBox={`0 0 ${officeSize.width} ${officeSize.height}`} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={grain} width="104" height="28" patternUnits="userSpaceOnUse">
        <path d="M0 28h104M52 0v28" stroke="#796a5114" strokeWidth="1" fill="none" />
      </pattern>
    </defs>
    <path className={styles.buildingShadow} d={outerFloor} transform="translate(0 8)" />
    <path fill="#bbb9a9" d={outerFloor} />
    <path className={styles.studioFloor} d="M24 24H424V352H24Z" />
    <path d="M24 24H424V352H24Z" fill={`url(#${grain})`} />
    <path fill="#ced0c2" d="M464 72H696V264H464Z" />
    <path fill="#d4c6ae" d="M464 264H696V528H464Z" />
    <path fill="#d2c7b4" d="M64 400H424V576H64Z" />
    <path d="M64 400H424V576H64Z" fill={`url(#${grain})`} />
    <g className={styles.floorDetails}>
      <path d="M424 96h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40m-40 36h40" />
    </g>

    <g className={styles.station} data-station="now" data-active={active === "now"}>
      <Chair x={114} y={120} />
      <rect className={styles.objectShadow} x="64" y="79" width="116" height="31" rx="4" />
      <rect className={styles.wood} x="64" y="75" width="116" height="31" rx="4" />
      <rect className={styles.monitor} x="99" y="78" width="30" height="13" rx="2" />
      <path d="M114 91v5m-6 0h12" className={styles.furnitureLine} />
      <rect className={styles.keyboard} x="101" y="98" width="27" height="4" rx="1" />
      <rect className={styles.paper} x="73" y="83" width="13" height="18" rx="1" transform="rotate(-7 79 92)" />
      <Lamp x={164} y={91} /><Mug x={145} y={96} />
    </g>

    <g className={styles.station} data-station="accelerator" data-active={active === "accelerator"}>
      <rect className={styles.rug} x="254" y="75" width="150" height="91" rx="16" />
      <Chair x={266} y={112} angle={90} /><Chair x={392} y={112} angle={-90} />
      <Chair x={329} y={76} angle={180} /><Chair x={329} y={155} />
      <rect className={styles.objectShadow} x="284" y="94" width="90" height="44" rx="20" />
      <rect className={styles.wood} x="284" y="90" width="90" height="44" rx="20" />
      <g className={styles.tablePapers}>
        <rect className={styles.paper} x="302" y="101" width="17" height="22" rx="1" transform="rotate(-8 310 112)" />
        <path className={styles.paperLine} d="m306 107 9-1m-9 6 9-1m-9 6 6-1" />
      </g>
      <Mug x={351} y={109} />
    </g>

    <g className={styles.station} data-station="community" data-active={active === "community"}>
      <rect className={styles.rug} x="54" y="234" width="150" height="64" rx="8" />
      <rect className={styles.objectShadow} x="64" y="250" width="96" height="36" rx="7" />
      <rect className={styles.sofa} x="64" y="246" width="96" height="36" rx="7" />
      <path className={styles.sofaSeam} d="M73 255h78m-39 0v22M70 251v26m84-26v26" />
      <rect className={styles.wood} x="177" y="250" width="26" height="32" rx="12" />
      <Mug x={189} y={265} />
    </g>

    <g className={styles.station} data-station="founders" data-active={active === "founders"}>
      <path className={styles.boothWall} d="M280 255v-31h114v31M338 224v31" />
      {[304, 368].map(x => <g key={x}>
        <Chair x={x} y={250} />
        <rect className={styles.wood} x={x - 19} y="228" width="38" height="12" rx="2" />
        <rect className={styles.boothScreen} x={x - 9} y="228" width="18" height="8" rx="1" />
      </g>)}
    </g>

    <g className={styles.station} data-station="research" data-active={active === "research"}>
      <Chair x={552} y={164} />
      <rect className={styles.objectShadow} x="506" y="112" width="132" height="36" rx="3" />
      <rect className={styles.wood} x="506" y="108" width="132" height="36" rx="3" />
      <rect className={styles.monitor} x="535" y="113" width="33" height="17" rx="2" />
      <path className={styles.furnitureLine} d="M552 130v4m-6 0h12" />
      <rect className={styles.keyboard} x="539" y="136" width="26" height="4" rx="1" />
      <rect className={styles.paper} x="585" y="117" width="17" height="22" rx="1" transform="rotate(9 593 128)" />
      <path className={styles.paperLine} d="m589 123 9 1m-9 4 9 1m-9 4 6 1" />
      <Lamp x={624} y={126} />
      <rect fill="#a6967f" x="651" y="164" width="24" height="51" rx="2" />
      <path stroke="#e3d9c7" strokeWidth="3" d="M655 172h16m-16 7h16m-16 7h16m-16 7h16m-16 7h16m-16 7h16" />
    </g>

    <g className={styles.station} data-station="slug" data-active={active === "slug"}>
      <rect className={styles.rug} x="490" y="282" width="178" height="108" rx="8" />
      <Chair x={504} y={346} angle={90} /><Chair x={654} y={346} angle={-90} />
      <Chair x={552} y={283} angle={180} /><Chair x={606} y={283} angle={180} />
      <Chair x={552} y={380} /><Chair x={606} y={380} />
      <rect className={styles.objectShadow} x="524" y="300" width="112" height="65" rx="18" />
      <rect className={styles.wood} x="524" y="296" width="112" height="65" rx="18" />
      <g className={styles.tablePapers}>
        <rect className={styles.paper} x="542" y="311" width="23" height="30" rx="1" transform="rotate(-5 554 325)" />
        <path className={styles.paperLine} d="m547 317 12-1m-12 7 12-1m-12 7 8-1" />
        <rect className={styles.paper} x="595" y="317" width="20" height="27" rx="1" transform="rotate(7 605 330)" />
      </g>
      <Mug x={579} y={309} />
    </g>

    <g className={styles.station} data-station="side" data-active={active === "side"}>
      <Chair x={148} y={468} />
      <path className={styles.objectShadow} d="M80 420h116v28H108v52H80Z" />
      <path className={styles.wood} d="M80 416h116v28H108v52H80Z" />
      <rect fill="#b8b8ab" x="84" y="421" width="23" height="17" rx="3" />
      <rect fill="#858e84" x="87" y="423" width="17" height="12" rx="2" />
      <path className={styles.furnitureLine} d="M96 420v8m-3-8q3-4 6 0" />
      <rect fill="#555b51" x="166" y="418" width="19" height="20" rx="3" />
      <circle fill="#d9d0ba" cx="176" cy="426" r="5" /><Mug x={148} y={434} />
    </g>

    <g className={styles.station} data-station="about" data-active={active === "about"}>
      <rect className={styles.rug} x="282" y="439" width="118" height="69" rx="8" />
      <rect className={styles.objectShadow} x="298" y="456" width="60" height="40" rx="8" />
      <rect className={styles.sofa} x="298" y="452" width="60" height="40" rx="8" />
      <path className={styles.sofaSeam} d="M306 484h44m-45-25v25m46-25v25" />
      <circle className={styles.wood} cx="384" cy="470" r="12" />
      <Lamp x={384} y={468} />
    </g>

    <Plant x={391} y={51} size={.85} />
    <Plant x={669} y={100} size={.8} /><Plant x={667} y={430} />
    <Plant x={390} y={418} size={.8} />
    <path className={styles.wallShadow} d={walls} transform="translate(0 4)" />
    <path className={styles.walls} d={walls} />
    <g className={styles.windows}>
      <path d="M24 204v40m4-40v40M101 24h230M101 28h230M696 96v134M692 96v134M696 302v168M692 302v168" />
    </g>
    <g className={styles.doors}>
      <path d="M464 148h30M464 330h30M204 352v-30" />
      <path className={styles.doorSwing} d="M494 148a30 30 0 0 1-30 30m30 152a30 30 0 0 1-30 30m-260-38a30 30 0 0 1 30 30" />
    </g>
    <g className={styles.worker} ref={workerRef} data-walking="false" style={{ transform: `translate(${stop.point[0]}px, ${stop.point[1]}px)` }}>
      <g data-worker-facing style={{ transform: `rotate(${stop.facing}deg)` }}>
        <g className={styles.workerBody}>
          <ellipse className={styles.workerShadow} cy="3" rx="11" ry="9" />
          <path className={styles.leftFoot} d="M-4 4v6" /><path className={styles.rightFoot} d="M4 4v6" />
          <rect className={styles.workerShirt} x="-9" y="-5" width="18" height="13" rx="6" />
          <circle fill="#caa480" cx="-9" cy="-3" r="2.5" /><circle fill="#caa480" cx="9" cy="-3" r="2.5" />
          <circle fill="#caa480" cy="-5" r="5.5" /><path fill="#3e3931" d="M-5.5-5a5.5 5.5 0 0 1 11 0q-5.5 5-11 0" />
        </g>
      </g>
    </g>
  </svg>;
}
