// Shared test DB guard (Finding C, docs/do-migration/assessment.md).
//
// Tests INSERT and DELETE rows, so they must only ever run against a non-production Neon
// endpoint. This is an ALLOWLIST: a host is accepted only if it matches a known dev endpoint.
// A new production host is therefore refused by default, with no list to keep in sync.

// Neon endpoint IDs of databases that are safe to run tests against.
// Current: the Neon `dev` branch (billowing-block-98253807, eu-west-2), no expiry.
export const DEFAULT_ALLOWED_ENDPOINTS = ['ep-ancient-breeze-zaso9i43'];

// Hosts that must never pass, even if someone adds them to the allowlist by mistake.
const ALWAYS_BLOCKED = ['ep-old-recipe', '.prod.'];

export function parseDbHost(databaseUrl: string): string {
  return databaseUrl.match(/@([^/?]+)[/?]?/)?.[1] ?? 'unknown';
}

// 'ep-abc-123-pooler.c-2.eu-west-2.aws.neon.tech' -> 'ep-abc-123'
export function endpointId(host: string): string {
  return host.split('.')[0].replace(/-pooler$/, '');
}

export function allowedEndpoints(extra: string | undefined = process.env.TEST_DB_ALLOWED_ENDPOINTS): string[] {
  const fromEnv = (extra ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ALLOWED_ENDPOINTS, ...fromEnv];
}

// Throws if DATABASE_URL is set to anything other than an allowlisted test endpoint.
// An unset DATABASE_URL is fine: DB tests skip themselves in that case.
export function assertTestDbHost(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  allowed: string[] = allowedEndpoints(),
): void {
  if (!databaseUrl) return;
  const host = parseDbHost(databaseUrl);
  const blocked = ALWAYS_BLOCKED.find((b) => host.includes(b));
  if (blocked) {
    throw new Error(`TEST DB GUARD ABORT: DATABASE_URL host ${host} is blocked (matches "${blocked}"). Tests must run on dev.`);
  }
  if (!allowed.includes(endpointId(host))) {
    throw new Error(
      `TEST DB GUARD ABORT: DATABASE_URL host ${host} is not an allowlisted test database. ` +
      `Allowed endpoints: ${allowed.join(', ')}. To add another dev/throwaway branch, set ` +
      `TEST_DB_ALLOWED_ENDPOINTS=ep-xxxx (comma separated).`,
    );
  }
}
