import { getImageProps } from "next/image";
import { projects } from "@/content/portfolio";

// The workshop's deck of project cards is shown at most ~340px wide, so cards
// use 750px renditions instead of the 1200px originals. The first card stays
// the original: it docks into /projects' first row, which shows that exact
// image (large on phones), so the hand-off is seamless and already cached.
const rendition = (src: string, width: number) => getImageProps({ src, alt: "", width, height: Math.round(width * .625), quality: 75 }).props.src;

export const projectPosters = projects.map((project, index) => index === 0 ? project.image : rendition(project.image, 375));
// What the island's little monitor shows: a 384px thumbnail.
export const projectScreenPreview = rendition(projects[0].image, 192);
