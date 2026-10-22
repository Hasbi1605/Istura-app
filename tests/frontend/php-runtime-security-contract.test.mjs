// PHP runtime security guardrails for CVE-2026-109618 / CVE-2026-109619 ("PHP2Shell").
// Node built-in test because this repo has no PHP test runner for deploy artifacts.
// These inspect the contracts that keep a vulnerable PHP from reaching production.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("composer platform requires a PHP2Shell-patched PHP", async () => {
  const composer = JSON.parse(await read("composer.json"));

  // Fixed upstream releases per php.net advisory 21 Oct 2026:
  // 8.5.12, 8.4.27, 8.3.36, 8.2.35 (no 8.2 line is offered; support ends Dec 2026).
  assert.equal(composer.require.php, "^8.3.36 || ^8.4.27 || ^8.5.12");
});

test("CI pins patched PHP and verifies PHP_VERSION_ID", async () => {
  const workflow = await read(".github/workflows/deploy.yml");

  assert.match(workflow, /php-version:\s*'8\.4\.27'/);
  assert.match(workflow, /PHP_VERSION_ID >= 80427/);
});

test("deploy gate rejects unpatched PHP before maintenance and hardens FPM", async () => {
  const deploy = await read("deploy/aws/deploy.sh");
  // The invocation line (the definition ends with "() {").
  const gateCall = deploy.indexOf("\nrequire_patched_php_version\n");
  const maintenance = deploy.indexOf("php artisan down");

  assert.match(deploy, /CVE-2026-109618 \/ CVE-2026-109619/);
  assert.match(deploy, /ISTURA_MIN_PHP_VERSION:=80427/);
  assert.match(deploy, /is vulnerable to CVE-2026-109618 \/ CVE-2026-109619/);
  assert.ok(gateCall !== -1, "deploy must invoke the version gate");
  assert.ok(maintenance === -1 || gateCall < maintenance, "gate must run before maintenance mode");
  // Defense-in-depth for CVE-2026-109619 confirmed session path (not a patch substitute).
  assert.match(deploy, /session\.upload_progress\.enabled = 0/);
  assert.match(deploy, /systemctl is-active --quiet php8\.4-fpm/);
});
