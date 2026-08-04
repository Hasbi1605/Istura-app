// Fase 1 guardrails. Node built-in test because this repo has no frontend test runner.
// These inspect public initial-render contracts that Lighthouse cannot reliably assert in unit tests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("homepage delays YouTube iframe until visitor asks to play", async () => {
  const source = await read("resources/js/components/home/HomeScreen.tsx");

  assert.match(source, /function VideoFacade\(/);
  assert.match(source, /<VideoFacade[\s\S]*siteContent\.video/);
  assert.match(source, /autoplay=1/);
  // Loading state keeps the poster visible until the iframe reports onLoad.
  assert.match(source, /onLoad=\{\(\) => setIframeReady\(true\)\}/);
  assert.match(source, /Memuat video\.\.\./);
});

test("hero keeps only active MIKY pose in initial DOM and supplies responsive candidates", async () => {
  const source = await read("resources/js/components/home/HomeScreen.tsx");
  const heroStage = source.slice(source.indexOf("function HeroStage()"), source.indexOf("function HeroMikySpeech"));

  assert.doesNotMatch(heroStage, /messages\.map/);
  assert.match(heroStage, /srcSet=\{heroSrcSet\(activeMessage\.image\)\}/);
  assert.match(heroStage, /sizes="\(max-width: 640px\) 82vw, 500px"/);
  assert.match(heroStage, /decoding=\{index === 0 \? "sync" : "async"\}/);
  assert.match(heroStage, /fetchPriority=\{safeIndex === 0 \? "high" : "auto"\}/);
  assert.match(heroStage, /onLoad=\{handlePoseLoad\}/);
  assert.match(source, /if \(safeIndex === 0\) setInitialImageReady\(true\);/);
  assert.match(source, /initialImageReady, reduced/);
});

test("MIKY warms exactly one following pose after initial pose is visible", async () => {
  const source = await read("resources/js/components/home/HomeScreen.tsx");
  const heroStage = source.slice(source.indexOf("function HeroStage()"), source.indexOf("function HeroMikySpeech"));

  assert.doesNotMatch(source, /\.\.\.HERO_MESSAGES\.map\(\(item\) => item\.image\)/);
  assert.doesNotMatch(source, /\.\.\.HERO_MESSAGES_MOBILE\.map\(\(item\) => item\.image\)/);
  assert.match(source, /const warmedHeroPoses = new Map<string, HTMLImageElement>\(\);/);
  assert.match(source, /function warmHeroPose\(src: string\)/);
  assert.match(source, /warmedHeroPoses\.clear\(\);\s*warmedHeroPoses\.set\(src, image\);/);
  assert.match(source, /image\.fetchPriority = "low"/);
  assert.match(source, /image\.srcset = heroSrcSet\(src\)/);
  assert.match(source, /void image\.decode\(\)\.catch\(\(\) => undefined\)/);
  assert.match(heroStage, /if \(loadedPose !== activeMessage\.image\) return;\s*warmHeroPose\(messages\[\(safeIndex \+ 1\) % messages\.length\]\.image\);/);
  assert.doesNotMatch(source, /urls\.forEach\(warmImage\)/);
});

test("MIKY greeting stays hidden until its first pose has decoded", async () => {
  const styles = await read("resources/js/styles.css");

  assert.match(styles, /\.miky-stage\[data-initial-image-ready="false"\] \.miky-speech\s*\{[\s\S]*?visibility:\s*hidden\s*!important;/);
});

test("hero image area reserves its 2:3 geometry before image bytes arrive", async () => {
  const styles = await read("resources/js/styles.css");
  const stackStyles = styles.slice(
    styles.indexOf(".miky-hero-stack"),
    styles.indexOf(".miky-stage-greeting::after"),
  );

  assert.match(stackStyles, /\.miky-hero-stack\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3;/);
  assert.doesNotMatch(stackStyles, /first-child/);
});

test("hero logo keeps its intrinsic aspect ratio despite explicit HTML dimensions", async () => {
  const styles = await read("resources/js/styles.css");
  const heroLogo = styles.slice(styles.indexOf(".hero-logo {"), styles.indexOf(".hero-logo-wrap .hero-logo"));

  assert.match(heroLogo, /height:\s*auto;/);
});
