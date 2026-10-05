import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';

const issuer = 'https://token.actions.githubusercontent.com';
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
const repository = 'SoulFlameAdmin/enchev-auctions';
const workflowRef = `${repository}/.github/workflows/verify-enchev-web.yml@refs/heads/main`;
const table = 'enchev_plan_state';
const taskIdPattern = /^([0-9]{2}\.[0-9]{2}|GAP-[0-9]{3,})$/;
const commitPattern = /^[a-f0-9]{40}$/;

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function database(query: string, init: RequestInit = {}) {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!key || !url) throw new Error('Supabase runtime configuration unavailable');
  return fetch(`${url}/rest/v1/${table}${query}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function readState() {
  const response = await database('?select=task_id,status,evidence,blocker,updated_at,source_commit,source_run_id,source_workflow&order=task_id.asc');
  if (!response.ok) throw new Error('Plan state store unavailable');
  return await response.json();
}

function authorizedWorkflow(claims: Record<string, unknown>) {
  return claims.repository_id === '1373693893' &&
    claims.repository_owner_id === '175710990' &&
    claims.repository === repository &&
    claims.ref === 'refs/heads/main' &&
    claims.event_name === 'push' &&
    claims.workflow_ref === workflowRef &&
    commitPattern.test(String(claims.sha || '')) &&
    /^\d+$/.test(String(claims.run_id || ''));
}

async function streamState() {
  try {
    const rows = await readState();
    const payload = JSON.stringify({ rows, checkedAt: new Date().toISOString() });
    return new Response(`retry: 30000\nevent: state\ndata: ${payload}\n\n`, {
      headers: {
        ...baseHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    });
  } catch {
    return new Response('retry: 30000\nevent: error\ndata: {"error":"state unavailable"}\n\n', {
      status: 503,
      headers: {
        ...baseHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    });
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders });

    if (req.method === 'GET') {
      const url = new URL(req.url);
      if (url.searchParams.get('stream') === '1') return await streamState();
      return json({ rows: await readState(), checkedAt: new Date().toISOString() });
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const bearer = req.headers.get('Authorization');
    if (!bearer?.startsWith('Bearer ')) return json({ error: 'GitHub OIDC required' }, 401);

    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(bearer.slice(7), jwks, {
        issuer,
        audience: 'enchev-plan-state',
        algorithms: ['RS256'],
        maxTokenAge: '10m',
        clockTolerance: 5,
      }) as { payload: Record<string, unknown> });
    } catch {
      return json({ error: 'Invalid GitHub identity' }, 401);
    }

    if (!authorizedWorkflow(claims)) return json({ error: 'Workflow not authorized' }, 403);

    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength > 65536) return json({ error: 'Payload too large' }, 413);
    const raw = await req.text();
    if (raw.length > 65536) return json({ error: 'Payload too large' }, 413);

    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const rows = Array.isArray((body as { rows?: unknown }).rows) ? (body as { rows: unknown[] }).rows : null;
    if (!rows || rows.length === 0 || rows.length > 1200) return json({ error: 'Invalid rows' }, 400);

    const commit = String(claims.sha);
    const runId = String(claims.run_id);
    const now = new Date().toISOString();
    const normalized = [] as Record<string, unknown>[];

    for (const rawRow of rows) {
      if (!rawRow || typeof rawRow !== 'object') return json({ error: 'Invalid row' }, 400);
      const row = rawRow as Record<string, unknown>;
      const taskId = String(row.taskId || '');
      const status = String(row.status || '');
      const evidence = row.evidence == null ? null : String(row.evidence);
      const blocker = row.blocker == null ? null : String(row.blocker);
      if (!taskIdPattern.test(taskId) || !['green', 'yellow', 'red'].includes(status)) return json({ error: 'Invalid row' }, 400);
      if (evidence && evidence.length > 4000) return json({ error: 'Evidence too long' }, 400);
      if (blocker && blocker.length > 2000) return json({ error: 'Blocker too long' }, 400);
      if (status === 'green' && !evidence?.trim()) return json({ error: 'GREEN requires evidence' }, 400);
      normalized.push({
        task_id: taskId,
        status,
        evidence,
        blocker,
        updated_at: now,
        source_commit: commit,
        source_run_id: runId,
        source_workflow: 'verify-enchev-web.yml',
      });
    }

    const response = await database('?on_conflict=task_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(normalized),
    });
    if (!response.ok) return json({ error: 'Plan state write failed' }, 503);
    return json({ accepted: true, count: normalized.length, commit, runId }, 202);
  } catch {
    return json({ error: 'Request could not be processed' }, 500);
  }
});
