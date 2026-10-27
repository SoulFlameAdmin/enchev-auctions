import "server-only";
import {
  createClosedDemoBoundary,
  type ClosedDemoBoundary,
  type ClosedDemoEnvironment
} from "../../packages/domain/src/closed-demo-isolation";

/**
 * Only approved runtime entrypoint for the MISSION-002 pure demo boundary.
 * Reads process.env on the server, never from request, query, or cookies.
 * No API route, DB writer, payment provider or document issuer is enabled.
 */
export function closedDemoBoundaryFromServer(): ClosedDemoBoundary {
  const env: ClosedDemoEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
    demoProjectId: process.env.ENCHEV_CLOSED_DEMO_PROJECT_ID,
    enabled: process.env.ENCHEV_CLOSED_DEMO_ENABLED,
    namespace: process.env.ENCHEV_CLOSED_DEMO_NAMESPACE,
    paymentMode: process.env.ENCHEV_CLOSED_DEMO_PAYMENT_MODE,
    documentMode: process.env.ENCHEV_CLOSED_DEMO_DOCUMENT_MODE,
    storageMode: process.env.ENCHEV_CLOSED_DEMO_STORAGE_MODE,
    paymentProvider: process.env.ENCHEV_PAYMENT_PROVIDER,
    realPaymentsEnabled: process.env.ENCHEV_REAL_PAYMENTS_ENABLED,
    providerSecretPresent: Boolean(
      process.env.STRIPE_SECRET_KEY ||
      process.env.ENCHEV_PAYMENT_PROVIDER_SECRET ||
      process.env.ENCHEV_PAYMENT_PROVIDER_API_KEY
    ),
    databaseWriteCredentialPresent: Boolean(
      process.env.DATABASE_URL ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.ENCHEV_SUPABASE_SERVICE_ROLE_KEY
    )
  };
  return createClosedDemoBoundary(env);
}
