import specs from "@/content/workshop-curios.json";
import assets from "@/lib/workshop-curios.json";

export const curios = specs.map(spec => ({ ...spec, ...assets[spec.id as keyof typeof assets] }));
export type WorkshopCurio = (typeof curios)[number];

// Boundaries halfway to nearby markers keep small desk props individually
// selectable. Large structural parts yield to the objects sitting on them.
export function curiosityClip(point: number[], box: number[], neighbors: number[][]) {
  const [x,y,w,h] = box;
  let polygon = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  for (const other of neighbors) {
    if (other === point) continue;
    const a = other[0]-point[0], b = other[1]-point[1];
    if (Math.hypot(a,b) < .001) continue;
    const c = (other[0]**2+other[1]**2-point[0]**2-point[1]**2)/2;
    const next: number[][] = [];
    for (let i=0;i<polygon.length;i++) {
      const p=polygon[i], q=polygon[(i+1)%polygon.length];
      const dp=a*p[0]+b*p[1]-c, dq=a*q[0]+b*q[1]-c;
      if (dp<=0) next.push(p);
      if ((dp<=0)!==(dq<=0)) { const t=dp/(dp-dq); next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]); }
    }
    polygon=next;
  }
  return `polygon(${polygon.map(p=>`${(p[0]-x)/w*100}% ${(p[1]-y)/h*100}%`).join(",")})`;
}
