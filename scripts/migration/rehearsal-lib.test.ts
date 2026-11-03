import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs helper without types
import * as lib from './rehearsal-lib.mjs';

describe('rehearsal-lib', () => {
  it('refuses the old prod host and an unparseable url', () => {
    expect(() => lib.assertNotOldProd('postgresql://u:p@ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech/db')).toThrow(/old prod/);
    expect(() => lib.assertNotOldProd('')).toThrow(/ABORT/);
    expect(lib.assertNotOldProd('postgresql://u:p@ep-new-1.c-2.eu-west-2.aws.neon.tech/db')).toContain('ep-new-1');
  });

  it('classifies key modes', () => {
    expect(lib.keyMode('sk_live_x', ['sk_live_'], ['sk_test_'])).toBe('live');
    expect(lib.keyMode('sk_test_x', ['sk_live_'], ['sk_test_'])).toBe('test');
    expect(lib.keyMode('weird', ['sk_live_'], ['sk_test_'])).toBe('unknown');
    expect(lib.keyMode(undefined, ['sk_live_'], ['sk_test_'])).toBe('missing');
  });

  it('parses args', () => {
    expect(lib.parseArgs(['--sample', '5', '--dry-run'])).toMatchObject({ sample: 5, dryRun: true, all: false });
    expect(lib.parseArgs(['--all', '--allow-test'])).toMatchObject({ all: true, allowTest: true });
  });

  it('samples without replacement', () => {
    const out = lib.sample([1, 2, 3, 4, 5], 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });

  it('compares subscriptions', () => {
    const db = { status: 'active', stripe_customer_id: 'cus_1', cancel_at_period_end: false };
    expect(lib.compareSubscription(db, { status: 'active', customer: 'cus_1', cancel_at_period_end: false })).toEqual([]);
    expect(lib.compareSubscription(db, { status: 'canceled', customer: 'cus_1', cancel_at_period_end: false })[0]).toMatch(/status db=active stripe=canceled/);
    expect(lib.compareSubscription(db, { status: 'active', customer: { id: 'cus_2' }, cancel_at_period_end: false })).toContain('customer id differs');
    expect(lib.compareSubscription(db, { status: 'active', customer: 'cus_1', cancel_at_period_end: true })[0]).toMatch(/cancel_at_period_end/);
    expect(lib.compareSubscription({ ...db, status: 'incomplete' }, { status: 'incomplete_expired', customer: 'cus_1', cancel_at_period_end: false })).toEqual([]);
    expect(lib.compareSubscription({ ...db, status: 'admin_comped' }, { status: 'active', customer: 'cus_1', cancel_at_period_end: false })[0]).toMatch(/unexpected db status/);
  });

  it('compares clerk users without leaking emails in messages', () => {
    const db = { email: 'A@x.com' };
    const clerk = { primary_email_address_id: 'e1', email_addresses: [{ id: 'e1', email_address: 'a@x.com' }] };
    expect(lib.compareClerkUser(db, clerk)).toEqual([]);
    const diff = lib.compareClerkUser(db, { ...clerk, email_addresses: [{ id: 'e1', email_address: 'b@x.com' }] });
    expect(diff).toEqual(['primary email differs from db']);
    expect(JSON.stringify(diff)).not.toMatch(/@/);
    expect(lib.compareClerkUser(db, { ...clerk, banned: true, locked: true })).toEqual(['clerk user banned', 'clerk user locked']);
    expect(lib.compareClerkUser(db, { primary_email_address_id: 'x', email_addresses: [] })).toEqual(['clerk user has no primary email']);
  });
});
