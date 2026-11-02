import { ImageResponse } from "next/og";

export const alt = "Matchday AI: Premier League predictions, previews and a backtested accuracy tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const lime = "#c6f432";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0f14", color: "#f2f4f7", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 30, height: 30, borderRadius: 999, border: "5px solid #0b0f14" }} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 2 }}>MATCHDAY AI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>Premier League predictions you can actually check.</div>
          <div style={{ fontSize: 28, color: "#c9d0da" }}>Match previews · live table · player stats · honest accuracy tracker</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {[["52%", "#4c8dff"], ["25%", "#5b6573"], ["23%", "#ff9a52"]].map(([w, c]) => (
            <div key={c} style={{ width: Number(w.replace("%", "")) * 7, height: 14, borderRadius: 999, background: c }} />
          ))}
          <div style={{ marginLeft: "auto", fontSize: 26, color: lime, whiteSpace: "nowrap" }}>Kickoffs in IST</div>
        </div>
      </div>
    ),
    size,
  );
}
