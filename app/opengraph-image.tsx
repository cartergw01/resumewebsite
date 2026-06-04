import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Dynamic so Satori can fetch the hero image and fonts at request time
export const dynamic = "force-dynamic";

const HERO_URL = "https://carterkowang.com/cosmic-hero-v6-sharp.webp";

export default async function OpenGraphImage() {
  // Fetch Playfair Display 700 — Firefox 27 UA returns WOFF which Satori supports
  let playfairData: ArrayBuffer | null = null;
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0",
        },
      }
    );
    const css = await cssRes.text();
    const url = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
    if (url) playfairData = await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    // fall back to serif
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          background: "#010208",
          overflow: "hidden",
        }}
      >
        {/* Hero background — Satori fetches this URL directly */}
        <img
          src={HERO_URL}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />

        {/* Top-to-bottom vignette */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(180deg, rgba(1,2,8,0.28) 0%, rgba(1,2,8,0.04) 38%, rgba(1,2,8,0.72) 100%)",
            display: "flex",
          }}
        />

        {/* Radial edge darkening */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse at 50% 46%, transparent 36%, rgba(1,2,8,0.44) 70%, rgba(1,2,8,0.78) 100%)",
            display: "flex",
          }}
        />

        {/* Centred name + tagline */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              fontFamily: playfairData ? "Playfair Display" : "serif",
              fontSize: 108,
              fontWeight: 700,
              color: "#f5f8ff",
              lineHeight: 1,
              letterSpacing: "-2px",
              display: "flex",
            }}
          >
            Carter Wang
          </div>

          <div
            style={{
              fontSize: 25,
              fontWeight: 400,
              color: "rgba(236,244,255,0.62)",
              letterSpacing: "3px",
              display: "flex",
            }}
          >
            WORKING IN TAIPEI · WRITING · BUILDING
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 42,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 18,
            color: "rgba(236,244,255,0.34)",
            letterSpacing: "3px",
          }}
        >
          CARTERKOWANG.COM
        </div>
      </div>
    ),
    {
      ...size,
      fonts: playfairData
        ? [
            {
              name: "Playfair Display",
              data: playfairData,
              weight: 700,
              style: "normal",
            },
          ]
        : [],
    }
  );
}
