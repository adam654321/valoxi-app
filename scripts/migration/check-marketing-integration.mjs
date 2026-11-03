// Read-only check of the marketing-site -> app integration, safe to run against prod or staging.
// It never creates a Stripe session: the checkout probe uses a slug that cannot exist.
//
//   node scripts/migration/check-marketing-integration.mjs [APP_BASE] [SITE_ORIGIN]
//   node scripts/migration/check-marketing-integration.mjs https://app.valoxi.ai https://valoxi.ai
//
// Run it before cutover (baseline) and after (6.11). Output must be identical in shape.

const APP = (process.argv[2] || 'https://app.valoxi.ai').replace(/\/+$/, '');
const ORIGIN = process.argv[3] || 'https://valoxi.ai';

let failed = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

async function main() {
  console.log(`app: ${APP}\nsite origin: ${ORIGIN}\n`);

  // 1. Config flag the site reads on load (open access).
  let res = await fetch(`${APP}/api/v2/public/config`, { headers: { Origin: ORIGIN } });
  let body = await res.json().catch(() => ({}));
  ok('GET /public/config returns 200', res.status === 200, `HTTP ${res.status}`);
  ok('config: success true', body.success === true);
  ok('config: openAccessEnabled true', body?.data?.openAccessEnabled === true, JSON.stringify(body?.data ?? {}));
  ok('config: CORS allows the site origin', res.headers.get('access-control-allow-origin') === ORIGIN,
    `ACAO=${res.headers.get('access-control-allow-origin')}`);

  // 2. CORS preflight for the checkout POST (what the browser sends first).
  res = await fetch(`${APP}/api/v2/public/checkout`, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  ok('OPTIONS /public/checkout preflight ok', res.status === 200 || res.status === 204, `HTTP ${res.status}`);
  ok('preflight: allows the site origin', res.headers.get('access-control-allow-origin') === ORIGIN);

  // 3. A foreign origin must be refused.
  res = await fetch(`${APP}/api/v2/public/config`, { headers: { Origin: 'https://evil.example' } });
  ok('foreign origin rejected (403)', res.status === 403, `HTTP ${res.status}`);

  // 4. Checkout route reaches the promo lookup. Slug cannot exist, so no Stripe session is created.
  res = await fetch(`${APP}/api/v2/public/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ planKey: 'CORE', interval: 'month', promoSlug: 'zz-migration-probe-nonexistent' }),
  });
  body = await res.json().catch(() => ({}));
  ok('checkout: unknown slug -> 400 promo_not_found', res.status === 400 && body.error === 'promo_not_found',
    `HTTP ${res.status} ${body.error ?? ''}`);

  // 5. The sign-in page the site links to.
  res = await fetch(`${APP}/sign-in`, { redirect: 'manual' });
  ok('app /sign-in reachable', res.status >= 200 && res.status < 400, `HTTP ${res.status}`);

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
