// Preserve Next's history state while keeping the current world shareable.
// Replacing (rather than pushing) avoids adding every scroll stop to Back.
export function rememberIsland(id: string) {
  if (location.pathname !== "/") return;
  const hash = id === "intro" ? "" : `#${id}`;
  if (location.hash !== hash) history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
}

// Where "Back to islands" leads from a page: the homepage view the visitor
// left from, for this tab. Without one (a direct visit), the page's island.
const RETURN_KEY = "islands-return";
export function rememberReturn(id: string) {
  try { sessionStorage.setItem(RETURN_KEY, id); } catch { /* Storage blocked: fall back to the page's island. */ }
}
export function islandReturn(fallback: string) {
  let id: string | null = null;
  try { id = sessionStorage.getItem(RETURN_KEY); } catch { /* Storage blocked. */ }
  const stop = id ?? fallback;
  return stop === "intro" ? "/" : `/#${stop}`;
}
