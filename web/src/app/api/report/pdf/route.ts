import { type NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb } from "pdf-lib";
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
};

function metricText(id: string, n: number): string {
  if (id === "quiet") return n > 0 ? `${n} dB` : "tichá zóna";
  if (id === "safety") return `${n} případů/rok`;
  if (id === "highschool") return n > 0 ? `${n}. percentil` : "—";
  return `${n} do 800 m`;
}

const SOURCES = [
  "Školy/školky: Rejstřík škol MŠMT + RÚIAN (ČÚZK)",
  "Lékaři, lékárny: NRPZS / ÚZIS ČR (CC BY 4.0)",
  "Klid (hluk): Strategické hlukové mapy 2022, MZ ČR",
  "Bezpečnost: Mapa kriminality, Policie ČR",
  "Ostatní: OpenStreetMap (ODbL)",
];

async function sessionPaid(session: string | null): Promise<boolean> {
  if (!session) return false;
  if (!PAYMENTS_LIVE) return session.startsWith("mock_");
  // Live: confirm the Checkout Session was actually paid.
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

export async function POST(req: NextRequest) {
  const { address, scores, session } = await req.json().catch(() => ({}));
  if (!(await sessionPaid(session))) {
    return NextResponse.json({ error: "payment_required" }, { status: 402 });
  }
  if (!scores || typeof scores !== "object") {
    return NextResponse.json({ error: "missing_scores" }, { status: 400 });
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(loadFont("DejaVuSans.ttf"));
  const bold = await doc.embedFont(loadFont("DejaVuSans-Bold.ttf"));

  const page = doc.addPage([595, 842]); // A4
  const { width } = page.getSize();
  const margin = 50;
  let y = 792;

  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.45, 0.5, 0.55);
  const accent = rgb(0.91, 0.63, 0.19);

  const text = (s: string, x: number, yy: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x, y: yy, size, font: f, color });

  text("Kam v Česku?", margin, y, 11, bold, accent);
  text("Report podle adresy", margin, (y -= 26), 22, bold);
  text(String(address ?? "—"), margin, (y -= 20), 12, font, muted);
  const date = new Date().toLocaleDateString("cs-CZ");
  text(`Vygenerováno ${date}`, margin, (y -= 16), 9, font, muted);

  // overall
  const ids = Object.keys(LAYER_LABELS).filter((k) => k in scores);
  const overall = ids.reduce((a, k) => a + (Number(scores[k]) || 0), 0) / Math.max(ids.length, 1);
  y -= 34;
  text(String(Math.round(overall * 100)), margin, y - 8, 40, bold, accent);
  text("/ 100", margin + 70, y, 12, font, muted);
  text("Celkové skóre okolí", margin + 70, y - 14, 9, font, muted);

  // bars
  y -= 44;
  const ranked = ids
    .map((k) => ({ k, v: Number(scores[k]) || 0 }))
    .sort((a, b) => b.v - a.v);
  const barX = margin + 150;
  const barW = width - barX - margin - 80; // room for the count label on the right
  for (const { k, v } of ranked) {
    text(LAYER_LABELS[k], margin, y, 10, font, ink);
    page.drawRectangle({ x: barX, y: y - 2, width: barW, height: 7, color: rgb(0.9, 0.92, 0.94) });
    page.drawRectangle({ x: barX, y: y - 2, width: barW * v, height: 7, color: accent });
    const n = Number(scores[`n_${k}`]) || 0;
    text(metricText(k, n), barX + barW + 8, y, 9, font, muted);
    y -= 20;
  }

  // sources
  y -= 16;
  text("Zdroje dat", margin, y, 11, bold);
  y -= 16;
  for (const s of SOURCES) {
    text("• " + s, margin, y, 8.5, font, muted);
    y -= 13;
  }
  y -= 8;
  text(
    "Čísla udávají počet objektů do 800 m od adresy (u klidu hladinu hluku Lden, u bezpečnosti počet",
    margin, y, 8, font, muted,
  );
  text(
    "případů za rok). Pruh ukazuje relativní hodnocení dané lokality v rámci města.",
    margin, y - 11, 8, font, muted,
  );

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="report.pdf"`,
    },
  });
}
