import { type NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
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

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Doprava", ids: ["transport"] },
  { title: "Vzdělávání", ids: ["kindergartens", "schools", "highschool"] },
  { title: "Zdraví", ids: ["clinics", "pharmacies"] },
  { title: "Prostředí", ids: ["parks", "quiet", "air"] },
  { title: "Služby", ids: ["playgrounds", "sports", "shops"] },
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
  if (id === "air") return n > 0 ? `${n} µg/m³` : "—";
  return `${n} do 800 m`;
}

function verdict(v: number): string {
  if (v >= 0.65) return "Výborná lokalita pro bydlení";
  if (v >= 0.5) return "Dobrá lokalita pro bydlení";
  if (v >= 0.35) return "Průměrná lokalita";
  return "Podprůměrná lokalita";
}

// ── dark theme palette ──────────────────────────────────────────────────────
const BG = rgb(0.043, 0.051, 0.071);
const CARD = rgb(0.085, 0.098, 0.125);
const LINE = rgb(0.17, 0.19, 0.23);
const TEXT = rgb(0.93, 0.94, 0.96);
const MUTED = rgb(0.55, 0.6, 0.66);
const FAINT = rgb(0.38, 0.42, 0.48);
const ACCENT = rgb(0.91, 0.63, 0.19);
const GOOD = rgb(0.43, 0.78, 0.36);
const BAD = rgb(0.86, 0.36, 0.3);

function scoreColor(v: number): RGB {
  if (v >= 0.8) return rgb(0.99, 0.82, 0.19);
  if (v >= 0.6) return rgb(0.82, 0.88, 0.13);
  if (v >= 0.4) return rgb(0.32, 0.69, 0.27);
  if (v >= 0.2) return rgb(0.11, 0.49, 0.28);
  return rgb(0.16, 0.3, 0.3);
}

async function sessionPaid(session: string | null): Promise<boolean> {
  if (!session) return false;
  if (!PAYMENTS_LIVE) return session.startsWith("mock_");
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session}`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } });
  if (!res.ok) return false;
  return (await res.json()).payment_status === "paid";
}

function loadFont(name: string): Uint8Array {
  return readFileSync(join(process.cwd(), "src/assets", name));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { address, scores, session, mapImage, cityAvg, cityName, nearby, rent, rentCity, rentQuarter } = body as {
    address?: string; scores?: Record<string, number>; session?: string | null;
    mapImage?: string; cityAvg?: Record<string, number>; cityName?: string;
    nearby?: Record<string, { name: string; dist: number; min: number }>;
    rent?: number; rentCity?: number; rentQuarter?: string;
  };

  if (!(await sessionPaid(session ?? null)))
    return NextResponse.json({ error: "payment_required" }, { status: 402 });
  if (!scores || typeof scores !== "object")
    return NextResponse.json({ error: "missing_scores" }, { status: 400 });

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(loadFont("DejaVuSans.ttf"));
  const bold = await doc.embedFont(loadFont("DejaVuSans-Bold.ttf"));

  const W = 595, H = 842, M = 44;
  const ids = Object.keys(LAYER_LABELS).filter((k) => k in scores);
  const overall = ids.reduce((a, k) => a + (Number(scores[k]) || 0), 0) / Math.max(ids.length, 1);

  // ── drawing helpers ───────────────────────────────────────────────────────
  const mk = (page: PDFPage) => {
    const text = (s: string, x: number, y: number, size: number, f: PDFFont = font, color: RGB = TEXT) =>
      page.drawText(s, { x, y, size, font: f, color });
    const textC = (s: string, cx: number, y: number, size: number, f: PDFFont, color: RGB) =>
      text(s, cx - f.widthOfTextAtSize(s, size) / 2, y, size, f, color);
    const textR = (s: string, rx: number, y: number, size: number, f: PDFFont, color: RGB) =>
      text(s, rx - f.widthOfTextAtSize(s, size), y, size, f, color);
    const arc = (cx: number, cy: number, r: number, a0: number, a1: number, th: number, color: RGB, segs = 48) => {
      let px = cx + r * Math.cos(a0 * Math.PI / 180), py = cy + r * Math.sin(a0 * Math.PI / 180);
      for (let i = 1; i <= segs; i++) {
        const a = (a0 + (a1 - a0) * i / segs) * Math.PI / 180;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        page.drawLine({ start: { x: px, y: py }, end: { x, y }, thickness: th, color });
        px = x; py = y;
      }
    };
    return { page, text, textC, textR, arc };
  };

  // ════════════════════════════ PAGE 1 — overview ════════════════════════════
  const p1 = doc.addPage([W, H]);
  p1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  const g1 = mk(p1);

  // hero band
  p1.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: CARD });
  p1.drawRectangle({ x: 0, y: H - 96, width: 4, height: 96, color: ACCENT });
  g1.text("KAM V ČESKU?", M, H - 38, 9, bold, ACCENT);
  g1.text("Report podle adresy", M, H - 64, 22, bold, TEXT);
  g1.text(String(address ?? "—"), M, H - 82, 11, font, MUTED);
  const date = new Date().toLocaleDateString("cs-CZ");
  g1.textR(`Vygenerováno ${date}`, W - M, H - 82, 9, font, FAINT);

  let y = H - 96;

  // ── neighborhood map — full-width banner, fills edge-to-edge (cover-fit) ────
  const bx = M, bw = W - 2 * M, bTop = y - 14, bh = 250, bBot = bTop - bh;
  p1.drawRectangle({ x: bx, y: bBot, width: bw, height: bh, color: CARD, borderColor: LINE, borderWidth: 1 });
  if (typeof mapImage === "string" && mapImage.startsWith("data:image/png")) {
    try {
      const png = await doc.embedPng(Buffer.from(mapImage.split(",")[1], "base64"));
      // cover-fit: scale so the image fills the whole banner, crop the overflow
      const fit = Math.max(bw / png.width, bh / png.height);
      const iw = png.width * fit, ih = png.height * fit;
      const ix = bx + (bw - iw) / 2, iy = bBot + (bh - ih) / 2;
      // clip to the banner so the overflow doesn't spill onto the page
      p1.pushOperators(pushGraphicsState(), rectangle(bx, bBot, bw, bh), clip(), endPath());
      p1.drawImage(png, { x: ix, y: iy, width: iw, height: ih });
      p1.pushOperators(popGraphicsState());
      // address marker dead-center of the banner
      const mcx = bx + bw / 2, mcy = bBot + bh / 2;
      p1.drawCircle({ x: mcx, y: mcy, size: 11, color: rgb(1, 1, 1), opacity: 0.18 });
      p1.drawCircle({ x: mcx, y: mcy, size: 5.5, color: ACCENT, borderColor: rgb(1, 1, 1), borderWidth: 2 });
    } catch { /* skip */ }
  }
  // legend chip overlaid on the map (bottom-left)
  const legColors = [scoreColor(0.15), scoreColor(0.5), scoreColor(0.9)];
  const lgX = bx + 12, lgY = bBot + 12;
  p1.drawRectangle({ x: lgX - 6, y: lgY - 6, width: 150, height: 26, color: rgb(0.04, 0.05, 0.07), opacity: 0.82 });
  g1.text("hůř", lgX, lgY + 6, 7, font, MUTED);
  const swX = lgX + 22;
  legColors.forEach((c, i) => p1.drawRectangle({ x: swX + i * 11, y: lgY + 6, width: 11, height: 7, color: c }));
  g1.text("lépe", swX + 3 * 11 + 4, lgY + 6, 7, font, MUTED);
  g1.text("celkové hodnocení okolí", lgX, lgY - 3, 6.5, font, FAINT);
  g1.text("OKOLÍ ADRESY", bx + 10, bTop - 14, 8, bold, rgb(1, 1, 1));

  y = bTop - bh - 24;

  // ── rent headline (official MF ČR cenová mapa), centered under the map ──────
  if (typeof rent === "number" && rent > 0) {
    g1.textC(`Nájemné v okolí:  ≈ ${rent} Kč/m²/měs`, W / 2, 469, 11, bold, TEXT);
    if (typeof rentCity === "number" && rentCity > 0) {
      const diff = Math.round(((rent - rentCity) / rentCity) * 100);
      const word = diff > 0 ? "dráž" : diff < 0 ? "levněji" : "stejně jako";
      const txt = diff === 0
        ? `stejně jako medián${cityName ? ` · ${cityName}` : ""}`
        : `o ${Math.abs(diff)} % ${word} než medián${cityName ? ` · ${cityName}` : ""}`;
      g1.textC(txt, W / 2, 458, 8, font, diff > 0 ? BAD : GOOD);
    }
  }

  // ── gauge (overall) + verdict (left) ───────────────────────────────────────
  const gx = M + 48, gy = y - 50, gr = 42;
  g1.arc(gx, gy, gr, 220, -40, 8, LINE);
  g1.arc(gx, gy, gr, 220, 220 - 260 * overall, 8, scoreColor(overall));
  g1.textC(String(Math.round(overall * 100)), gx, gy - 5, 30, bold, TEXT);
  g1.textC("/ 100", gx, gy - 21, 8, font, MUTED);
  g1.text(verdict(overall), M, gy - gr - 24, 13, bold, TEXT);
  g1.text("Celkové skóre okolí" + (cityName ? ` · ${cityName}` : ""),
    M, gy - gr - 40, 9, font, MUTED);

  // ── radar (theme profile) — right of gauge ─────────────────────────────────
  const themes = GROUPS.map((grp) => {
    const ms = grp.ids.filter((id) => id in scores);
    const v = ms.length ? ms.reduce((a, id) => a + (Number(scores[id]) || 0), 0) / ms.length : 0;
    return { title: grp.title, v };
  });
  const rcx = W - M - 96, rcy = y - 116, rr = 84;
  const N = themes.length;
  const ang = (i: number) => (90 - (360 / N) * i) * Math.PI / 180;
  // grid rings
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    let px = rcx + rr * ring * Math.cos(ang(0)), py = rcy + rr * ring * Math.sin(ang(0));
    for (let i = 1; i <= N; i++) {
      const x = rcx + rr * ring * Math.cos(ang(i % N)), yy = rcy + rr * ring * Math.sin(ang(i % N));
      p1.drawLine({ start: { x: px, y: py }, end: { x, y: yy }, thickness: 0.5, color: LINE });
      px = x; py = yy;
    }
  }
  // axes + labels
  themes.forEach((th, i) => {
    const ex = rcx + rr * Math.cos(ang(i)), ey = rcy + rr * Math.sin(ang(i));
    p1.drawLine({ start: { x: rcx, y: rcy }, end: { x: ex, y: ey }, thickness: 0.5, color: LINE });
    const lx = rcx + (rr + 14) * Math.cos(ang(i)), ly = rcy + (rr + 14) * Math.sin(ang(i));
    g1.textC(th.title, lx, ly - 3, 7.5, bold, MUTED);
    g1.textC(`${Math.round(th.v * 100)}`, lx, ly - 12, 7, font, FAINT);
  });
  // data polygon
  const pts = themes.map((th, i) => [rcx + rr * th.v * Math.cos(ang(i)), rcy + rr * th.v * Math.sin(ang(i))]);
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    p1.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: 1.8, color: ACCENT });
  }
  pts.forEach((p) => p1.drawCircle({ x: p[0], y: p[1], size: 2.2, color: ACCENT }));

  // ── strengths / weaknesses (left column, below the gauge) ──────────────────
  const ranked = ids.map((k) => ({ k, v: Number(scores[k]) || 0 })).sort((a, b) => b.v - a.v);
  const cardX = M;
  const cardRight = M + 210;
  const drawList = (title: string, items: { k: string; v: number }[], col: RGB, yTop: number) => {
    g1.text(title, cardX, yTop, 9, bold, col);
    let yy = yTop - 16;
    for (const it of items) {
      g1.text(LAYER_LABELS[it.k], cardX + 10, yy, 9, font, TEXT);
      g1.textR(`${Math.round(it.v * 100)}`, cardRight, yy, 9, font, col);
      yy -= 14;
    }
    return yy;
  };
  const listTop = gy - gr - 64;
  const after = drawList("SILNÉ STRÁNKY", ranked.slice(0, 3), GOOD, listTop);
  drawList("SLABÉ STRÁNKY", ranked.slice(-3).reverse(), BAD, after - 14);

  // ── nearest named places (full-width band, bottom of page) ─────────────────
  const NEAR_LABELS: Record<string, string> = {
    transit: "MHD zastávka", supermarket: "Supermarket", pharmacy: "Lékárna",
    health: "Lékař / nemocnice", school: "Základní škola", park: "Park",
  };
  const nearOrder = ["transit", "supermarket", "pharmacy", "health", "school", "park"]
    .filter((c) => nearby && nearby[c]);
  if (nearby && nearOrder.length) {
    const nbTop = 168;
    p1.drawLine({ start: { x: M, y: nbTop + 10 }, end: { x: W - M, y: nbTop + 10 }, thickness: 0.5, color: LINE });
    g1.text("NEJBLIŽŠÍ V OKOLÍ", M, nbTop - 4, 8, bold, ACCENT);
    const colW = (W - 2 * M) / 2;
    nearOrder.forEach((c, i) => {
      const p = nearby[c];
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * colW, ry = nbTop - 26 - row * 30;
      g1.text(NEAR_LABELS[c], x, ry, 7, bold, FAINT);
      g1.text(p.name.length > 30 ? p.name.slice(0, 29) + "…" : p.name, x, ry - 12, 10, font, TEXT);
      g1.textR(`${p.dist} m`, x + colW - 16, ry - 2, 9, bold, TEXT);
      g1.textR(`${p.min} min`, x + colW - 16, ry - 12, 7.5, font, MUTED);
    });
  }

  g1.textC("kamvcesku.cz  ·  hodnocení na základě otevřených dat", W / 2, 30, 7.5, font, FAINT);

  // ════════════════════════════ PAGE 2 — detail ══════════════════════════════
  const p2 = doc.addPage([W, H]);
  p2.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  const g2 = mk(p2);
  g2.text("DETAILNÍ ROZBOR", M, H - M, 9, bold, ACCENT);
  g2.text("Srovnání s průměrem města", M, H - M - 18, 16, bold, TEXT);
  if (cityName) g2.textR(cityName, W - M, H - M - 16, 11, font, MUTED);

  let yy = H - M - 50;
  const barX = M + 132, barW = 250, valX = barX + barW + 12;

  for (const grp of GROUPS) {
    const members = grp.ids.filter((id) => id in scores);
    if (!members.length) continue;
    g2.text(grp.title.toUpperCase(), M, yy, 9, bold, ACCENT);
    yy -= 17;
    for (const id of members) {
      const v = Number(scores[id]) || 0;
      const n = Number(scores[`n_${id}`]) || 0;
      g2.text(LAYER_LABELS[id], M, yy, 9.5, font, TEXT);
      // bar
      p2.drawRectangle({ x: barX, y: yy - 1, width: barW, height: 7, color: CARD });
      p2.drawRectangle({ x: barX, y: yy - 1, width: barW * v, height: 7, color: scoreColor(v) });
      // city-average tick
      if (cityAvg && typeof cityAvg[id] === "number") {
        const tx = barX + barW * Math.max(0, Math.min(1, cityAvg[id]));
        p2.drawRectangle({ x: tx - 0.8, y: yy - 4, width: 1.6, height: 13, color: TEXT });
        const delta = Math.round((v - cityAvg[id]) * 100);
        const col = delta > 1 ? GOOD : delta < -1 ? BAD : MUTED;
        g2.textR(`${delta > 0 ? "+" : ""}${delta}`, W - M, yy, 8, bold, col);
      }
      g2.text(metricText(id, n), valX, yy, 8, font, MUTED);
      yy -= 17;
    }
    yy -= 8;
  }

  // legend
  yy -= 4;
  p2.drawRectangle({ x: M, y: yy - 2, width: 18, height: 7, color: scoreColor(0.7) });
  g2.text("vaše adresa", M + 24, yy, 8, font, MUTED);
  p2.drawRectangle({ x: M + 110, y: yy - 4, width: 1.6, height: 11, color: TEXT });
  g2.text("průměr města", M + 120, yy, 8, font, MUTED);

  // sources
  yy -= 30;
  g2.text("ZDROJE DAT", M, yy, 9, bold, ACCENT);
  yy -= 15;
  const sources = [...SOURCES];
  if (typeof rent === "number" && rent > 0)
    sources.splice(6, 0, `Nájemné: MF ČR – cenová mapa nájemního bydlení${rentQuarter ? ` (${rentQuarter})` : ""}`);
  for (const s of sources) { g2.text("•  " + s, M, yy, 8, font, MUTED); yy -= 12; }
  yy -= 8;
  g2.text("Skóre 0–100 = relativní hodnocení v rámci města. Počty objektů do 800 m od adresy", M, yy, 7.5, font, FAINT);
  g2.text("(kvalita SŠ do 3 km, ovzduší roční průměr PM2.5).", M, yy - 10, 7.5, font, FAINT);

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="report.pdf"`,
    },
  });
}
