export type HealthComponent = "web" | "api" | "realtime" | "worker";
export type HealthStatus = "healthy" | "service-pending";

export function healthResponse(
  component: HealthComponent,
  ready: boolean,
  status: HealthStatus,
) {
  return Response.json(
    {
      ok: ready,
      component,
      ready,
      status,
      schemaVersion: 1,
      valuesExposed: false,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "cache-control": "no-store, max-age=0",
        "x-robots-tag": "noindex",
      },
    },
  );
}
