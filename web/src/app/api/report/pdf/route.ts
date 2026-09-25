import { type NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { canVerifyLiveSession, stripeSecret, PAYMENTS_VISIBLE } from "../../../../lib/payment";
import { getPdfCopy, type PdfFlagId, type PdfLayerId, type PdfNearbyId } from "../../../../lib/pdf-copy";
import { verifyPreviewToken } from "../../../../lib/preview-token";
import { validateReportPayload } from "../../../../lib/report-payload";
import { BodyTooLargeError, clientIdentifier, ConcurrencyGate, ConcurrencyLimitError, FixedWindowRateLimiter, readLimitedJson } from "../../_lib/request-protection";

export const runtime = "nodejs";
const pdfLimiter = new FixedWindowRateLimiter(6, 60_000, 1_024);
const pdfGate = new ConcurrencyGate(2);

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

async function sessionPaid(
  session: string | null,
  previewToken: unknown,
  report: { address: string; scores: Record<string, number> },
): Promise<boolean> {
  if (verifyPreviewToken(previewToken, report, process.env.REPORT_PREVIEW_SECRET ?? "")) return true;
  if (!PAYMENTS_VISIBLE) return true; // Free mode!
  if (!session) return false;
  if (!canVerifyLiveSession(session)) return false;
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session}`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } });
  if (!res.ok) return false;
  return (await res.json()).payment_status === "paid";
}

function loadFont(name: string): Uint8Array {
  return readFileSync(join(process.cwd(), "src/assets", name));
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!pdfLimiter.allow(clientIdentifier(req.headers)))
    return NextResponse.json({ error: "rate limit" }, { status: 429, headers: { "Retry-After": "60" } });

  let body: Record<string, unknown> = {};
  try {
    if (ct.includes("application/json")) {
      body = await readLimitedJson(req, 5_000_000) as Record<string, unknown>;
    } else {
      const form = await req.formData().catch(() => null);
      const payload = form?.get("payload");
      if (typeof payload === "string") {
        body = JSON.parse(payload);
      } else {
        throw new Error("missing payload");
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: "bad_body" },
      { status: 400 },
    );
  }

  const validation = validateReportPayload(body);
  if (!validation.ok)
    return NextResponse.json({ error: validation.error }, { status: validation.error === "payload_too_large" ? 413 : 400 });

  const { address, scores, session, previewToken, locale, mapImage, cityAvg, cityName, nearby, rent, rentCity, rentQuarter, isoWalk, isoDrive, flood, flags, unavailableSources } = body as {
    address: string; scores: Record<string, number>; session?: string | null;
    previewToken?: string | null;
    locale?: string;
    mapImage?: string; cityAvg?: Record<string, number>; cityName?: string;
    nearby?: Record<string, { name: string; dist: number; min: number }>;
    rent?: number; rentCity?: number; rentQuarter?: string;
    isoWalk?: { img: string; area?: number }; isoDrive?: { img: string; area?: number };
    flood?: number;
    flags?: Record<string, { dist: number }>;
    unavailableSources?: string[];
  };

  if (!(await sessionPaid(session ?? null, previewToken, { address, scores })))
    return NextResponse.json({ error: "payment_required" }, { status: 402 });

  try {
    return await pdfGate.run(async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(loadFont("DejaVuSans.ttf"));
  const bold = await doc.embedFont(loadFont("DejaVuSans-Bold.ttf"));

  const W = 595, H = 842, M = 44;
  const copy = getPdfCopy(locale);
  const ids = (Object.keys(copy.layers) as PdfLayerId[]).filter((k) => k in scores);
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

  // ════════════════════════════ PAGE 1 - overview ════════════════════════════
  const p1 = doc.addPage([W, H]);
  p1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  const g1 = mk(p1);

  // hero band
  p1.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: CARD });
  p1.drawRectangle({ x: 0, y: H - 96, width: 4, height: 96, color: ACCENT });
  
  const date = new Date().toLocaleDateString(copy.dateLocale);
  
  // QR Code
  try {
    const host = req.headers.get("host") || "localhost:3000";
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const isLocal = host.includes("localhost") || host.includes(":3000") || host.startsWith("10.") || host.startsWith("192.");
    const protocol = forwardedProto || (isLocal ? "http" : "https");
    const reportUrl = `${protocol}://${host}/${locale || 'cs'}/report?address=${encodeURIComponent(address || '')}`;
    const qrDataUrl = await QRCode.toDataURL(reportUrl, { margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    const qrImage = await doc.embedPng(Buffer.from(qrDataUrl.split(",")[1], "base64"));
    p1.drawImage(qrImage, { x: W - M - 64, y: H - 80, width: 64, height: 64 });
    g1.textR(copy.generated(date), W - M - 76, H - 76, 9, font, FAINT);
  } catch {
    g1.textR(copy.generated(date), W - M, H - 82, 9, font, FAINT);
  }

  g1.text(copy.brand, M, H - 38, 9, bold, ACCENT);
  g1.text(copy.reportTitle, M, H - 64, 22, bold, TEXT);
  g1.text(String(address ?? "-"), M, H - 82, 11, font, MUTED);

  let y = H - 96;

  // ── neighborhood map - full-width banner, fills edge-to-edge (cover-fit) ────
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
  g1.text(copy.map.worse, lgX, lgY + 6, 7, font, MUTED);
  const swX = lgX + 22;
  legColors.forEach((c, i) => p1.drawRectangle({ x: swX + i * 11, y: lgY + 6, width: 11, height: 7, color: c }));
  g1.text(copy.map.better, swX + 3 * 11 + 4, lgY + 6, 7, font, MUTED);
  g1.text(copy.map.overallRating, lgX, lgY - 3, 6.5, font, FAINT);
  g1.text(copy.map.addressArea, bx + 10, bTop - 14, 8, bold, rgb(1, 1, 1));

  y = bTop - bh - 24;

  // ── rent headline (official MF ČR cenová mapa), centered under the map ──────
  if (typeof rent === "number" && rent > 0) {
    g1.textC(copy.rent.headline(rent), W / 2, 469, 11, bold, TEXT);
    if (typeof rentCity === "number" && rentCity > 0) {
      const diff = Math.round(((rent - rentCity) / rentCity) * 100);
      g1.textC(copy.rent.comparison(diff, cityName), W / 2, 458, 8, font, diff > 0 ? BAD : GOOD);
    }
  }

  // ── gauge (overall) + verdict (left) ───────────────────────────────────────
  const gx = M + 48, gy = y - 50, gr = 42;
  g1.arc(gx, gy, gr, 220, -40, 8, LINE);
  g1.arc(gx, gy, gr, 220, 220 - 260 * overall, 8, scoreColor(overall));
  g1.textC(String(Math.round(overall * 100)), gx, gy - 5, 30, bold, TEXT);
  g1.textC(copy.scoreOutOf, gx, gy - 21, 8, font, MUTED);
  g1.text(copy.verdict(overall), M, gy - gr - 24, 13, bold, TEXT);
  g1.text(copy.overallScore(cityName), M, gy - gr - 40, 9, font, MUTED);

  // ── radar (theme profile) - right of gauge ─────────────────────────────────
  const themes = copy.groups.map((grp) => {
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
      g1.text(copy.layers[it.k as PdfLayerId], cardX + 10, yy, 9, font, TEXT);
      g1.textR(`${Math.round(it.v * 100)}`, cardRight, yy, 9, font, col);
      yy -= 14;
    }
    return yy;
  };
  const listTop = gy - gr - 64;
  const after = drawList(copy.strengths, ranked.slice(0, 3), GOOD, listTop);
  drawList(copy.weaknesses, ranked.slice(-3).reverse(), BAD, after - 14);

  // ── pros & cons spread (full-width band, bottom of page) ───────────────────
  const pros = (["transit", "supermarket", "pharmacy", "health", "school", "park"] as PdfNearbyId[])
    .filter((c) => nearby && nearby[c]).slice(0, 5);
  const cons = Object.entries(flags || {})
    .filter(([k]) => k in copy.flags)
    .map(([k, v]) => ({ k: k as PdfFlagId, dist: v.dist }))
    .sort((a, b) => a.dist - b.dist).slice(0, 5);

  if (pros.length || cons.length || flags) {
    const colW = (W - 2 * M) / 2;
    const nbTop = 166, rowStep = 23;
    p1.drawLine({ start: { x: M, y: nbTop + 12 }, end: { x: W - M, y: nbTop + 12 }, thickness: 0.5, color: LINE });
    g1.text(copy.prosHeading, M, nbTop, 8, bold, GOOD);
    g1.text(copy.risksHeading, M + colW, nbTop, 8, bold, BAD);

    pros.forEach((c, i) => {
      const p = nearby![c];
      const ry = nbTop - 22 - i * rowStep;
      g1.text(p.name.length > 26 ? p.name.slice(0, 25) + "…" : p.name, M, ry, 9.5, font, TEXT);
      g1.text(copy.nearbyLabels[c], M, ry - 11, 7, font, FAINT);
      g1.textR(copy.distance(p.dist), M + colW - 16, ry, 9, bold, TEXT);
    });

    const cx = M + colW;
    if (cons.length) {
      cons.forEach((f, i) => {
        const [label, sub] = copy.flags[f.k];
        const ry = nbTop - 22 - i * rowStep;
        const col = f.dist < 100 ? BAD : ACCENT;
        g1.text(label, cx, ry, 9.5, font, col);
        g1.text(sub, cx, ry - 11, 7, font, FAINT);
        g1.textR(copy.distance(f.dist), cx + colW - 16, ry, 9, bold, col);
      });
    } else if (flags) {
      g1.text(copy.noRisks, cx, nbTop - 22, 9.5, font, GOOD);
      g1.text(copy.noRisksDetail, cx, nbTop - 33, 7, font, FAINT);
    }
  }

  g1.textC(copy.footer, W / 2, 30, 7.5, font, FAINT);

  // ════════════════════════════ PAGE 2 - detail ══════════════════════════════
  const p2 = doc.addPage([W, H]);
  p2.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  const g2 = mk(p2);
  g2.text(copy.detailHeading, M, H - M, 9, bold, ACCENT);
  g2.text(copy.cityComparisonTitle, M, H - M - 18, 16, bold, TEXT);
  if (cityName) g2.textR(cityName, W - M, H - M - 16, 11, font, MUTED);

  let yy = H - M - 50;
  const barX = M + 132, barW = 250, valX = barX + barW + 12;

  for (const grp of copy.groups) {
    const members = grp.ids.filter((id) => id in scores);
    if (!members.length) continue;
    g2.text(grp.title.toUpperCase(), M, yy, 9, bold, ACCENT);
    yy -= 17;
    for (const id of members) {
      const v = Number(scores[id]) || 0;
      const n = Number(scores[`n_${id}`]) || 0;
      g2.text(copy.layers[id], M, yy, 9.5, font, TEXT);
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
      g2.text(copy.metric(id, n), valX, yy, 8, font, MUTED);
      yy -= 17;
    }
    yy -= 8;
  }

  // legend
  yy -= 4;
  p2.drawRectangle({ x: M, y: yy - 2, width: 18, height: 7, color: scoreColor(0.7) });
  g2.text(copy.addressLegend, M + 24, yy, 8, font, MUTED);
  p2.drawRectangle({ x: M + 110, y: yy - 4, width: 1.6, height: 11, color: TEXT });
  g2.text(copy.cityAverageLegend, M + 120, yy, 8, font, MUTED);

  // environment & risks - day/night noise split + flood hazard
  const dNoise = Number(scores["n_quiet"]) || 0;
  const nNoise = Number(scores["noise_night"]) || 0;
  if (dNoise || nNoise || typeof flood === "number") {
    yy -= 28;
    g2.text(copy.environment.heading, M, yy, 9, bold, ACCENT);
    yy -= 17;
    if (dNoise || nNoise) {
      g2.text(copy.environment.noise, M, yy, 9, font, MUTED);
      g2.text(copy.environment.noiseLevels(dNoise || "-", nNoise || "-"), M + 150, yy, 10, bold, TEXT);
      yy -= 15;
    }
    if (typeof flood === "number") {
      const FLOOD: [string, RGB][] = copy.environment.floodLevel.map((label, index) =>
        [label, index < 2 ? GOOD : index === 2 ? ACCENT : BAD]
      );
      const [label, col] = FLOOD[Math.max(0, Math.min(4, flood))];
      g2.text(copy.environment.floodRisk, M, yy, 9, font, MUTED);
      g2.text(label + (flood > 0 ? `  ${copy.environment.floodCategory(flood)}` : ""), M + 150, yy, 10, bold, col);
      yy -= 15;
    }
  }
  // honest scope note: the national hazard map is fluvial (river) flooding only
  if (typeof flood === "number") {
    g2.text(copy.environment.floodScope, M, yy, 7, font, FAINT);
    yy -= 13;
  }

  // sources
  yy -= 30;
  g2.text(copy.sources.heading, M, yy, 9, bold, ACCENT);
  yy -= 15;
  const sources = [...copy.sources.base];
  if (typeof rent === "number" && rent > 0)
    sources.splice(6, 0, copy.sources.rent(rentQuarter));
  if (typeof flood === "number")
    sources.push(copy.sources.flood);
  for (const s of sources) { g2.text("•  " + s, M, yy, 8, font, MUTED); yy -= 12; }
  yy -= 8;
  g2.text(copy.methodology[0], M, yy, 7.5, font, FAINT);
  g2.text(copy.methodology[1], M, yy - 10, 7.5, font, FAINT);
  if (unavailableSources?.length) {
    let warningY = yy - 32;
    let line = "";
    for (const word of copy.partialWarning.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 7.5) > W - 2 * M && line) {
        g2.text(line, M, warningY, 7.5, font, BAD);
        warningY -= 11;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) g2.text(line, M, warningY, 7.5, font, BAD);
  }

  // ════════════════════════ PAGE 3 - accessibility (10-min reach) ════════════
  if (isoWalk?.img || isoDrive?.img) {
    const p3 = doc.addPage([W, H]);
    p3.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
    const g3 = mk(p3);
    g3.text(copy.accessibility.heading, M, H - M, 9, bold, ACCENT);
    g3.text(copy.accessibility.title, M, H - M - 20, 16, bold, TEXT);
    if (cityName) g3.textR(cityName, W - M, H - M - 18, 11, font, MUTED);
    g3.text(copy.accessibility.scope, M, H - M - 38, 9, font, MUTED);

    const tileW = W - 2 * M, tileH = 300;
    const entries = [
      { data: isoWalk, label: copy.accessibility.walk, labelY: 744 },
      { data: isoDrive, label: copy.accessibility.drive, labelY: 390 },
    ];
    for (const e of entries) {
      const bxT = M, byT = e.labelY - 16 - tileH;
      p3.drawRectangle({ x: bxT, y: byT, width: tileW, height: tileH, color: CARD, borderColor: LINE, borderWidth: 1 });
      g3.text(e.label, M, e.labelY, 11, bold, TEXT);
      if (e.data?.area != null) g3.textR(copy.accessibility.reachableArea(e.data.area), W - M, e.labelY, 9, font, MUTED);
      if (e.data?.img && e.data.img.startsWith("data:image/png")) {
        try {
          const png = await doc.embedPng(Buffer.from(e.data.img.split(",")[1], "base64"));
          const fit = Math.max(tileW / png.width, tileH / png.height);
          const iw = png.width * fit, ih = png.height * fit;
          const ix = bxT + (tileW - iw) / 2, iy = byT + (tileH - ih) / 2;
          p3.pushOperators(pushGraphicsState(), rectangle(bxT, byT, tileW, tileH), clip(), endPath());
          p3.drawImage(png, { x: ix, y: iy, width: iw, height: ih });
          p3.pushOperators(popGraphicsState());
          const mcx = bxT + tileW / 2, mcy = byT + tileH / 2;
          p3.drawCircle({ x: mcx, y: mcy, size: 10, color: rgb(0, 0, 0), opacity: 0.15 });
          p3.drawCircle({ x: mcx, y: mcy, size: 5, color: ACCENT, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1.8 });
        } catch { /* skip */ }
      } else {
        g3.textC(copy.unavailable, bxT + tileW / 2, byT + tileH / 2, 10, font, FAINT);
      }
    }
    g3.text(copy.accessibility.isochroneNote, M, 50, 7.5, font, FAINT);
    g3.textC(copy.footer, W / 2, 30, 7.5, font, FAINT);
  }

  const safeName = address
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const filename = safeName ? `${safeName}-report.pdf` : "kam-v-cesku-report.pdf";

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
    });
  } catch (error) {
    if (error instanceof ConcurrencyLimitError)
      return NextResponse.json({ error: "server busy" }, { status: 503, headers: { "Retry-After": "2" } });
    throw error;
  }
}
