import styles from "./IslandHome.module.css";

// The pull chain each island's light hangs from: a hairline cord, a bead
// that glows while the light is on, and the word for what to do with it.
export function PullChain() {
  return <>
    <span className={styles.chainCord} aria-hidden="true" />
    <span className={styles.chainBead} data-bead aria-hidden="true" />
    <span className={styles.chainLabel} aria-hidden="true">pull</span>
  </>;
}

// A click tugs the cord down; it springs back on its own.
export function tug(button: HTMLElement) {
  button.dataset.tug = "";
  window.setTimeout(() => { delete button.dataset.tug; }, 260);
}
