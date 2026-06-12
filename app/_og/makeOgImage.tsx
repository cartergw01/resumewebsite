import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

async function loadPlayfair(): Promise<ArrayBuffer | null> {
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
    if (url) return fetch(url).then((r) => r.arrayBuffer());
  } catch {}
  return null;
}

export async function makeOgImage({
  label,
  subtitle,
}: {
  label?: string;
  subtitle: string;
}) {
  const playfairData = await loadPlayfair();
  const fontFamily = playfairData ? "Playfair Display" : "serif";

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
        {/* Deep space glow — top-left blue nebula */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 15% 30%, rgba(30,50,120,0.55) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Bottom-right warm glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 50% at 85% 75%, rgba(60,20,80,0.45) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Center vignette to punch text forward */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(1,2,8,0.5) 100%)",
            display: "flex",
          }}
        />

        {label && (
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 64,
              fontSize: 14,
              color: "rgba(236,244,255,0.45)",
              letterSpacing: "5px",
              display: "flex",
            }}
          >
            {label.toUpperCase()}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              fontFamily,
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
          {subtitle && (
            <div
              style={{
                fontSize: 22,
                color: "rgba(236,244,255,0.62)",
                letterSpacing: "3.5px",
                display: "flex",
              }}
            >
              {subtitle.toUpperCase()}
            </div>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 42,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 16,
            color: "rgba(236,244,255,0.34)",
            letterSpacing: "3px",
          }}
        >
          CARTERKOWANG.COM
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: playfairData
        ? [{ name: "Playfair Display", data: playfairData, weight: 700, style: "normal" }]
        : [],
    }
  );
}
