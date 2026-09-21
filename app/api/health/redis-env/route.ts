import { assertContractResponse, isRedisEnvironmentHealthResponse } from "@enchev/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIS_RELATED_SUFFIXES = [
  "REDIS_URL",
  "VALKEY_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

function isCandidateKey(key: string) {
  return REDIS_RELATED_SUFFIXES.some(
    (suffix) => key === suffix || key.endsWith(`_${suffix}`),
  );
}

export async function GET() {
  const candidateKeys = Object.keys(process.env)
    .filter(isCandidateKey)
    .sort();

  const body = assertContractResponse(
    "RedisEnvironmentHealth",
    {
      ok: true,
      candidateKeyCount: candidateKeys.length,
      candidateKeys,
      valuesExposed: false,
    },
    isRedisEnvironmentHealthResponse,
  );

  return new Response(
    JSON.stringify(body),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0",
        "x-robots-tag": "noindex",
      },
    },
  );
}
