import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1a1230 0%, #07080b 60%, #0d0f14 100%)",
          color: "#fafafa",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontWeight: 800,
        }}
      >
        <span style={{ fontSize: 96, color: "#a78bfa", lineHeight: 1, letterSpacing: -2 }}>
          p
        </span>
        <span
          style={{
            fontSize: 18,
            color: "#bdc2cf",
            marginTop: 8,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          crypto
        </span>
      </div>
    ),
    size,
  );
}
