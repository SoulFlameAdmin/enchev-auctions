export const UNICODE_NORMALIZATION_MODEL_VERSION = 1 as const;
export const UNICODE_NORMALIZATION_FORM = "NFC" as const;

export type UnicodeNormalizationResult =
  | Readonly<{
      ok: true;
      value: string;
      changed: boolean;
      form: typeof UNICODE_NORMALIZATION_FORM;
    }>
  | Readonly<{
      ok: false;
      errors: readonly string[];
      form: typeof UNICODE_NORMALIZATION_FORM;
    }>;

function hasUnpairedSurrogate(input: string): boolean {
  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }

  return false;
}

export function normalizeUnicodeText(
  input: unknown
): UnicodeNormalizationResult {
  if (typeof input !== "string") {
    return {
      ok: false,
      errors: ["input must be a string"],
      form: UNICODE_NORMALIZATION_FORM
    };
  }

  if (hasUnpairedSurrogate(input)) {
    return {
      ok: false,
      errors: ["input must contain only well-formed Unicode scalar sequences"],
      form: UNICODE_NORMALIZATION_FORM
    };
  }

  const value = input.normalize(UNICODE_NORMALIZATION_FORM);

  return {
    ok: true,
    value,
    changed: value !== input,
    form: UNICODE_NORMALIZATION_FORM
  };
}

export function isUnicodeTextNormalized(input: unknown): boolean {
  const result = normalizeUnicodeText(input);
  return result.ok && result.value === input;
}
