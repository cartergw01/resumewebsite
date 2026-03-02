import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            "radial-gradient(circle at top left, rgba(63, 120, 255, 0.45), transparent 34%), radial-gradient(circle at 82% 18%, rgba(255, 139, 75, 0.24), transparent 22%), linear-gradient(180deg, #0d2037 0%, #08111f 100%)",
          color: "#ecf4ff",
          display: "flex",
          height: "100%",
          padding: "56px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(137, 172, 214, 0.18)",
            borderRadius: 34,
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
            padding: "42px 44px",
            position: "relative",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 139, 75, 0.16), rgba(12, 28, 48, 0.02))",
              inset: 0,
              position: "absolute",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "relative" }}>
            <div
              style={{
                color: "rgba(214, 228, 245, 0.76)",
                display: "flex",
                fontSize: 28,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Carter Wang
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 82,
                fontWeight: 700,
                letterSpacing: "-0.06em",
                lineHeight: 1,
                maxWidth: 760,
              }}
            >
              venture, writing, and personal portfolio
            </div>
          </div>

          <div
            style={{
              alignItems: "flex-end",
              display: "flex",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 690 }}>
              <div
                style={{
                  color: "rgba(236, 244, 255, 0.84)",
                  display: "flex",
                  fontSize: 30,
                  lineHeight: 1.35,
                }}
              >
                venture associate at 886 studios, former contrary research fellow, and essays on tech, culture, and
                human nature.
              </div>
              <div
                style={{
                  color: "#ff8b4b",
                  display: "flex",
                  fontSize: 24,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                portfolio-website-cartergw01s-projects.vercel.app
              </div>
            </div>

            <div
              style={{
                alignItems: "center",
                border: "1px solid rgba(255, 139, 75, 0.42)",
                borderRadius: 28,
                display: "flex",
                height: 120,
                justifyContent: "center",
                minWidth: 120,
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: "-0.08em",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              CW
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
