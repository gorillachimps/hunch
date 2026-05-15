import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1a1230 0%, #07080b 100%)",
          color: "#a78bfa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: -0.5,
          borderRadius: 6,
        }}
      >
        p
      </div>
    ),
    size,
  );
}
