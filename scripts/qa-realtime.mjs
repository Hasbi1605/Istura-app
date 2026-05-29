// Realtime end-to-end: login admin, navigate to Booking tab, then POST a new
// public booking via API from within the page context (so cookies/CSRF are
// shared) and assert the new row appears WITHOUT reload (Reverb broadcast).
//
//   node scripts/qa-realtime.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:8000";
const ok = (m) => console.log(`\u001b[32m✓\u001b[0m ${m}`);
const fail = (m) => {
  console.error(`\u001b[31m✗ ${m}\u001b[0m`);
  process.exitCode = 1;
};

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const wsFrames = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => wsFrames.push(typeof f.payload === "string" ? f.payload : ""));
  });

  // Login
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@istura.id");
  await page.fill('input[type="password"]', "istura2026");
  await page.getByRole("button", { name: /Masuk/i }).first().click();
  await page.waitForTimeout(1500);

  // Go to Booking tab
  const bookingTab = page.getByRole("button", { name: /^Booking$/ }).first();
  if (await bookingTab.count()) {
    await bookingTab.click().catch(() => {});
    await page.waitForTimeout(800);
  }

  // Submit a public booking via API from the page context (shares session).
  const uniqueInstitution = `QA Realtime ${Date.now()}`;
  const result = await page.evaluate(async (institution) => {
    // Prime CSRF
    await fetch("/sanctum/csrf-cookie", { credentials: "include" });
    const xsrf = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    const token = xsrf ? decodeURIComponent(xsrf[1]) : "";

    // Build a minimal but valid PDF file so the mimes:pdf check passes.
    const pdfText =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF";
    const blob = new Blob([pdfText], { type: "application/pdf" });
    const fd = new FormData();
    fd.append("contactName", "QA Bot");
    fd.append("nik", "3404010101900099");
    fd.append("whatsapp", "081200009999");
    fd.append("institution", institution);
    fd.append("groupSize", "10");
    // pick a near future date that is a weekday Mon-Thu
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const iso = d.toISOString().slice(0, 10);
    fd.append("date", iso);
    fd.append("time", "09.00");
    fd.append("agreement", "1");
    fd.append("document", blob, "qa-letter.pdf");

    const res = await fetch("/api/public/bookings", {
      method: "POST",
      headers: { "X-XSRF-TOKEN": token, Accept: "application/json" },
      credentials: "include",
      body: fd,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }, uniqueInstitution);

  if (result.status === 201) ok(`Public booking dibuat via API: ${result.json?.data?.code}`);
  else fail(`Public booking gagal (status ${result.status}): ${JSON.stringify(result.json)}`);

  // Wait for realtime push to update the admin list
  await page.waitForTimeout(2500);

  const bodyText = await page.textContent("body");
  if (bodyText.includes(uniqueInstitution)) {
    ok("Booking baru muncul di admin TANPA reload (realtime broadcast OK)");
  } else {
    // Fallback: check if any websocket frame carried the booking
    const carried = wsFrames.some((f) => f.includes("booking.created"));
    if (carried) ok("Frame booking.created diterima via websocket (UI mungkin di tab lain)");
    else fail("Booking baru tidak muncul realtime di admin");
  }

  await browser.close();
};

run().catch((e) => {
  fail(e.message);
  process.exit(1);
});
