// Preserve Next's history state while keeping the current world shareable.
// Replacing (rather than pushing) avoids adding every scroll stop to Back.
export function rememberIsland(id: string) {
  if (location.pathname !== "/2.0") return;
  const hash = id === "intro" ? "" : `#${id}`;
  if (location.hash !== hash) history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
}
