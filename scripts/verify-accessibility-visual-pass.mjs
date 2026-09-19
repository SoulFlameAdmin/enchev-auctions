import fs from "node:fs";

const FILES = {
  layout: "app/layout.tsx",
  accessibility: "app/accessibility-quality.css",
  home: "app/page.tsx",
  homeHero: "app/components/HomeHeroV2.tsx",
  inventory: "app/inventory/page.tsx",
  lot: "app/lot/[id]/page.tsx",
  live: "app/live-auctions/page.tsx",
  profile: "app/profile/page.tsx",
};

function fail(message) {
  throw new Error(`ACCESSIBILITY_VISUAL_PASS FAIL: ${message}`);
}

function need(source, pattern, label) {
  if (!pattern.test(source)) fail(label);
}

export function validateAccessibilityContract(sources) {
  need(sources.layout, /import "\.\/accessibility-quality\.css";/, "root layout must load D33 accessibility layer");
  need(sources.layout, /className="eaSkipLink" href="#main-content"/, "skip-to-content link missing");

  for (const [route, source] of Object.entries({
    home: sources.home,
    inventory: sources.inventory,
    lot: sources.lot,
    live: sources.live,
    profile: sources.profile,
  })) {
    need(source, /<main id="main-content" /, `${route} main-content target missing`);
  }

  need(sources.accessibility, /\.eaSkipLink\{/, "skip-link visual style missing");
  need(sources.accessibility, /:where\(a,button,input,select,textarea,\[tabindex\]\):focus-visible\{[\s\S]*outline:3px solid #8bffc0!important/, "strong shared focus-visible ring missing");
  need(sources.accessibility, /@media\(prefers-contrast:more\)/, "increased-contrast fallback missing");
  need(sources.accessibility, /@media\(forced-colors:active\)/, "forced-colors fallback missing");
  need(sources.accessibility, /outline:3px solid Highlight!important/, "forced-colors focus indicator missing");
  need(sources.accessibility, /@media\(prefers-reduced-motion:reduce\)/, "reduced-motion fallback missing");

  need(`${sources.home}\n${sources.homeHero}`, /role="search"/, "homepage search landmark missing");
  need(sources.inventory, /aria-pressed=\{viewMode===/, "inventory view switch pressed-state semantics missing");
  need(sources.lot, /role="dialog"/, "lot image viewer dialog semantics missing");
  need(sources.live, /aria-label="Наддаване и следващ лот"/, "live bid-panel accessible label missing");
  need(sources.profile, /aria-label="Навигация на профила"/, "profile account navigation label missing");

  return true;
}

function readSources() {
  return Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]),
  );
}

function expectRejected(label, sources, mutate) {
  const copy = { ...sources };
  mutate(copy);
  let rejected = false;
  try {
    validateAccessibilityContract(copy);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const sources = readSources();
validateAccessibilityContract(sources);

if (process.argv.includes("--self-test")) {
  expectRejected("remove skip link", sources, (copy) => {
    copy.layout = copy.layout.replace('className="eaSkipLink"', 'className="removedSkipLink"');
  });
  expectRejected("remove focus ring", sources, (copy) => {
    copy.accessibility = copy.accessibility.replace("outline:3px solid #8bffc0!important;", "outline:none!important;");
  });
  expectRejected("remove route target", sources, (copy) => {
    copy.profile = copy.profile.replace('id="main-content" ', "");
  });
  console.log("ACCESSIBILITY_VISUAL_PASS_SELF_TEST PASS negative_cases=3");
} else {
  console.log("ACCESSIBILITY_VISUAL_PASS PASS routes=5 keyboard=skip-link+focus contrast=more+forced-colors");
}
