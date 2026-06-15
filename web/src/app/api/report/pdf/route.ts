import { type NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb, type PDFFont, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PAYMENTS_LIVE, stripeSecret } from "@/lib/payment";

export const runtime = "nodejs";

const LAYER_LABELS: Record<string, string> = {
  schools: "Základní školy",
  kindergartens: "Mateřské školy",
  playgrounds: "Dětská hřiště",
  clinics: "Lékaři / kliniky",
  pharmacies: "Lékárny",
  transport: "Zastávky MHD",
  parks: "Parky",
  sports: "Sportoviště",
  shops: "Obchody",
  quiet: "Klid (hluk)",
  safety: "Bezpečnost",
  highschool: "Kvalita SŠ",
  air: "Kvalita ovzduší",
};

// Thematic grouping for the report sections
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Doprava", ids: ["transport"] },
  { title: "Vzdělávání", ids: ["kindergartens", "schools", "highschool"] },
  { title: "Zdraví", ids: ["clinics", "pharmacies"] },
  { title: "Životní prostředí", ids: ["parks", "quiet", "air"] },
  { title: "Volný čas a služby", ids: ["playgrounds", "sports", "shops"] },
  { title: "Bezpečnost", ids: ["safety"] },
];

const SOURCES = [
  "Školy/školky: Rejstřík škol MŠMT + RÚIAN (ČÚZK)",
  "Lékaři, lékárny: NRPZS / ÚZIS ČR (CC BY 4.0)",
  "Klid (hluk): Strategické hlukové mapy 2022, MZ ČR",
  "Bezpečnost: Mapa kriminality, Policie ČR",
  "Kvalita SŠ: Přijímací zkoušky CERMAT",
  "Kvalita ovzduší: Pětileté průměry PM2.5, ČHMÚ",
  "Ostatní: OpenStreetMap (ODbL)",
];

function metricText(id: string, n: number): string {
  if (id === "quiet") return n > 0 ? `${n} dB` : "tichá zóna";
  if (id === "safety") return `${n} případů/rok`;
  if (id === "highschool") return n > 0 ? `${n}. percentil` : "—";
  if (id === "air") return n > 0 ? `${n} µg/m³ PM2.5` : "—";
  return `${n} do 800 m`;
}


function verdict(v: number): string {
  if (v >= 0.65) return "Výborná lokalita pro bydlení";
  if (v >= 0.5) return "Dobrá lokalita pro bydlení";
  if (v >= 0.35) return "Průměrná lokalita";
  return "Podprůměrná lokalita";
}

async function sessionPaid(session: string | null): Promise<boolean> {
  if (!session) return false;
  if (!PAYMENTS_LIVE) return session.startsWith("mock_");
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session}`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } },
  );
  if (!res.ok) return false;
  const data = await res.json();
  return data.payment_status === "paid";
}

function loadFont(name: string): Uint8Array {
  return readFileSync(join(process.cwd(), "src/assets", name));
}

// gradient colour matching the map (dark green → amber)
function scoreColor(v: number): RGB {
  if (v >= 0.8) return rgb(0.99, 0.82, 0.19);
  if (v >= 0.6) return rgb(0.82, 0.88, 0.13);
  if (v >= 0.4) return rgb(0.32, 0.69, 0.27);
  if (v >= 0.2) return rgb(0.11, 0.49, 0.28);
  return rgb(0.10, 0.23, 0.23);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { address, scores, session, mapImage, cityAvg, cityName } = body as {
    address?: string;
    scores?: Record<string, number>;
    session?: string | null;
    mapImage?: string;            // data:image/png;base64,...
    cityAvg?: Record<string, number>;
    cityName?: string;
  };

  if (!(await sessionPaid(session ?? null))) {
    return NextResponse.json({ error: "payment_required" }, { status: 402 });
  }
  if (!scores || typeof scores !== "object") {
    return NextResponse.json({ error: "missing_scores" }, { status: 400 });
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(loadFont("DejaVuSans.ttf"));
  const bold = await doc.embedFont(loadFont("DejaVuSans-Bold.ttf"));

  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;

  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.45, 0.5, 0.55);
  const faint = rgb(0.62, 0.66, 0.7);
  const accent = rgb(0.91, 0.63, 0.19);
  const good = rgb(0.18, 0.6, 0.33);
  const bad = rgb(0.8, 0.3, 0.2);

  const text = (s: string, x: number, y: number, size: number, f: PDFFont = font, color: RGB = ink) =>
    page.drawText(s, { x, y, size, font: f, color });

  let y = height - margin;

  // ── Header ────────────────────────────────────────────────────────────
  text("Kam v Česku?", margin, y, 10, bold, accent);
  text("Report podle adresy", margin, (y -= 24), 22, bold);
  text(String(address ?? "—"), margin, (y -= 18), 12, font, muted);
  const date = new Date().toLocaleDateString("cs-CZ");
  text(`Vygenerováno ${date}`, margin, (y -= 14), 9, font, faint);

  const ids = Object.keys(LAYER_LABELS).filter((k) => k in scores);
  const overall = ids.reduce((a, k) => a + (Number(scores[k]) || 0), 0) / Math.max(ids.length, 1);

  // ── Map + overall ─────────────────────────────────────────────────────
  y -= 18;
  const mapW = 250, mapH = 150;
  const mapX = width - margin - mapW;
  const mapTop = y;
  if (typeof mapImage === "string" && mapImage.startsWith("data:image/png")) {
    try {
      const png = await doc.embedPng(Buffer.from(mapImage.split(",")[1], "base64"));
      page.drawImage(png, { x: mapX, y: mapTop - mapH, width: mapW, height: mapH });
      // address marker at centre
      page.drawCircle({ x: mapX + mapW / 2, y: mapTop - mapH / 2, size: 4, color: accent, borderColor: rgb(1, 1, 1), borderWidth: 1.5 });
      page.drawRectangle({ x: mapX, y: mapTop - mapH, width: mapW, height: mapH, borderColor: rgb(0.85, 0.87, 0.9), borderWidth: 0.8 });
    } catch { /* skip image on failure */ }
  }

  // overall score block (left of map)
  text(String(Math.round(overall * 100)), margin, mapTop - 36, 46, bold, scoreColor(overall));
  text("/ 100", margin + 78, mapTop - 18, 12, font, muted);
  text("Celkové skóre okolí", margin + 78, mapTop - 32, 9, font, faint);
  text(verdict(overall), margin, mapTop - 56, 12, bold, ink);
  if (cityName) {
    text(`Hodnocení v rámci města ${cityName}.`, margin, mapTop - 72, 8.5, font, muted);
  }

  y = mapTop - Math.max(mapH, 90) - 22;

  // ── Strengths / weaknesses ────────────────────────────────────────────
  const ranked = ids.map((k) => ({ k, v: Number(scores[k]) || 0 })).sort((a, b) => b.v - a.v);
  const tops = ranked.slice(0, 3);
  const bottoms = ranked.slice(-3).reverse();
  const colW = (width - 2 * margin - 20) / 2;

  text("Silné stránky", margin, y, 11, bold, good);
  text("Slabé stránky", margin + colW + 20, y, 11, bold, bad);
  y -= 16;
  for (let i = 0; i < 3; i++) {
    if (tops[i]) text(`▲  ${LAYER_LABELS[tops[i].k]}`, margin, y, 9.5, font, ink);
    if (bottoms[i]) text(`▼  ${LAYER_LABELS[bottoms[i].k]}`, margin + colW + 20, y, 9.5, font, ink);
    y -= 14;
  }

  // ── Thematic sections with city comparison ────────────────────────────
  y -= 12;
  const barX = margin + 150;
  const barW = 200;
  const valX = barX + barW + 10;
  const cmpX = width - margin - 78;

  for (const group of GROUPS) {
    const members = group.ids.filter((id) => id in scores);
    if (!members.length) continue;
    if (y < 130) break; // keep within one page
    text(group.title.toUpperCase(), margin, y, 9, bold, accent);
    y -= 15;
    for (const id of members) {
      const v = Number(scores[id]) || 0;
      const n = Number(scores[`n_${id}`]) || 0;
      text(LAYER_LABELS[id], margin, y, 9.5, font, ink);
      page.drawRectangle({ x: barX, y: y - 1, width: barW, height: 6, color: rgb(0.91, 0.93, 0.95) });
      page.drawRectangle({ x: barX, y: y - 1, width: barW * v, height: 6, color: scoreColor(v) });
      text(metricText(id, n), valX, y, 8, font, muted);
      // vs city average
      if (cityAvg && typeof cityAvg[id] === "number") {
        const delta = Math.round((v - cityAvg[id]) * 100);
        const arrow = delta > 1 ? "▲" : delta < -1 ? "▼" : "≈";
        const col = delta > 1 ? good : delta < -1 ? bad : muted;
        const lbl = delta === 0 ? "≈ průměr" : `${arrow} ${delta > 0 ? "+" : ""}${delta} vs město`;
        text(lbl, cmpX, y, 7.5, font, col);
      }
      y -= 16;
    }
    y -= 6;
  }

  // ── Sources ───────────────────────────────────────────────────────────
  if (y < 120) { /* leave as is, footer handles bottom */ }
  y = Math.max(y, 110);
  text("Zdroje dat", margin, y, 10, bold);
  y -= 14;
  for (const s of SOURCES) { text("• " + s, margin, y, 7.5, font, muted); y -= 11; }
  y -= 6;
  text(
    "Skóre 0–100 vyjadřuje relativní hodnocení v rámci města; čísla jsou počty do 800 m od adresy",
    margin, y, 7.5, font, faint,
  );
  text(
    "(kvalita SŠ do 3 km, ovzduší roční průměr PM2.5). Srovnání „vs město“ je rozdíl skóre oproti průměru města.",
    margin, y - 10, 7.5, font, faint,
  );

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="report.pdf"`,
    },
  });
}
