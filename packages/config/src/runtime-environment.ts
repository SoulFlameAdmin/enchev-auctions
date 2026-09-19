export const RUNTIME_ENVIRONMENT_MODEL_VERSION = 1 as const;

export type RuntimeEnvironmentName = "local" | "staging" | "production";
export type PlatformEnvironmentName = "development" | "preview" | "production";

export type RuntimeEnvironmentResolution =
  | Readonly<{
      ok: true;
      environment: RuntimeEnvironmentName;
      platformEnvironment: PlatformEnvironmentName;
      productionAuthority: boolean;
    }>
  | Readonly<{
      ok: false;
      errors: readonly string[];
    }>;

export function resolveRuntimeEnvironment(
  platformEnvironment: unknown
): RuntimeEnvironmentResolution {
  if (platformEnvironment === "development") {
    return {
      ok: true,
      environment: "local",
      platformEnvironment,
      productionAuthority: false
    };
  }

  if (platformEnvironment === "preview") {
    return {
      ok: true,
      environment: "staging",
      platformEnvironment,
      productionAuthority: false
    };
  }

  if (platformEnvironment === "production") {
    return {
      ok: true,
      environment: "production",
      platformEnvironment,
      productionAuthority: true
    };
  }

  return {
    ok: false,
    errors: ["platformEnvironment must be development, preview, or production"]
  };
}

export function isProductionRuntimeEnvironment(
  platformEnvironment: unknown
): boolean {
  const result = resolveRuntimeEnvironment(platformEnvironment);
  return result.ok && result.productionAuthority;
}
