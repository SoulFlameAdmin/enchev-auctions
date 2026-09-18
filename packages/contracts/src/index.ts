/**
 * Public boundary marker for shared Enchev interface contracts.
 *
 * Task 02.06 establishes the package boundary only. Concrete API, realtime,
 * worker, and provider contracts are introduced by their dedicated frozen
 * implementation tasks rather than guessed here.
 */
export const CONTRACTS_PACKAGE_NAME = "@enchev/contracts" as const;

export type ContractsPackageBoundary = Readonly<{
  package: typeof CONTRACTS_PACKAGE_NAME;
  transportNeutral: true;
}>;
