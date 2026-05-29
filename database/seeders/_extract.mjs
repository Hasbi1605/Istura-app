// One-shot extractor: parse mock arrays from ../../src/App.tsx and write them
// as JSON for Laravel seeders to consume. Use Node's vm to safely eval the
// trimmed array literals after a tiny TS->JS sanitization (drop type
// annotations on the const declaration line).
//
// Run with: node database/seeders/_extract.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_TSX = path.resolve(__dirname, "../../../src/App.tsx");
const OUT_DIR = path.resolve(__dirname, "data");
fs.mkdirSync(OUT_DIR, { recursive: true });

const src = fs.readFileSync(APP_TSX, "utf8");
const lines = src.split("\n");

// Slice 1-indexed inclusive line range and parse as a JS expression. Each
// range is the line that BEGINS with `const NAME ... = [` through the closing
// `];` (or `]);` for the inline useState case).
function sliceRange(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join("\n");
}

// Strip TS annotations on the declaration line and convert `const x: T[] = [`
// to a bare expression `[`. Same for `useState<Feedback[]>([`.
function toExpression(snippet, kind) {
  if (kind === "useState") {
    // useState<Feedback[]>([ ... ])  →  [ ... ]
    // Use [\s\S] (dotall) to match across lines, capture the array literal
    // between `useState<...>(` and the matching `)`.
    const m = snippet.match(/useState<[^>]+>\(\s*(\[[\s\S]*\])\s*\)\s*;?\s*$/);
    if (!m) throw new Error("useState pattern not matched");
    return m[1];
  }
  // `const NAME: T[] = [...];`  →  `[...]`
  const m = snippet.match(/=\s*(\[[\s\S]*\]);?\s*$/);
  if (!m) throw new Error("array assignment not matched");
  return m[1];
}

function evalArray(expr) {
  return vm.runInNewContext(`(${expr})`, {});
}

function extract({ name, range, kind = "const", out }) {
  const snippet = sliceRange(range[0], range[1]);
  const expr = toExpression(snippet, kind);
  const data = evalArray(expr);
  const file = path.join(OUT_DIR, `${out}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ ${name.padEnd(28)} → ${out}.json (${Array.isArray(data) ? data.length : 1} entries)`);
}

const targets = [
  { name: "INITIAL_FOOTER_CONTACTS", range: [89, 108], out: "footer_contacts" },
  { name: "INITIAL_FAQ_ITEMS", range: [1357, 1395], out: "faqs" },
  { name: "initialBookings", range: [300, 1184], out: "bookings" },
  { name: "initialFeedbacks (useState)", range: [1562, 1829], kind: "useState", out: "feedbacks" },
  { name: "INITIAL_WA_TEMPLATES", range: [4277, 4306], out: "wa_templates" },
  { name: "MOCK_ADMIN_USERS", range: [7140, 7162], out: "admin_users" },
  { name: "MOCK_AUDIT_LOG", range: [7214, 7235], out: "audit_logs" },
  { name: "MOCK_ADMIN_CREDENTIALS", range: [4253, 4261], out: "admin_credentials" },
];

for (const t of targets) {
  try {
    extract(t);
  } catch (err) {
    console.error(`✗ ${t.name}: ${err.message}`);
    process.exitCode = 1;
  }
}
