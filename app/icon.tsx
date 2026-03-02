import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at top left, rgba(74, 135, 255, 0.9), transparent 55%), linear-gradient(180deg, #102846 0%, #08111f 100%)",
          color: "#ecf4ff",
          display: "flex",
          fontSize: 26,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          letterSpacing: "-0.08em",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            border: "2px solid rgba(255, 139, 75, 0.65)",
            borderRadius: 18,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            display: "flex",
            height: 48,
            justifyContent: "center",
            width: 48,
          }}
        >
          CW
        </div>
      </div>
    ),
    size,
  );
}
