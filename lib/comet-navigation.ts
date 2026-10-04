const curveY = (x: number, width: number) => 46 - 36 * (x / width) * (1 - x / width);

// The head is positioned by scroll, never by easing. Only the trailing light
// has inertia, on a short-lived frame loop independent of the island camera.
export function createCometNavigation(nav: HTMLElement, motion: MediaQueryList) {
  const head = nav.querySelector<HTMLElement>("[data-scene-comet]")!;
  const rail = nav.querySelector<SVGPathElement>("[data-comet-path]")!;
  const svg = nav.querySelector<SVGSVGElement>("[data-comet-light]")!;
  const tails = Array.from(nav.querySelectorAll<SVGPathElement>("[data-comet-tail]"));
  const gradient = nav.querySelector<SVGLinearGradientElement>("[data-comet-gradient]")!;
  let width = 1, x = 0, direction = 1;
  let previousX: number | null = null, previousTime = 0, lastMovement = 0;
  let frame = 0, paintedAt = 0, speed = 0, targetSpeed = 0;
  let arrival: HTMLButtonElement | null = null;

  const paint = (now: number) => {
    frame = 0;
    const target = motion.matches || now - lastMovement > 70 ? 0 : targetSpeed;
    const elapsed = Math.min(64, Math.max(1, now - (paintedAt || now - 16)));
    paintedAt = now;
    speed = motion.matches ? 0 : speed + (target - speed) * (1 - Math.exp(-elapsed / (target > speed ? 65 : 210)));
    if (target === 0 && speed < .005) speed = 0;
    const energy = 1 - Math.exp(-speed * 1.7);
    const length = Math.min(84, width * .2) + Math.min(100, width * .25) * energy;
    const start = x - direction * length;
    // A tapered ribbon follows the same curve as the head in either direction.
    const upper: string[] = [], lower: string[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const px = start + (x - start) * t;
      const py = curveY(px, width);
      const half = .025 + .8 * t ** 1.4;
      upper.push(`${px.toFixed(2)},${(py - half).toFixed(2)}`);
      lower.unshift(`${px.toFixed(2)},${(py + half).toFixed(2)}`);
    }
    const shape = `M${upper.join("L")}L${lower.join("L")}Z`;
    tails.forEach(tail => tail.setAttribute("d", shape));
    gradient.setAttribute("x1", String(start));
    gradient.setAttribute("x2", String(x));
    gradient.setAttribute("y1", String(curveY(start, width)));
    gradient.setAttribute("y2", String(curveY(x, width)));
    head.style.setProperty("--comet-energy", energy.toFixed(3));
    head.dataset.moving = String(speed > .005);
    if (!motion.matches && (speed > 0 || target > 0)) frame = requestAnimationFrame(paint);
  };

  return {
    measure() {
      width = Math.max(1, nav.clientWidth);
      svg.setAttribute("viewBox", `0 0 ${width} 60`);
      rail.setAttribute("d", `M0 46Q${width / 2} 28 ${width} 46`);
      nav.querySelectorAll<HTMLElement>("[data-scene-button]").forEach(button => {
        const center = button.offsetLeft + button.offsetWidth / 2;
        button.style.setProperty("--stop-y", `${curveY(center, width)}px`);
      });
      previousX = null;
      speed = targetSpeed = 0;
    },
    place(nextX: number, now: number) {
      x = nextX;
      head.style.setProperty("--comet-x", `${x.toFixed(2)}px`);
      head.style.setProperty("--comet-y", `${curveY(x, width).toFixed(2)}px`);
      if (!motion.matches && previousX !== null && Math.abs(x - previousX) > .05) {
        direction = x > previousX ? 1 : -1;
        targetSpeed = Math.min(2.4, Math.abs(x - previousX) / Math.max(12, Math.min(64, now - previousTime)));
        lastMovement = now;
      }
      head.dataset.direction = direction === 1 ? "forward" : "backward";
      previousX = x;
      previousTime = now;
      cancelAnimationFrame(frame);
      paint(now);
    },
    arrive(button: HTMLButtonElement | undefined) {
      if (arrival === (button ?? null)) return;
      arrival?.removeAttribute("data-arriving");
      arrival = button ?? null;
      if (arrival && !motion.matches) arrival.dataset.arriving = "true";
    },
    dispose() { cancelAnimationFrame(frame); arrival?.removeAttribute("data-arriving"); },
  };
}
