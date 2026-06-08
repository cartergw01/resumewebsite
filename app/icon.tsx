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
          background: "#000000",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/*
          viewBox 0 0 60 60
          Circle center: 30, 33  radius: 18
          Lightning extends above and to the sides of the circle
        */}
        <svg
          width="60"
          height="60"
          viewBox="0 0 60 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ── White lightning — upper-left ── */}
          <path
            d="M21 3 L13 14 L18 11 L9 24 L14 20 L6 33"
            stroke="rgba(255,255,255,0.88)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ── Cyan lightning — upper-right ── */}
          <path
            d="M40 4 L50 15 L45 12 L54 23 L49 20 L56 32"
            stroke="#18BFFF"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ── Cyan lightning fork — lower-right ── */}
          <path
            d="M44 40 L51 46 L47 43 L53 52"
            stroke="#18BFFF"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ── Blue circle ring ── */}
          <circle
            cx="30"
            cy="33"
            r="18"
            stroke="#18BFFF"
            strokeWidth="3"
          />

          {/* ── White K ── */}
          <text
            x="30"
            y="43"
            textAnchor="middle"
            fill="white"
            fontSize="23"
            fontWeight="bold"
            fontFamily="Arial Black, Arial, Helvetica, sans-serif"
          >
            K
          </text>
        </svg>
      </div>
    ),
    size,
  );
}
