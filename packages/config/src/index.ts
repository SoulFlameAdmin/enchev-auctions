/**
 * Public boundary marker for shared Enchev configuration contracts.
 *
 * Task 02.07 establishes the package boundary only. Runtime environment
 * validation remains in the canonical root config/verifier path, and this
 * package must not read secrets or process.env directly.
 */
export const CONFIG_PACKAGE_NAME = "@enchev/config" as const;

export type ConfigPackageBoundary = Readonly<{
  package: typeof CONFIG_PACKAGE_NAME;
  secretFree: true;
  runtimeEnvReads: false;
}>;
