// Verify no 404s / failed requests on the public home and booking pages.
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
  const failed = [];
  page.on("response", (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });
  page.on("pageerror", (e) => failed.push(`JS: ${e.message}`));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const assetFails = failed.filter((f) => /\/assets\//.test(f) || f.startsWith("JS:"));
  if (assetFails.length === 0) ok("Tidak ada 404 asset atau error JS di halaman publik");
  else fail(`Masalah: \n  ${assetFails.join("\n  ")}`);

  // List which assets loaded
  await browser.close();
};

run().catch((e) => fail(e.message));
