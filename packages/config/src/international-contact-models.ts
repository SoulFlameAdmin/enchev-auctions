import { normalizeUnicodeText } from "./unicode-normalization";

export const INTERNATIONAL_CONTACT_MODELS_VERSION = 1 as const;

export type InternationalName = Readonly<{
  displayName: string;
  nativeScriptName?: string;
  sortName?: string;
}>;

export type InternationalAddress = Readonly<{
  countryCode: string;
  addressLines: readonly string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
  organization?: string;
}>;

export type InternationalPhone = Readonly<{
  rawInput: string;
  e164?: string;
  extension?: string;
}>;

export type ContactValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const EXTENSION_PATTERN = /^\d{1,20}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function normalizeRequiredText(value: unknown, label: string, errors: string[]): string | null {
  const normalized = normalizeUnicodeText(value);
  if (!normalized.ok) {
    errors.push(`${label} must be well-formed Unicode text`);
    return null;
  }
  if (normalized.value.trim().length === 0) {
    errors.push(`${label} must not be blank`);
    return null;
  }
  return normalized.value;
}

function normalizeOptionalText(
  value: unknown,
  label: string,
  errors: string[]
): string | undefined {
  if (value === undefined) return undefined;
  return normalizeRequiredText(value, label, errors) ?? undefined;
}

export function validateInternationalName(
  input: unknown
): ContactValidationResult<InternationalName> {
  if (!isRecord(input)) return { ok: false, errors: ["name must be an object"] };

  const errors: string[] = [];
  if (!hasOnlyKeys(input, ["displayName", "nativeScriptName", "sortName"])) {
    errors.push("name contains unsupported fields");
  }

  const displayName = normalizeRequiredText(input.displayName, "displayName", errors);
  const nativeScriptName = normalizeOptionalText(input.nativeScriptName, "nativeScriptName", errors);
  const sortName = normalizeOptionalText(input.sortName, "sortName", errors);

  if (errors.length > 0 || !displayName) return { ok: false, errors };

  return {
    ok: true,
    value: {
      displayName,
      ...(nativeScriptName === undefined ? {} : { nativeScriptName }),
      ...(sortName === undefined ? {} : { sortName })
    }
  };
}

export function validateInternationalAddress(
  input: unknown
): ContactValidationResult<InternationalAddress> {
  if (!isRecord(input)) return { ok: false, errors: ["address must be an object"] };

  const errors: string[] = [];
  if (
    !hasOnlyKeys(input, [
      "countryCode",
      "addressLines",
      "locality",
      "administrativeArea",
      "postalCode",
      "organization"
    ])
  ) {
    errors.push("address contains unsupported fields");
  }

  const countryCode = input.countryCode;
  if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.push("countryCode must be two uppercase ASCII letters");
  }

  const addressLinesInput = input.addressLines;
  const addressLines: string[] = [];
  if (!Array.isArray(addressLinesInput) || addressLinesInput.length < 1 || addressLinesInput.length > 4) {
    errors.push("addressLines must contain between one and four lines");
  } else {
    for (let index = 0; index < addressLinesInput.length; index += 1) {
      const line = normalizeRequiredText(addressLinesInput[index], `addressLines[${index}]`, errors);
      if (line) addressLines.push(line);
    }
  }

  const locality = normalizeOptionalText(input.locality, "locality", errors);
  const administrativeArea = normalizeOptionalText(
    input.administrativeArea,
    "administrativeArea",
    errors
  );
  const postalCode = normalizeOptionalText(input.postalCode, "postalCode", errors);
  const organization = normalizeOptionalText(input.organization, "organization", errors);

  if (errors.length > 0 || typeof countryCode !== "string") {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      countryCode,
      addressLines,
      ...(locality === undefined ? {} : { locality }),
      ...(administrativeArea === undefined ? {} : { administrativeArea }),
      ...(postalCode === undefined ? {} : { postalCode }),
      ...(organization === undefined ? {} : { organization })
    }
  };
}

export function validateInternationalPhone(
  input: unknown
): ContactValidationResult<InternationalPhone> {
  if (!isRecord(input)) return { ok: false, errors: ["phone must be an object"] };

  const errors: string[] = [];
  if (!hasOnlyKeys(input, ["rawInput", "e164", "extension"])) {
    errors.push("phone contains unsupported fields");
  }

  const rawInput = normalizeRequiredText(input.rawInput, "rawInput", errors);
  const e164 = input.e164;
  if (e164 !== undefined && (typeof e164 !== "string" || !E164_PATTERN.test(e164))) {
    errors.push("e164 must use canonical E.164 form when provided");
  }

  const extension = input.extension;
  if (
    extension !== undefined &&
    (typeof extension !== "string" || !EXTENSION_PATTERN.test(extension))
  ) {
    errors.push("extension must contain 1 to 20 ASCII digits when provided");
  }

  if (errors.length > 0 || !rawInput) return { ok: false, errors };

  return {
    ok: true,
    value: {
      rawInput,
      ...(typeof e164 === "string" ? { e164 } : {}),
      ...(typeof extension === "string" ? { extension } : {})
    }
  };
}
