export const RTL_LAYOUT_CAPABILITY_MODEL_VERSION = 1 as const;

export type LayoutDirection = "ltr" | "rtl";

export type LayoutDirectionProfile = Readonly<{
  locale: string;
  direction: LayoutDirection;
}>;

export type LayoutDirectionResult =
  | Readonly<{ ok: true; value: LayoutDirectionProfile }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const PROFILE_KEYS = ["direction", "locale"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const target = [...expected].sort();
  return actual.length === target.length && actual.every((key, index) => key === target[index]);
}

function canonicalLocale(value: string): string | null {
  try {
    const canonical = Intl.getCanonicalLocales(value);
    return canonical.length === 1 ? canonical[0] : null;
  } catch {
    return null;
  }
}

export function resolveLayoutDirection(input: unknown): LayoutDirectionResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["layout direction profile must be an object"] };
  }

  const errors: string[] = [];
  if (!hasExactKeys(input, PROFILE_KEYS)) {
    errors.push("layout direction profile must contain only locale and direction");
  }

  const locale = input.locale;
  const direction = input.direction;
  const canonical =
    typeof locale === "string" && locale.length > 0 ? canonicalLocale(locale) : null;

  if (!canonical) errors.push("locale must be a valid BCP 47 locale identifier");
  if (direction !== "ltr" && direction !== "rtl") errors.push("direction must be ltr or rtl");

  if (errors.length > 0 || !canonical || (direction !== "ltr" && direction !== "rtl")) {
    return { ok: false, errors };
  }

  return { ok: true, value: { locale: canonical, direction } };
}

export function layoutDirectionAttributes(
  input: unknown
): Readonly<{ lang: string; dir: LayoutDirection }> | null {
  const result = resolveLayoutDirection(input);
  return result.ok ? { lang: result.value.locale, dir: result.value.direction } : null;
}
