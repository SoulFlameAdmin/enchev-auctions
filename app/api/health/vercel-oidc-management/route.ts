export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "prj_X3TAEQf9oGE79te9NdNlvB6jnhno";
const TEAM_ID = "team_cKaIZfnCMzoiiq80J0MhV0A2";

export async function GET() {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;

  if (!oidcToken) {
    return Response.json(
      {
        ok: false,
        oidcPresent: false,
        managementApiReachable: false,
        managementApiAuthorized: false,
        status: "missing-vercel-oidc-token",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store, max-age=0",
          "x-robots-tag": "noindex",
        },
      },
    );
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${oidcToken}`,
          "content-type": "application/json",
        },
        cache: "no-store",
      },
    );

    return Response.json(
      {
        ok: response.ok,
        oidcPresent: true,
        managementApiReachable: true,
        managementApiAuthorized: response.status >= 200 && response.status < 300,
        managementApiStatus: response.status,
        managementApiStatusText: response.statusText,
        valuesExposed: false,
      },
      {
        status: response.ok ? 200 : 503,
        headers: {
          "cache-control": "no-store, max-age=0",
          "x-robots-tag": "noindex",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        oidcPresent: true,
        managementApiReachable: false,
        managementApiAuthorized: false,
        status: "management-api-request-failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
        valuesExposed: false,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store, max-age=0",
          "x-robots-tag": "noindex",
        },
      },
    );
  }
}
