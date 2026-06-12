import { makeOgImage, ogSize } from "@/app/_og/makeOgImage";

export const size = ogSize;
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WritingOgImage() {
  return makeOgImage({
    label: "Writing",
    subtitle: "Essays on Human Nature · Culture · Tech",
  });
}
