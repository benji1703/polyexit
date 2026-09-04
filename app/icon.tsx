import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#171a18", color: "#e8e9e2", fontSize: 21, fontWeight: 800, letterSpacing: "-0.08em" }}>P/X</div>,
    size,
  );
}

