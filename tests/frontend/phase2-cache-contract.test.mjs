// Fase 2 guardrails. Checks source contracts runnable where PHP runtime is unavailable.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("root homepage is stateless and uses short-lived public HTML cache", async () => {
  const routes = await read("routes/web.php");
  const view = await read("resources/views/app.blade.php");
  const rootRoute = routes.slice(routes.indexOf("Route::get('/',"), routes.indexOf("// SPA shell"));

  assert.match(routes, /use Illuminate\\Foundation\\Http\\Middleware\\PreventRequestForgery;/);
  assert.match(routes, /use Illuminate\\Session\\Middleware\\StartSession;/);
  assert.match(routes, /use Illuminate\\View\\Middleware\\ShareErrorsFromSession;/);
  assert.match(rootRoute, /PublicCache::rememberHomeHtml\(/);
  assert.match(rootRoute, /view\('app', SeoMeta::homePageViewData\(\)\)->render\(\)/);
  assert.match(rootRoute, /withoutMiddleware\(\[StartSession::class, ShareErrorsFromSession::class, PreventRequestForgery::class\]\)/);
  assert.doesNotMatch(view, /<meta name="csrf-token"/);
});

test("CMS invalidation clears cached homepage HTML and cache headers stay bounded", async () => {
  const cache = await read("app/Support/PublicCache.php");

  assert.match(cache, /public const HOME_HTML_TTL = 300;/);
  assert.match(cache, /public const HOME_HTML_BROWSER_TTL = 0;/);
  assert.match(cache, /public static function rememberHomeHtml\(callable \$resolver\): string/);
  assert.match(cache, /public static function homeHtmlHeaders\(\): array/);
  assert.match(cache, /public, max-age=%d, s-maxage=0, must-revalidate/);
  assert.match(cache, /public static function forgetHomeHtml\(\): void/);

  const forgetCms = cache.slice(cache.indexOf("public static function forgetCms"), cache.indexOf("public static function rememberSchedule"));
  assert.match(forgetCms, /self::forgetHomeHtml\(\);/);
});

test("deployment gives only Vite hashed assets one-year immutable caching", async () => {
  const deploy = await read("deploy/aws/deploy.sh");

  assert.match(deploy, /location \^~ \/build\/assets\//);
  assert.match(deploy, /Cache-Control "public, max-age=31536000, immutable" always;/);
  assert.match(deploy, /Strict-Transport-Security "max-age=31536000; includeSubDomains" always/);
  assert.match(deploy, /php artisan cache:forget public:html:home/);
});
