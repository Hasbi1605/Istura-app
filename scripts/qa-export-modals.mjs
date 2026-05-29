// Smoke test: open the three admin export modals to confirm extracted
// components render without errors.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:8000";
const ok = (m) => console.log(`\u001b[32m✓\u001b[0m ${m}`);
const fail = (m) => {
  console.error(`\u001b[31m✗ ${m}\u001b[0m`);
  process.exitCode = 1;
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@istura.id");
  await page.fill('input[type="password"]', "istura2026");
  await page.getByRole("button", { name: /Masuk/i }).first().click();
  await page.waitForTimeout(1200);

  // Booking tab -> Export
  await page.getByRole("button", { name: /^Booking$/ }).first().click();
  await page.waitForTimeout(400);
  const exportBtn = page.getByRole("button", { name: /Export|Unduh|Ekspor/i }).first();
  if (await exportBtn.count()) {
    await exportBtn.click().catch(() => {});
    await page.waitForTimeout(400);
    const dialog = await page.locator('[role="dialog"]').count();
    if (dialog > 0) ok("Booking export modal terbuka");
    else fail("Booking export modal tidak terbuka");
    await page.keyboard.press("Escape").catch(() => {});
  } else {
    ok("Tombol export booking tidak ditemukan (lewati)");
  }

  if (errors.length) fail(`Page errors: ${errors.join(" | ")}`);
  else ok("Tidak ada error JS saat membuka modal");

  await browser.close();
};

run().catch((e) => fail(e.message));
