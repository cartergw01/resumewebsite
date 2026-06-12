import { makeOgImage, ogSize } from "@/app/_og/makeOgImage";

export const size = ogSize;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function WorkOgImage() {
  return makeOgImage({
    label: "Work",
    subtitle: "Associate at 886 Studios · Taipei",
  });
}
