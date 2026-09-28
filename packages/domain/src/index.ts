/**
 * Boundary marker for the framework-independent Enchev domain package.
 *
 * Business entities and invariants are intentionally introduced by their
 * dedicated frozen implementation tasks. Task 02.05 only establishes the
 * package boundary and a compilable public entrypoint.
 */
export const DOMAIN_PACKAGE_NAME = "@enchev/domain" as const;

export type DomainPackageBoundary = Readonly<{
  package: typeof DOMAIN_PACKAGE_NAME;
  frameworkIndependent: true;
}>;

export * from "./data-lifecycle";
export * from "./buyer-workspace";
export * from "./buyer-auction-workspace";
export * from "./starting-soon-reminders";
export * from "./lot-queue-position";
export * from "./cross-device-workspace-sync";
export * from "./notification-suppression";

export * from "./multi-auction-realtime-consistency";
export * from "./inspection-intelligence";
export * from "./seller-listing-foundation";
export * from "./seller-workflow";
export * from "./live-auction-ux";
