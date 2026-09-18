/**
 * Public boundary marker for external provider adapters.
 *
 * Task 02.08 establishes only the provider package boundary. Concrete SDK
 * clients, credentials, and integration behavior are introduced by their
 * dedicated frozen implementation tasks.
 */
export const PROVIDERS_PACKAGE_NAME = "@enchev/providers" as const;

export type ProvidersPackageBoundary = Readonly<{
  package: typeof PROVIDERS_PACKAGE_NAME;
  credentialFree: true;
  concreteProviderClients: false;
}>;
