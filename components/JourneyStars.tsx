import styles from "./IslandHome.module.css";

// Deterministic, sparse stars sit above the distant video. Transforming each
// wrapper gives the camera depth without a canvas loop or per-star updates.
const coordinate = (index: number, salt: number, range: number) => {
  let hash = Math.imul(index + salt, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) % range;
};
const middle = Array.from({ length: 32 }, (_, i) => ({
  x: coordinate(i, 7, 1200),
  y: coordinate(i, 41, 800),
  radius: i % 4 === 0 ? 1.5 : 0.8,
}));
const near = Array.from({ length: 13 }, (_, i) => ({
  x: coordinate(i, 19, 1200),
  y: coordinate(i, 53, 800),
  length: 80 + coordinate(i, 83, 120),
}));

export default function JourneyStars() {
  return <>
    <div className={styles.middleStars} data-depth-stars="middle" aria-hidden="true">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="journey-middle" width="1200" height="800" patternUnits="userSpaceOnUse">
            {middle.map((star, i) => <circle key={i} cx={star.x} cy={star.y} r={star.radius} fill={i % 3 === 0 ? "#f2d9ab" : "#b9d4f5"} opacity={i % 3 === 0 ? 0.8 : 0.5} />)}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#journey-middle)" />
      </svg>
    </div>
    <div className={styles.flightStars} data-flight-stars data-depth-stars="near" aria-hidden="true">
      <svg width="100%" height="100%">
        <defs>
          <linearGradient id="journey-trail" gradientUnits="userSpaceOnUse" x1="-160" y1="0" x2="0" y2="0">
            <stop stopColor="#accfff" stopOpacity="0" />
            <stop offset="0.85" stopColor="#b4d6ff" stopOpacity="0.65" />
            <stop offset="1" stopColor="#fff1d7" />
          </linearGradient>
          <pattern id="journey-near" width="1200" height="800" patternUnits="userSpaceOnUse">
            {near.map((star, i) => <g key={i} transform={`translate(${star.x} ${star.y})`}>
              <path className={styles.depthTrail} d={`M-${star.length} 0H0`} stroke="url(#journey-trail)" strokeWidth="1.3" strokeLinecap="round" />
              <circle r={i % 3 === 0 ? 1.8 : 1.1} fill="#e6efff" />
            </g>)}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#journey-near)" />
      </svg>
    </div>
  </>;
}
