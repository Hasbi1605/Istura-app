import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.QA_BASE ?? "http://127.0.0.1:8010";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const TEMP_USER_PASSWORD = "E2E-temp-user-password-123!";
if (process.env.E2E_CONFIRM_ISOLATED_DB !== "1") {
  console.error(
    "Refusing to run mutating E2E scenarios without E2E_CONFIRM_ISOLATED_DB=1. " +
      "Start a disposable test database/server first, then rerun with that env flag.",
  );
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error("Set E2E_ADMIN_PASSWORD or SEED_ADMIN_PASSWORD before running mutating E2E scenarios.");
  process.exit(1);
}

const ARTIFACT_DIR = path.resolve(process.env.E2E_ARTIFACT_DIR ?? "output/e2e");
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const results = [];
let assertions = 0;
let clientCounter = 10;
let bookingCounter = 10_000;
const totpSecrets = new Map();

function envSecretForEmail(email) {
  if (email === "admin@istura.id") return process.env.E2E_ADMIN_TOTP_SECRET ?? process.env.E2E_TOTP_SECRET;
  if (email === "operator@istura.id") return process.env.E2E_OPERATOR_TOTP_SECRET ?? process.env.E2E_TOTP_SECRET;
  return process.env.E2E_VIEWER_TOTP_SECRET ?? process.env.E2E_TOTP_SECRET;
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function currentTotp(secret, now = Date.now()) {
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function artisanTinker(statement) {
  const database = process.env.E2E_DB_DATABASE ?? process.env.DB_DATABASE;
  if (!database) throw new Error("Set E2E_DB_DATABASE for isolated DB fixture operations.");

  execFileSync("php", ["artisan", "tinker", "--execute", statement], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: {
      ...process.env,
      APP_ENV: process.env.APP_ENV ?? "local",
      APP_URL: BASE_URL,
      DB_CONNECTION: process.env.DB_CONNECTION ?? "sqlite",
      DB_DATABASE: database,
      CACHE_STORE: process.env.CACHE_STORE ?? "array",
      QUEUE_CONNECTION: process.env.QUEUE_CONNECTION ?? "sync",
      BROADCAST_CONNECTION: process.env.BROADCAST_CONNECTION ?? "null",
      SESSION_DRIVER: process.env.SESSION_DRIVER ?? "file",
    },
  });
}

function makeBookingCompletable(code) {
  const encoded = Buffer.from(code, "utf8").toString("base64");
  artisanTinker(`
    $code = base64_decode('${encoded}');
    $booking = App\\Models\\Booking::with('slots')->where('code', $code)->firstOrFail();
    $date = Carbon\\Carbon::today('Asia/Jakarta');
    $label = app(App\\Services\\ScheduleService::class)->formatLongDate($date);
    $booking->date = $date;
    $booking->date_label = $label;
    $booking->save();
    foreach ($booking->slots as $slot) {
      if ($slot->kind === App\\Models\\BookingSlot::KIND_ACTIVE) {
        $slot->date = $date;
        $slot->date_label = $label;
        $slot->active_slot_key = App\\Models\\BookingSlot::slotKey($date, $slot->time);
        $slot->save();
      }
    }
  `);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  get(name) {
    return this.cookies.get(name) ?? null;
  }

  store(headers) {
    const getSetCookie = headers.getSetCookie?.bind(headers);
    const raw = getSetCookie ? getSetCookie() : splitSetCookie(headers.get("set-cookie"));
    for (const cookie of raw) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,]+=)/g).map((entry) => entry.trim()).filter(Boolean);
}

class ApiClient {
  constructor(name) {
    this.name = name;
    this.jar = new CookieJar();
    this.csrfReady = false;
    clientCounter += 1;
    this.ip = `10.77.0.${clientCounter}`;
  }

  async csrf() {
    if (this.csrfReady) return;
    const response = await fetch(`${BASE_URL}/sanctum/csrf-cookie`, {
      headers: { Accept: "application/json" },
      redirect: "manual",
    });
    this.jar.store(response.headers);
    this.csrfReady = true;
  }

  async request(pathname, options = {}) {
    const method = options.method ?? "GET";
    const headers = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-Forwarded-For": this.ip,
      "X-Real-IP": this.ip,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      ...(options.headers ?? {}),
    };

    if (method !== "GET") {
      await this.csrf();
      const token = this.jar.get("XSRF-TOKEN");
      if (token) headers["X-XSRF-TOKEN"] = decodeURIComponent(token);
    }

    const cookie = this.jar.header();
    if (cookie) headers.Cookie = cookie;

    let body;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await fetch(`${BASE_URL}${pathname}`, {
      method,
      headers,
      body,
      redirect: "manual",
    });
    this.jar.store(response.headers);
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { status: response.status, json, text, headers: response.headers };
  }

  async json(pathname, options = {}, expectedStatus = 200) {
    const response = await this.request(pathname, options);
    expect(
      response.status === expectedStatus,
      `${this.name} ${options.method ?? "GET"} ${pathname} expected ${expectedStatus}, got ${response.status}: ${response.text.slice(0, 300)}`,
    );
    return response.json;
  }

  async login(email, password) {
    const json = await this.json("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    expect(json.user?.email === email, `${this.name} login returned expected user`);
    return json.user;
  }

  async ensureTwoFactor(email) {
    const status = await this.json("/api/auth/two-factor/status");
    let secret = totpSecrets.get(email) ?? envSecretForEmail(email);

    if (!status.enabled) {
      const setup = await this.json("/api/auth/two-factor/setup", { method: "POST" });
      secret = setup.secret;
      totpSecrets.set(email, secret);
      const confirmed = await this.json("/api/auth/two-factor/confirm", {
        method: "POST",
        body: { code: currentTotp(secret) },
      });
      expect(Array.isArray(confirmed.recovery_codes), `${this.name} 2FA setup returns recovery codes`);
      return;
    }

    if (!secret) {
      throw new Error(`2FA already enabled for ${email}; set E2E_TOTP_SECRET or a role-specific TOTP secret env var.`);
    }

    totpSecrets.set(email, secret);
    const challenge = await this.json("/api/auth/two-factor/challenge");
    if (challenge.requires_2fa) {
      await this.json("/api/auth/two-factor/verify", {
        method: "POST",
        body: { code: currentTotp(secret), trust_device: false },
      });
    }
  }
}

function expect(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

async function scenario(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, status: "passed", ms: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "failed", ms: Date.now() - started, error: error.message });
    console.error(`FAIL ${name}\n  ${error.stack ?? error.message}`);
  }
}

function firstAvailable(days, skip = new Set()) {
  const earliestBookingDate = new Date();
  earliestBookingDate.setHours(0, 0, 0, 0);
  earliestBookingDate.setDate(earliestBookingDate.getDate() + 2);
  for (const day of days) {
    if (new Date(`${day.date}T00:00:00`) < earliestBookingDate) continue;
    for (const slot of day.slots) {
      const key = `${day.date}|${slot.time}`;
      if (slot.status === "Available" && !skip.has(key)) {
        skip.add(key);
        return { date: day.date, label: day.label, time: slot.time, key };
      }
    }
  }
  throw new Error("Tidak ada slot Available di horizon jadwal.");
}

function firstAvailableRun(days, length, skip = new Set()) {
  const earliestBookingDate = new Date();
  earliestBookingDate.setHours(0, 0, 0, 0);
  earliestBookingDate.setDate(earliestBookingDate.getDate() + 2);
  for (const day of days) {
    if (new Date(`${day.date}T00:00:00`) < earliestBookingDate) continue;
    for (let index = 0; index <= day.slots.length - length; index += 1) {
      const run = day.slots.slice(index, index + length);
      if (run.every((slot) => slot.status === "Available" && !skip.has(`${day.date}|${slot.time}`))) {
        for (const slot of run) skip.add(`${day.date}|${slot.time}`);
        return { date: day.date, label: day.label, time: run[0].time, slots: run };
      }
    }
  }
  throw new Error(`Tidak ada ${length} slot Available berurutan di horizon jadwal.`);
}

async function nextAvailable(client, skip = new Set()) {
  const fresh = await client.json("/api/public/schedule");
  return firstAvailable(fresh.data, skip);
}

function publicBookingPayload(slot, suffix = Date.now(), overrides = {}) {
  bookingCounter += 1;
  const numericSuffix = String(bookingCounter).padStart(6, "0");
  const fd = new FormData();
  fd.append("contactName", `E2E User ${suffix}`);
  fd.append("nik", String(3200000000000000 + bookingCounter).padStart(16, "0").slice(0, 16));
  fd.append("whatsapp", `08123456${numericSuffix}`);
  fd.append("institution", `Instansi E2E ${suffix}`);
  fd.append("groupSize", String(overrides.groupSize ?? 25));
  fd.append("date", slot.date);
  fd.append("time", slot.time);
  fd.append("agreement", "1");
  fd.append("document", new Blob(["%PDF-1.4\n% E2E Surat\n"], { type: "application/pdf" }), `surat-${suffix}.pdf`);
  return fd;
}

async function createPublicBooking(client, slot, suffix, overrides = {}) {
  const json = await client.json("/api/public/bookings", {
    method: "POST",
    formData: publicBookingPayload(slot, suffix, overrides),
  }, 201);
  expect(json.data?.code?.startsWith("ISTURA-"), "public booking returns ISTURA code");
  expect(json.data.date === slot.date, "public booking returns chosen date");
  expect(json.data.time === slot.time, "public booking returns chosen time");
  expect(json.data.hasDocument === true, "public booking reports uploaded document");
  return json.data;
}

async function adminBookingByCode(admin, code) {
  const json = await admin.json(`/api/admin/bookings?search=${encodeURIComponent(code)}`);
  const booking = json.data.find((entry) => entry.code === code);
  expect(Boolean(booking), `admin can load booking ${code}`);
  return booking;
}

function slotStatus(days, date, time) {
  const day = days.find((entry) => entry.date === date);
  const slot = day?.slots.find((entry) => entry.time === time);
  return slot?.status ?? null;
}

async function runApiMatrix() {
  const anon = new ApiClient("anon");
  const admin = new ApiClient("super-admin");
  const operator = new ApiClient("operator");
  const viewer = new ApiClient("viewer");
  const viewerEmail = `e2e-viewer-${Date.now()}@example.test`;

  const skip = new Set();

  await scenario("public content endpoints expose live CMS/schedule data", async () => {
    const endpoints = [
      "/api/public/faqs",
      "/api/public/contacts",
      "/api/public/schedule",
      "/api/public/hero",
      "/api/public/letter",
      "/api/public/wa-templates",
    ];
    for (const endpoint of endpoints) {
      const json = await anon.json(endpoint);
      expect(json.data !== undefined, `${endpoint} has data envelope`);
    }
    const acceptedTemplate = await anon.json("/api/public/wa-templates/Accepted");
    expect(acceptedTemplate.data.id === "Accepted", "single WA template can be fetched");
  });

  await scenario("auth rejects invalid login and accepts seeded roles", async () => {
    const invalid = await anon.request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@istura.id", password: "wrong-password" },
    });
    expect(invalid.status === 422, "invalid login returns 422");
    const user = await admin.login("admin@istura.id", ADMIN_PASSWORD);
    await admin.ensureTwoFactor("admin@istura.id");
    expect(user.role === "super_admin", "super admin role returned");
    await operator.login("operator@istura.id", ADMIN_PASSWORD);
    await operator.ensureTwoFactor("operator@istura.id");
    await admin.json("/api/admin/users", {
      method: "POST",
      body: { name: "E2E Viewer", email: viewerEmail, password: TEMP_USER_PASSWORD, role: "viewer", status: "Aktif" },
    }, 201);
    await viewer.login(viewerEmail, TEMP_USER_PASSWORD);
    await viewer.ensureTwoFactor(viewerEmail);
    const me = await admin.json("/api/auth/me");
    expect(me.user.email === "admin@istura.id", "auth/me returns current user");
  });

  const scheduleJson = await anon.json("/api/public/schedule");
  const slotA = firstAvailable(scheduleJson.data, skip);
  const slotB = firstAvailable(scheduleJson.data, skip);
  const slotC = firstAvailable(scheduleJson.data, skip);

  await scenario("public booking happy path locks an available slot", async () => {
    const booking = await createPublicBooking(anon, slotA, "happy");
    const adminBookings = await admin.json(`/api/admin/bookings?search=${encodeURIComponent(booking.code)}`);
    expect(adminBookings.data.length === 1, "admin can find newly submitted booking");
    expect(adminBookings.data[0].status === "Pending", "new booking is Pending");
    const singleDay = await anon.json(`/api/public/schedule?from=${slotA.date}&to=${slotA.date}`);
    expect(slotStatus(singleDay.data, slotA.date, slotA.time) === "Held", "public schedule marks pending booking Held");
  });

  await scenario("public booking rejects duplicate active slot", async () => {
    const first = await createPublicBooking(new ApiClient("duplicate-1"), slotB, "duplicate-a");
    expect(first.status === "Pending", "first duplicate scenario booking is pending");
    const duplicate = await new ApiClient("duplicate-2").request("/api/public/bookings", {
      method: "POST",
      formData: publicBookingPayload(slotB, "duplicate-b"),
    });
    expect(duplicate.status === 422, "duplicate active slot returns 422");
    expect(Boolean(duplicate.json?.errors?.time), "duplicate active slot reports time error");
  });

  await scenario("admin schedule slot, custom slot, range, delete persist to public schedule", async () => {
    await admin.json("/api/admin/schedule/slot", {
      method: "POST",
      body: { date: slotC.date, time: slotC.time, status: "Closed" },
    });
    let day = await anon.json(`/api/public/schedule?from=${slotC.date}&to=${slotC.date}`);
    expect(slotStatus(day.data, slotC.date, slotC.time) === "Closed", "closed slot visible publicly");
    const closedBooking = await anon.request("/api/public/bookings", {
      method: "POST",
      formData: publicBookingPayload(slotC, "closed-slot"),
    });
    expect(closedBooking.status === 422, "closed slot cannot be booked");

    await admin.json("/api/admin/schedule/slot", {
      method: "POST",
      body: { date: slotC.date, time: "15.45", status: "Available" },
    });
    day = await anon.json(`/api/public/schedule?from=${slotC.date}&to=${slotC.date}`);
    expect(slotStatus(day.data, slotC.date, "15.45") === "Available", "custom available slot appears publicly");

    await admin.json("/api/admin/schedule/range", {
      method: "POST",
      body: { from: slotC.date, to: slotC.date, status: "Closed" },
    });
    day = await anon.json(`/api/public/schedule?from=${slotC.date}&to=${slotC.date}`);
    expect(slotStatus(day.data, slotC.date, "15.45") === "Closed", "range mutation includes custom slot");

    await admin.json("/api/admin/schedule/slot", {
      method: "DELETE",
      body: { date: slotC.date, time: "15.45" },
    });
    day = await anon.json(`/api/public/schedule?from=${slotC.date}&to=${slotC.date}`);
    expect(slotStatus(day.data, slotC.date, "15.45") === null, "deleted custom slot disappears");
  });

  await scenario("admin booking status transitions update schedule and document access", async () => {
    const statusSlot = await nextAvailable(anon, skip);
    const booking = await createPublicBooking(new ApiClient("status-booking"), statusSlot, "status");
    await admin.json(`/api/admin/bookings/${booking.code}/accept`, { method: "POST", body: { note: "OK" } });
    let day = await anon.json(`/api/public/schedule?from=${statusSlot.date}&to=${statusSlot.date}`);
    expect(slotStatus(day.data, statusSlot.date, statusSlot.time) === "Booked", "accepted booking marks slot Booked");
    const doc = await admin.request(`/api/admin/bookings/${booking.code}/document?disposition=inline`);
    expect(doc.status === 200, "admin can preview real booking document");
    const publicDoc = await anon.request(`/api/admin/bookings/${booking.code}/document`);
    expect([401, 403].includes(publicDoc.status), "unauthenticated document access blocked");
    const futureComplete = await admin.request(`/api/admin/bookings/${booking.code}/complete`, { method: "POST" });
    expect(futureComplete.status === 422, "future booking cannot be completed before visit date");
    makeBookingCompletable(booking.code);
    await admin.json(`/api/admin/bookings/${booking.code}/complete`, { method: "POST" });
    const completed = await admin.json(`/api/admin/bookings?search=${booking.code}`);
    expect(completed.data[0].status === "Completed", "booking can be completed");
  });

  await scenario("reschedule proposal validates target availability and can be promoted", async () => {
    const occupiedSlot = await nextAvailable(anon, skip);
    const movingSlot = await nextAvailable(anon, skip);
    const occupied = await createPublicBooking(new ApiClient("reschedule-occupied"), occupiedSlot, "reschedule-a");
    const moving = await createPublicBooking(new ApiClient("reschedule-moving"), movingSlot, "reschedule-b");
    const conflict = await admin.request(`/api/admin/bookings/${moving.code}/reschedule`, {
      method: "POST",
      body: { proposedDate: occupied.date, proposedTime: occupied.time, note: "Conflict" },
    });
    expect(conflict.status === 422, "reschedule to occupied slot rejected");

    const target = await nextAvailable(anon, skip);
    const proposed = await admin.json(`/api/admin/bookings/${moving.code}/reschedule`, {
      method: "POST",
      body: { proposedDate: target.date, proposedTime: target.time, note: "Alternatif" },
    });
    expect(proposed.data.status === "Reschedule", "reschedule proposal stored");
    const promoted = await admin.json(`/api/admin/bookings/${moving.code}/accept`, { method: "POST" });
    expect(promoted.data.status === "Accepted", "accepted reschedule promotes booking");
    expect(promoted.data.date === target.date && promoted.data.time === target.time, "accepted reschedule moves to proposed slot");
  });

  await scenario("admin manual kloter adjustments cover participant increase and decrease", async () => {
    const schedule = await anon.json("/api/public/schedule");
    const increaseBase = firstAvailable(schedule.data, skip);
    const increaseExtra = firstAvailable(schedule.data, skip);
    const increaseBooking = await createPublicBooking(new ApiClient("segments-increase"), increaseBase, "segments-increase", { groupSize: 70 });
    const increaseWithoutNote = await admin.request(`/api/admin/bookings/${increaseBooking.code}/segments`, {
      method: "POST",
      body: {
        groupSize: 120,
        segments: [
          { date: increaseBase.date, time: increaseBase.time, groupSize: 60 },
          { date: increaseExtra.date, time: increaseExtra.time, groupSize: 60 },
        ],
      },
    });
    expect(increaseWithoutNote.status === 422, "participant increase requires admin note");
    const increased = await admin.json(`/api/admin/bookings/${increaseBooking.code}/segments`, {
      method: "POST",
      body: {
        groupSize: 120,
        note: "E2E peserta bertambah.",
        segments: [
          { date: increaseBase.date, time: increaseBase.time, groupSize: 60 },
          { date: increaseExtra.date, time: increaseExtra.time, groupSize: 60 },
        ],
      },
    });
    expect(increased.data.groupSize === 120, "participant increase updates booking group size");
    expect(increased.data.kloterCount === 2, "participant increase can split into two kloters");

    const fresh = await anon.json("/api/public/schedule");
    const decreaseBase = firstAvailableRun(fresh.data, 2, skip);
    const decreaseBooking = await createPublicBooking(new ApiClient("segments-decrease"), decreaseBase, "segments-decrease", { groupSize: 120 });
    const decreaseWithoutNote = await admin.request(`/api/admin/bookings/${decreaseBooking.code}/segments`, {
      method: "POST",
      body: {
        groupSize: 70,
        segments: [{ date: decreaseBooking.date, time: decreaseBooking.time, groupSize: 70 }],
      },
    });
    expect(decreaseWithoutNote.status === 422, "participant decrease requires admin note");
    const decreased = await admin.json(`/api/admin/bookings/${decreaseBooking.code}/segments`, {
      method: "POST",
      body: {
        groupSize: 70,
        note: "E2E peserta berkurang.",
        segments: [{ date: decreaseBooking.date, time: decreaseBooking.time, groupSize: 70 }],
      },
    });
    expect(decreased.data.groupSize === 70, "participant decrease updates booking group size");
    expect(decreased.data.kloterCount === 1, "participant decrease can collapse to one kloter");
  });

  await scenario("feedback API handles valid, duplicate, invalid token, and pre-complete access", async () => {
    const feedbackSlot = await nextAvailable(anon, skip);
    const booking = await createPublicBooking(new ApiClient("feedback-booking"), feedbackSlot, "feedback");
    const adminBooking = await adminBookingByCode(admin, booking.code);
    const beforeComplete = await anon.json(`/api/public/feedback/${booking.code}?token=${encodeURIComponent(adminBooking.feedbackToken)}`);
    expect(beforeComplete.booking.code === booking.code, "feedback GET exposes booking context");
    expect(beforeComplete.booking.status === "Pending", "feedback GET exposes pre-complete status");
    const premature = await anon.request(`/api/public/feedback/${booking.code}`, {
      method: "POST",
      body: {
        token: adminBooking.feedbackToken,
        rating: 5,
        bookingEase: 5,
        service: 5,
        guideQuality: 5,
        facilityComfort: 5,
        recommend: 5,
        visitedBefore: false,
        discoverySource: "social_media",
        highlights: ["Penyambutan"],
        improvements: [],
        comment: "Premature feedback should be blocked",
        allowPublish: true,
      },
    });
    expect(premature.status === 422, "pre-complete feedback submit rejected");
    await admin.json(`/api/admin/bookings/${booking.code}/accept`, { method: "POST" });
    makeBookingCompletable(booking.code);
    await admin.json(`/api/admin/bookings/${booking.code}/complete`, { method: "POST" });
    const validPayload = {
      token: adminBooking.feedbackToken,
      rating: 5,
      bookingEase: 4,
      service: 5,
      guideQuality: 5,
      facilityComfort: 4,
      recommend: 5,
      visitedBefore: true,
      discoverySource: "previous_visit",
      highlights: ["Penyambutan"],
      improvements: ["Akses informasi"],
      comment: "E2E feedback",
      allowPublish: true,
    };
    const feedback = await anon.json(`/api/public/feedback/${booking.code}`, {
      method: "POST",
      body: validPayload,
    }, 201);
    expect(feedback.data.code === booking.code, "feedback submit returns code");
    const duplicate = await anon.request(`/api/public/feedback/${booking.code}`, {
      method: "POST",
      body: validPayload,
    });
    expect(duplicate.status === 422, "duplicate feedback rejected");
    const invalid = await anon.request(`/api/public/feedback/${booking.code}`, {
      method: "POST",
      body: { ...validPayload, token: "bad-token" },
    });
    expect(invalid.status === 422, "invalid feedback token rejected");
  });

  await scenario("CMS admin updates persist to public endpoints", async () => {
    const originalFaqs = await admin.json("/api/admin/cms/faqs");
    const originalContacts = await admin.json("/api/admin/cms/contacts");
    const originalHero = await admin.json("/api/admin/cms/hero");
    const originalWa = await admin.json("/api/admin/cms/wa-templates");

    try {
      await admin.json("/api/admin/cms/faqs", {
        method: "PUT",
        body: {
          items: [{ id: "e2e-faq", question: "Pertanyaan E2E?", answer: "Jawaban E2E.", category: "e2e", link: { label: "Buka", href: "#e2e" } }],
        },
      });
      let faqs = await anon.json("/api/public/faqs");
      expect(faqs.data[0].link.href === "#e2e", "FAQ link persists publicly");

      await admin.json("/api/admin/cms/contacts", {
        method: "PUT",
        body: { items: [{ id: "wa-e2e", label: "WhatsApp E2E", value: "0811000000", href: "https://wa.me/62811000000", iconKey: "whatsapp" }] },
      });
      const contacts = await anon.json("/api/public/contacts");
      expect(contacts.data[0].label === "WhatsApp E2E", "contact update persists publicly");

      await admin.json("/api/admin/cms/hero", {
        method: "PUT",
        body: { headline: "ISTURA E2E", subheadline: "Subheadline E2E", primaryCta: "Booking", secondaryCta: "Jadwal", story: "Story E2E" },
      });
      const hero = await anon.json("/api/public/hero");
      expect(hero.data.headline === "ISTURA E2E", "hero update persists publicly");

      const wa = await admin.json("/api/admin/cms/wa-templates", {
        method: "PUT",
        body: { items: [
          { id: "Accepted", label: "Accepted", description: "Accepted", template: "OK {kode}" },
          { id: "Rejected", label: "Rejected", description: "Rejected", template: "NO {kode}" },
          { id: "Reschedule", label: "Reschedule", description: "Reschedule", template: "RS {kode}" },
          { id: "Completed", label: "Completed", description: "Completed", template: "DONE {kode} {link}" },
        ] },
      });
      expect(wa.data.length === 4, "all WA templates update together");
    } finally {
      await admin.json("/api/admin/cms/faqs", { method: "PUT", body: { items: originalFaqs.data } });
      await admin.json("/api/admin/cms/contacts", { method: "PUT", body: { items: originalContacts.data } });
      await admin.json("/api/admin/cms/hero", { method: "PUT", body: originalHero.data });
      await admin.json("/api/admin/cms/wa-templates", { method: "PUT", body: { items: originalWa.data } });
    }
  });

  await scenario("role permissions protect admin mutations", async () => {
    const forbiddenCases = [
      viewer.request("/api/admin/schedule/slot", { method: "POST", body: { date: slotA.date, time: slotA.time, status: "Closed" } }),
      viewer.request("/api/admin/cms/faqs", { method: "PUT", body: { items: [] } }),
      viewer.request("/api/admin/bookings/ISTURA-404/accept", { method: "POST", body: {} }),
      operator.request("/api/admin/users", { method: "POST", body: { name: "Blocked", email: "blocked@example.test", password: TEMP_USER_PASSWORD, role: "viewer" } }),
    ];
    const statuses = await Promise.all(forbiddenCases).then((items) => items.map((item) => item.status));
    expect(statuses.every((status) => status === 403), `forbidden role statuses are all 403: ${statuses.join(",")}`);
  });

  await scenario("super admin user CRUD and self-delete guard work", async () => {
    const email = `e2e-user-${Date.now()}@example.test`;
    const created = await admin.json("/api/admin/users", {
      method: "POST",
      body: { name: "E2E User", email, password: TEMP_USER_PASSWORD, role: "viewer", status: "Aktif" },
    }, 201);
    expect(created.data.email === email, "super admin creates user");
    const updated = await admin.json(`/api/admin/users/${created.data.id}`, {
      method: "PUT",
      body: { name: "E2E User Updated", status: "Nonaktif" },
    });
    expect(updated.data.name === "E2E User Updated", "super admin updates user");
    await admin.json(`/api/admin/users/${created.data.id}`, { method: "DELETE" });
    const users = await admin.json("/api/admin/users");
    expect(!users.data.some((user) => user.email === email), "deleted user no longer appears");
    const selfDelete = await admin.request(`/api/admin/users/${users.data.find((user) => user.email === "admin@istura.id")?.id}`, { method: "DELETE" });
    expect(selfDelete.status === 422, "self delete returns validation error");
  });

  await scenario("validation matrix rejects malformed public/admin payloads", async () => {
    const invalidBookingCases = [
      ["missing name", { contactName: "" }],
      ["short nik", { nik: "123" }],
      ["zero group", { groupSize: "0" }],
      ["bad date", { date: "2026-99-99" }],
      ["bad time", { time: "8:00" }],
      ["missing agreement", { agreement: "0" }],
    ];
    for (const [label, patch] of invalidBookingCases) {
      const fd = publicBookingPayload(slotA, `invalid-${label}`);
      for (const [key, value] of Object.entries(patch)) {
        fd.set(key, value);
      }
      const response = await anon.request("/api/public/bookings", { method: "POST", formData: fd });
      expect(response.status === 422, `invalid booking rejected: ${label}`);
    }

    const invalidScheduleCases = [
      { date: "bad", time: "08.00", status: "Closed" },
      { date: slotA.date, time: "8:00", status: "Closed" },
      { date: slotA.date, time: "08.00", status: "Unknown" },
    ];
    for (const body of invalidScheduleCases) {
      const response = await admin.request("/api/admin/schedule/slot", { method: "POST", body });
      expect(response.status === 422, `invalid schedule slot rejected: ${JSON.stringify(body)}`);
    }

    const invalidFeedbackCases = [
      { token: "x", rating: 0, bookingEase: 5, service: 5, guideQuality: 5, facilityComfort: 5, recommend: 5, visitedBefore: false, discoverySource: "social_media", highlights: [], improvements: [], comment: "", allowPublish: true },
      { token: "x", rating: 5, bookingEase: 6, service: 5, guideQuality: 5, facilityComfort: 5, recommend: 5, visitedBefore: false, discoverySource: "social_media", highlights: [], improvements: [], comment: "", allowPublish: true },
      { token: "x", rating: 5, bookingEase: 5, service: 5, guideQuality: 5, facilityComfort: 5, recommend: 5, visitedBefore: false, discoverySource: "social_media", highlights: [], improvements: [], comment: "", allowPublish: "yes" },
    ];
    for (const body of invalidFeedbackCases) {
      const response = await anon.request("/api/public/feedback/ISTURA-404", { method: "POST", body });
      expect([404, 422].includes(response.status), `invalid feedback request rejected with ${response.status}`);
    }
  });
}

async function runBrowserFlows() {
  const publicApi = new ApiClient("browser-setup-public");
  const adminApi = new ApiClient("browser-setup-admin");
  await adminApi.login("admin@istura.id", ADMIN_PASSWORD);
  await adminApi.ensureTwoFactor("admin@istura.id");
  const schedule = await publicApi.json("/api/public/schedule");
  const skip = new Set();
  firstAvailable(schedule.data, skip);
  const feedbackSlot = await nextAvailable(publicApi, skip);
  const feedbackBooking = await createPublicBooking(publicApi, feedbackSlot, "browser-feedback");
  await adminApi.json(`/api/admin/bookings/${feedbackBooking.code}/accept`, { method: "POST" });
  makeBookingCompletable(feedbackBooking.code);
  await adminApi.json(`/api/admin/bookings/${feedbackBooking.code}/complete`, { method: "POST" });
  const feedbackAdminBooking = await adminBookingByCode(adminApi, feedbackBooking.code);

  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const failedResponses = [];

  await scenario("browser public landing and booking wizard happy path", async () => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await expectLocator(page.getByRole("heading", { name: /ISTURA/i }).first(), "landing heading exists");
    await page.getByRole("button", { name: /Mulai Booking/i }).first().click();
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.getByLabel(/Nama Lengkap CP/i).fill("Browser E2E User");
    await page.getByLabel(/NIK KTP/i).fill("3200000000001234");
    await page.getByLabel(/Nomor WhatsApp CP/i).fill("081234567899");
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.getByLabel(/Asal Instansi/i).fill("Browser E2E School");
    await page.getByLabel(/Jumlah Rombongan/i).fill("160");
    expect(
      await page.getByRole("link", { name: /Diskusikan via WhatsApp/i }).count() === 0,
      "large-group WhatsApp CTA is not duplicated on institution step",
    );
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.locator(`button.calendar-day.is-available:not([disabled])`).first().click();
    await page.locator(`button.time-option:not([disabled])`).first().click();
    const kloterWhatsappLink = page.getByRole("link", { name: /Diskusikan via WhatsApp/i });
    await expectLocator(kloterWhatsappLink, "large-group WhatsApp CTA appears after selecting schedule");
    const kloterWhatsappHref = decodeURIComponent((await kloterWhatsappLink.getAttribute("href")) ?? "");
    expect(kloterWhatsappHref.includes("Tanggal:"), "large-group WhatsApp message includes visit date");
    expect(kloterWhatsappHref.includes("Kloter 1:"), "large-group WhatsApp message includes kloter schedule");
    await page.getByRole("button", { name: /Lanjut/i }).click();
    const uploadPath = path.join(ARTIFACT_DIR, "browser-surat.pdf");
    fs.writeFileSync(uploadPath, "%PDF-1.4\n% Browser E2E\n");
    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Submit Booking/i }).click();
    await expectLocator(page.getByText(/Permohonan berhasil dikirim/i), "booking wizard success text");
    await context.close();
  });

  await scenario("browser admin login, booking search, and schedule page render", async () => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    await page.goto("/admin", { waitUntil: "networkidle" });
    await page.getByLabel(/Email/i).fill("admin@istura.id");
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /^Masuk$/i }).click();
    await completeBrowserTwoFactorIfPresent(page, "admin@istura.id");
    await expectLocator(page.locator(".admin-shell-menu").first(), "admin shell menu visible");
    await clickAdminMenu(page, "Booking");
    await expectLocator(page.getByRole("heading", { name: /Booking Permohonan/i }), "admin booking page visible");
    await page.getByPlaceholder(/Cari kode/i).fill("ISTURA");
    await clickAdminMenu(page, "Jadwal Kunjungan");
    await expectLocator(page.getByRole("heading", { name: /Jadwal Kunjungan/i }), "admin schedule page visible");
    await context.close();
  });

  await scenario("browser direct feedback link opens completed booking form", async () => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    await page.goto(`/feedback/${feedbackBooking.code}?token=${encodeURIComponent(feedbackAdminBooking.feedbackToken)}`, { waitUntil: "networkidle" });
    await expectLocator(page.getByRole("heading", { name: /Penilaian Inti/i }), "direct feedback link shows form");
    await page.locator('.rating-field').nth(0).getByRole("radio", { name: /5 dari 5/i }).click();
    await page.locator('.rating-field').nth(1).getByRole("radio", { name: /5 dari 5/i }).click();
    await page.locator('.rating-field').nth(2).getByRole("radio", { name: /5 dari 5/i }).click();
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.locator('.rating-field').nth(0).getByRole("radio", { name: /5 dari 5/i }).click();
    await page.locator('.rating-field').nth(1).getByRole("radio", { name: /5 dari 5/i }).click();
    await page.getByRole("radio", { name: /Belum, ini pertama kali/i }).click();
    await page.getByLabel(/Dari mana pertama kali/i).selectOption("social_media");
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.getByRole("radio", { name: "5" }).click();
    await page.getByRole("button", { name: /Lanjut/i }).click();
    await page.getByLabel(/Saran atau cerita pengalaman/i).fill("Browser feedback e2e");
    await page.getByRole("button", { name: /Kirim Feedback/i }).click();
    await expectLocator(page.getByText(/Feedback berhasil dikirim/i), "feedback success visible");
    await context.close();
  });

  await browser.close();

  await scenario("browser run has no fatal console errors or server errors", async () => {
    const ignored = pageErrors.filter((entry) => {
      return !entry.includes("ResizeObserver loop")
        && !entry.includes("Permissions policy violation: compute-pressure");
    });
    expect(ignored.length === 0, `browser console/page errors: ${ignored.join(" | ")}`);
    expect(failedResponses.length === 0, `server error responses: ${failedResponses.join(" | ")}`);
  });
}

async function completeBrowserTwoFactorIfPresent(page, email) {
  await page.waitForFunction(() => {
    return Boolean(document.querySelector(".admin-shell-menu"))
      || Boolean(document.querySelector('input[autocomplete="one-time-code"]'))
      || document.body.innerText.includes("Aktifkan Verifikasi 2 Langkah")
      || document.body.innerText.includes("Verifikasi Dua Langkah");
  }, null, { timeout: 10_000 });

  const adminMenuVisible = await page.locator(".admin-shell-menu").first().isVisible().catch(() => false);
  if (adminMenuVisible) return;

  const otpInput = page.locator('input[autocomplete="one-time-code"]').first();
  await otpInput.waitFor({ state: "visible", timeout: 10_000 });

  let secret = totpSecrets.get(email) ?? envSecretForEmail(email);
  if (!secret) {
    const secretText = await page.locator("code").first().textContent({ timeout: 2_000 }).catch(() => null);
    secret = secretText?.trim();
  }
  if (!secret) throw new Error(`Browser 2FA requires TOTP secret for ${email}`);

  totpSecrets.set(email, secret);
  await otpInput.fill(currentTotp(secret));
  const verifyButton = page.getByRole("button", { name: /Verifikasi|Konfirmasi & Aktifkan/i }).first();
  await verifyButton.click();

  const recoveryButton = page.getByRole("button", { name: /Saya sudah menyimpan/i }).first();
  const needsRecoveryConfirm = await recoveryButton.isVisible({ timeout: 2_000 }).catch(() => false);
  if (needsRecoveryConfirm) await recoveryButton.click();

  await page.locator(".admin-shell-menu").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function expectLocator(locator, label) {
  assertions += 1;
  try {
    await locator.waitFor({ state: "visible", timeout: 10_000 });
  } catch (error) {
    throw new Error(`${label} not visible: ${error.message}`);
  }
}

async function clickWithRetry(locator, label, attempts = 4) {
  assertions += 1;
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      await locator.click({ timeout: 8_000 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`${label} click failed: ${lastError?.message ?? "unknown error"}`);
}

async function clickAdminMenu(page, label) {
  assertions += 1;
  try {
    await page.waitForFunction((text) => {
      return [...document.querySelectorAll("button.admin-shell-menu-item")]
        .some((button) => button.textContent?.trim() === text);
    }, label, { timeout: 10_000 });
    await page.evaluate((text) => {
      const button = [...document.querySelectorAll("button.admin-shell-menu-item")]
        .find((entry) => entry.textContent?.trim() === text);
      if (!(button instanceof HTMLButtonElement)) throw new Error(`Menu ${text} tidak ditemukan.`);
      button.click();
    }, label);
  } catch (error) {
    const body = await page.locator("body").innerText().catch(() => "");
    throw new Error(`admin menu ${label} click failed: ${error.message}; body=${body.slice(0, 500)}`);
  }
}

await runApiMatrix();
await runBrowserFlows();

const summary = {
  baseUrl: BASE_URL,
  assertions,
  passed: results.filter((r) => r.status === "passed").length,
  failed: results.filter((r) => r.status === "failed").length,
  results,
};
fs.writeFileSync(path.join(ARTIFACT_DIR, "e2e-summary.json"), JSON.stringify(summary, null, 2));

console.log(`\nE2E summary: ${summary.passed} passed, ${summary.failed} failed, ${assertions} assertions`);
console.log(`Artifact: ${path.join(ARTIFACT_DIR, "e2e-summary.json")}`);

if (summary.failed > 0) {
  process.exitCode = 1;
}
