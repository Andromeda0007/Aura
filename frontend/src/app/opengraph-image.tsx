import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aura — Teaching Assistant";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0b0f1a",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              fontSize: 54,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <span style={{ fontSize: 40, opacity: 0.7 }}>Aura</span>
        </div>
        <div style={{ marginTop: 48, fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>
          Just teach. Aura does the paperwork.
        </div>
        <div style={{ marginTop: 28, fontSize: 34, opacity: 0.7, maxWidth: 900 }}>
          Live quizzes, summaries, and diagrams from your classroom — in real time.
        </div>
      </div>
    ),
    { ...size },
  );
}
