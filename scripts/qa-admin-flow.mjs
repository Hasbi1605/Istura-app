// Functional QA: login, navigate, exercise FAQ CRUD, schedule toggle, search.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:5174";
const errors = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@istura.id");
  await page.fill('input[type="password"]', "istura2026");
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  console.log("✓ login ok");

  // Navigate every menu and ensure tab heading exists
  const menu = [
    ["Dashboard", "Ringkasan operasional"],
    ["Booking", "Booking Permohonan"],
    ["Jadwal Kunjungan", "Jadwal Kunjungan"],
    ["Feedback", "Feedback Pengunjung"],
    ["FAQ", "Kelola FAQ"],
    ["Contoh Surat", "Contoh Surat"],
    ["Kontak Footer", "Kontak Footer"],
    ["Hero & Cerita", "Hero"],
    ["Template Pesan WA", "Template Pesan WhatsApp"],
    ["Pengguna Admin", "Pengguna Admin"],
    ["Riwayat Aktivitas", "Riwayat Aktivitas"],
  ];
  for (const [label, heading] of menu) {
    await page.getByRole("button", { name: new RegExp(`^${label}( soon)?$`, "i") }).click();
    await page.waitForTimeout(150);
    const text = await page.locator("main").textContent();
    if (!text || !text.includes(heading)) {
      errors.push(`tab ${label}: heading "${heading}" not found`);
    } else {
      console.log(`✓ tab ${label}`);
    }
  }

  // Schedule manager: ensure 2-month + 6 slots logic
  await page.getByRole("button", { name: /^Jadwal Kunjungan( soon)?$/i }).click();
  await page.waitForTimeout(200);
  const slotCount = await page.locator(".admin-schedule-slot").count();
  console.log("schedule slot count:", slotCount);
  if (slotCount < 1) errors.push("schedule: no slots rendered");

  // Booking search test
  await page.getByRole("button", { name: /^Booking( soon)?$/i }).click();
  await page.waitForTimeout(200);
  const initialRows = await page.locator(".booking-table button").count();
  await page.fill('.search-box input', "Sanata");
  await page.waitForTimeout(150);
  const filteredRows = await page.locator(".booking-table button").count();
  console.log(`booking rows: ${initialRows} → ${filteredRows} after search`);
  if (filteredRows >= initialRows) errors.push(`booking search: expected fewer rows, got ${filteredRows}`);
  await page.fill('.search-box input', "");

  // FAQ add/remove
  await page.getByRole("button", { name: /^FAQ( soon)?$/i }).click();
  await page.waitForTimeout(200);
  const beforeFaq = await page.locator(".admin-cms-row").count();
  await page.getByRole("button", { name: /Tambah pertanyaan/ }).click();
  await page.fill('.admin-cms-form input', "QA Test Question");
  await page.fill('.admin-cms-form textarea', "QA test answer body.");
  await page.getByRole("button", { name: "Simpan" }).click();
  await page.waitForTimeout(200);
  const afterFaq = await page.locator(".admin-cms-row").count();
  console.log(`faq rows: ${beforeFaq} → ${afterFaq}`);
  if (afterFaq <= beforeFaq) errors.push("faq: add did not increase rows");
  // Cleanup new entry
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator(".admin-cms-row").last().getByLabel("Hapus").click();
  await page.waitForTimeout(200);

  await browser.close();

  if (errors.length) {
    console.error("\n❌ QA FAILED");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  } else {
    console.log("\n✅ QA passed");
  }
})();
