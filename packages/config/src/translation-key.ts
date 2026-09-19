/**
 * Locale-neutral translation-key contract.
 *
 * 21.07 establishes stable identifiers only. Message catalogs, locale
 * negotiation, fallback behavior, and completeness policy are separate tasks.
 */
export const TRANSLATION_KEY_MODEL_VERSION = 1 as const;
export const TRANSLATION_KEY_SEPARATOR = "." as const;
export const TRANSLATION_KEY_PATTERN =
  /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){2,}$/;

declare const translationKeyBrand: unique symbol;

export type TranslationKey = string & {
  readonly [translationKeyBrand]: "TranslationKey";
};

export function isTranslationKey(value: string): value is TranslationKey {
  return (
    value.length > 0 &&
    value.length <= 120 &&
    TRANSLATION_KEY_PATTERN.test(value)
  );
}

export function assertTranslationKey(value: string): TranslationKey {
  if (!isTranslationKey(value)) {
    throw new Error(
      "Invalid translation key. Expected namespace.section.name using dot-separated lower-leading identifier segments."
    );
  }

  return value;
}

export function translationKeySegments(
  value: TranslationKey
): readonly string[] {
  return value.split(TRANSLATION_KEY_SEPARATOR);
}
