import { makeOgImage, ogSize } from "@/app/_og/makeOgImage";

export const size = ogSize;
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProjectsOgImage() {
  return makeOgImage({
    label: "Projects",
    subtitle: "Building Things for Fun",
  });
}
