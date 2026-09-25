import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") || "Kam v Česku?";
    
    // Break address into parts if long
    const shortAddress = address.length > 50 ? address.substring(0, 47) + "..." : address;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#0b0d12",
            backgroundImage: "radial-gradient(circle at 80% 20%, #1a2a22 0%, #0b0d12 50%)",
            color: "white",
            padding: "80px",
            fontFamily: "sans-serif",
          }}
        >
          {/* Top border accent */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "12px",
              background: "linear-gradient(to right, #1a3a3a, #1d7c48, #52b146, #d2e022, #fcd230)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                fontSize: "32px",
                color: "#52b146",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontWeight: "bold",
              }}
            >
              Report o kvalitě okolí
            </div>
            
            <div
              style={{
                fontSize: "80px",
                fontWeight: "bold",
                lineHeight: 1.1,
                color: "#ffffff",
                width: "900px",
              }}
            >
              {shortAddress}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", gap: "20px", fontSize: "28px", color: "#a1a1aa" }}>
              <span>Doprava</span>
              <span>•</span>
              <span>Školy</span>
              <span>•</span>
              <span>Příroda</span>
              <span>•</span>
              <span>Bezpečnost</span>
            </div>
            
            <div style={{ fontSize: "40px", fontWeight: "bold", color: "#ffffff", display: "flex", alignItems: "center" }}>
              <span style={{ color: "#52b146", marginRight: "16px" }}>kamvcesku.cz</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
