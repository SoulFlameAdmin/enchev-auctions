export const EXACT_VIN_SEARCH_MODEL_VERSION = 1 as const;

export type VinSearchDocument<T> = Readonly<{
  vin: string;
  value: T;
}>;

export type ExactVinSearchResult<T> = Readonly<{
  normalizedVin: string;
  match: T | null;
}>;

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeExactVin(value: string): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().toUpperCase();
  if (!VIN_PATTERN.test(normalized)) return null;
  return normalized;
}

export function searchExactVin<T>(
  query: string,
  documents: readonly VinSearchDocument<T>[]
): ExactVinSearchResult<T> {
  const normalizedVin = normalizeExactVin(query);
  if (!normalizedVin) {
    return Object.freeze({ normalizedVin: "", match: null });
  }

  let match: T | null = null;
  for (const document of documents) {
    const documentVin = normalizeExactVin(document.vin);
    if (!documentVin) continue;
    if (documentVin !== normalizedVin) continue;
    if (match !== null) throw new Error("EXACT_VIN_SEARCH_DUPLICATE_VIN");
    match = document.value;
  }

  return Object.freeze({ normalizedVin, match });
}
