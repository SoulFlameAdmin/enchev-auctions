/**
 * Public boundary marker for shared Enchev configuration contracts.
 *
 * Task 02.07 establishes the package boundary only. Runtime environment
 * validation remains in the canonical root config/verifier path, and this
 * package must not read secrets or runtime environment variables directly.
 */
export const CONFIG_PACKAGE_NAME = "@enchev/config" as const;

export type ConfigPackageBoundary = Readonly<{
  package: typeof CONFIG_PACKAGE_NAME;
  secretFree: true;
  runtimeEnvReads: false;
}>;

export * from "./country-profile";
export * from "./locale-aware-date";
export * from "./timezone-aware-display";
export * from "./translation-key";
export * from "./country-kyc-profile";
export * from "./country-legal-profile";
export * from "./country-document-profile";
export * from "./market-activation-gate";
export * from "./country-market-bundle";
export * from "./regional-cdn-strategy";
export * from "./unicode-normalization";
export * from "./locale-fallback-chain";
