import styles from "./WorkEntry.module.css";

export default function TaipeiMark() {
  return <span className={styles.place}>
    <svg viewBox="0 0 20 60" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round">
        <path d="M10 2V8M8 8H12L13 12H7L8 8ZM8 54H12L14 59H6L8 54Z" />
        {Array.from({ length: 8 }, (_, index) => <path key={index} d={`M6 ${14 + index * 5}h8l-1 4H7Z`} />)}
      </g>
      <circle data-work-spark-target cx="10" cy="2" r="1.5" />
    </svg>
    <span>Taipei</span>
  </span>;
}
