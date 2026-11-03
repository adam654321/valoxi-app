import { describe, it, expect, vi } from 'vitest';
import { assertTestDbHost, endpointId, parseDbHost } from './db-host-guard';

const url = (host: string) => `postgresql://u:p@${host}/db?sslmode=require`;
const ALLOWED = ['ep-dev-111'];

describe('db-host-guard', () => {
  it('parses host and endpoint id, ignoring -pooler', () => {
    expect(parseDbHost(url('ep-dev-111-pooler.c-2.eu-west-2.aws.neon.tech'))).toBe('ep-dev-111-pooler.c-2.eu-west-2.aws.neon.tech');
    expect(endpointId('ep-dev-111-pooler.c-2.eu-west-2.aws.neon.tech')).toBe('ep-dev-111');
  });

  it('allows an unset DATABASE_URL (DB tests skip themselves)', () => {
    // undefined would fall back to the real process.env default, so stub it empty.
    vi.stubEnv('DATABASE_URL', '');
    try {
      expect(() => assertTestDbHost(undefined, ALLOWED)).not.toThrow();
      expect(() => assertTestDbHost('', ALLOWED)).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('allows an allowlisted endpoint, direct or pooled', () => {
    expect(() => assertTestDbHost(url('ep-dev-111.c-2.eu-west-2.aws.neon.tech'), ALLOWED)).not.toThrow();
    expect(() => assertTestDbHost(url('ep-dev-111-pooler.c-2.eu-west-2.aws.neon.tech'), ALLOWED)).not.toThrow();
  });

  it('refuses an unknown host, such as the new production endpoint', () => {
    expect(() => assertTestDbHost(url('ep-new-prod-999.c-2.eu-west-2.aws.neon.tech'), ALLOWED)).toThrow(/not an allowlisted/);
  });

  it('refuses the old prod even if it is allowlisted', () => {
    expect(() =>
      assertTestDbHost(url('ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech'), ['ep-old-recipe-an7e4afw']),
    ).toThrow(/blocked/);
  });

  it('refuses an unparseable URL', () => {
    expect(() => assertTestDbHost('not-a-url', ALLOWED)).toThrow(/not an allowlisted/);
  });
});
