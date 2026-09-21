import {
  assertContractResponse,
  isComponentHealthResponse,
  type HealthComponent,
  type HealthStatus,
} from "@enchev/contracts";

export function healthResponse(
  component: HealthComponent,
  ready: boolean,
  status: HealthStatus,
) {
  const body = assertContractResponse(
    "ComponentHealth",
    {
      ok: ready,
      component,
      ready,
      status,
      schemaVersion: 1 as const,
      valuesExposed: false as const,
    },
    isComponentHealthResponse,
  );

  return Response.json(body, {
    status: ready ? 200 : 503,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex",
    },
  });
}
