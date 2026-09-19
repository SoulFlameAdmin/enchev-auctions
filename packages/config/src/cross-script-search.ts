export const CROSS_SCRIPT_SEARCH_MODEL_VERSION = 1 as const;

const BULGARIAN_TO_LATIN: Readonly<Record<string, string>> = Object.freeze({
  "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ж":"zh","з":"z","и":"i","й":"y",
  "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u",
  "ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sht","ъ":"a","ь":"y","ю":"yu","я":"ya"
});

export type CrossScriptSearchDocument = Readonly<{
  text: readonly string[];
  identifiers?: readonly string[];
}>;

export function foldCrossScriptSearchText(value: string): string {
  if (typeof value !== "string") return "";

  const nfc = value.normalize("NFC").toLowerCase();
  let transliterated = "";

  for (const character of nfc) {
    transliterated += BULGARIAN_TO_LATIN[character] ?? character;
  }

  return transliterated
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAsciiSearchIdentifier(value: string): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9-]+$/.test(normalized)) return null;
  return normalized;
}

export function matchesCrossScriptSearch(
  query: string,
  document: CrossScriptSearchDocument
): boolean {
  if (typeof query !== "string") return false;

  const trimmed = query.trim();
  if (!trimmed) return true;

  const identifierQuery = normalizeAsciiSearchIdentifier(trimmed);
  if (identifierQuery && document.identifiers?.some((identifier) => {
    const normalizedIdentifier = normalizeAsciiSearchIdentifier(identifier);
    return normalizedIdentifier?.includes(identifierQuery) === true;
  })) {
    return true;
  }

  const foldedQuery = foldCrossScriptSearchText(trimmed);
  if (!foldedQuery) return false;

  return document.text.some((value) =>
    typeof value === "string" &&
    foldCrossScriptSearchText(value).includes(foldedQuery)
  );
}
