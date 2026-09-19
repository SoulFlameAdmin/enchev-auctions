import type { CountryProfile } from "./country-profile";

export const COUNTRY_DOCUMENT_PROFILE_MODEL_VERSION = 1 as const;

export type CountryDocumentRequirement = Readonly<{
  key: string;
  subject: string;
  required: boolean;
}>;

export type CountryDocumentProfile = Readonly<{
  countryCode: string;
  revision: number;
  documents: readonly CountryDocumentRequirement[];
}>;

export type CountryDocumentProfileValidationResult =
  | Readonly<{ ok: true; value: CountryDocumentProfile }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const DOCUMENT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const SUBJECT_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;
const PROFILE_KEYS = ["countryCode", "documents", "revision"] as const;
const DOCUMENT_KEYS = ["key", "required", "subject"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value).sort();
  const target = [...expected].sort();
  return actual.length === target.length && actual.every((key, index) => key === target[index]);
}

function documentIdentity(item: CountryDocumentRequirement): string {
  return `${item.subject}:${item.key}`;
}

export function validateCountryDocumentProfile(
  input: unknown,
  countryProfile: CountryProfile
): CountryDocumentProfileValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["profile must be an object"] };
  }

  const errors: string[] = [];
  if (!hasExactKeys(input, PROFILE_KEYS)) {
    errors.push("profile must contain only countryCode, revision, and documents");
  }

  const countryCode = input.countryCode;
  const revision = input.revision;
  const documents = input.documents;

  if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.push("countryCode must be two uppercase ASCII letters");
  } else if (countryCode !== countryProfile.countryCode) {
    errors.push("countryCode must match CountryProfile.countryCode");
  }

  if (!Number.isInteger(revision) || (revision as number) < 1) {
    errors.push("revision must be a positive integer");
  }

  const normalizedDocuments: CountryDocumentRequirement[] = [];
  if (!Array.isArray(documents) || documents.length === 0) {
    errors.push("documents must contain at least one document requirement");
  } else {
    for (const [index, document] of documents.entries()) {
      if (!isRecord(document)) {
        errors.push(`documents[${index}] must be an object`);
        continue;
      }

      if (!hasExactKeys(document, DOCUMENT_KEYS)) {
        errors.push(`documents[${index}] must contain only key, subject, and required`);
      }

      const key = document.key;
      const subject = document.subject;
      const required = document.required;

      if (typeof key !== "string" || !DOCUMENT_KEY_PATTERN.test(key)) {
        errors.push(`documents[${index}].key must be a lowercase dot-separated identifier`);
      }
      if (typeof subject !== "string" || !SUBJECT_PATTERN.test(subject)) {
        errors.push(`documents[${index}].subject must be a lowercase identifier`);
      }
      if (typeof required !== "boolean") {
        errors.push(`documents[${index}].required must be boolean`);
      }

      if (
        typeof key === "string" &&
        DOCUMENT_KEY_PATTERN.test(key) &&
        typeof subject === "string" &&
        SUBJECT_PATTERN.test(subject) &&
        typeof required === "boolean"
      ) {
        normalizedDocuments.push({ key, subject, required });
      }
    }

    const identities = normalizedDocuments.map(documentIdentity);
    if (new Set(identities).size !== identities.length) {
      errors.push("documents must not contain duplicate subject/key pairs");
    }

    const sortedIdentities = [...identities].sort();
    if (JSON.stringify(identities) !== JSON.stringify(sortedIdentities)) {
      errors.push("documents must be sorted by subject and key");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      countryCode: countryCode as string,
      revision: revision as number,
      documents: normalizedDocuments.map((item) => ({ ...item }))
    }
  };
}
