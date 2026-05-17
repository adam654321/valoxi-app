/**
 * scripts/check-resend-contact.ts
 * Dev-only throwaway: look up a contact in Resend marketing and print its state.
 *
 * Usage:
 *   npx tsx scripts/check-resend-contact.ts <email>
 *
 * Reads RESEND_API_KEY_MARKETING from the environment (same key used by
 * server/lib/resend-marketing.ts). Contacts live in the segments-based
 * audience; RESEND_SEGMENT_ALL_USERS is the base segment every contact
 * is added to on create.
 */

import { Resend } from 'resend';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Usage: npx tsx scripts/check-resend-contact.ts <email>');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY_MARKETING;
if (!apiKey) {
  console.error('RESEND_API_KEY_MARKETING is not set');
  process.exit(1);
}

const allUsersSegment = process.env.RESEND_SEGMENT_ALL_USERS ?? '(not set)';

const resend = new Resend(apiKey);

const { data, error } = await resend.contacts.get({ email });

if (error) {
  if (error.name === 'not_found' || (error as any).statusCode === 404) {
    console.log(`NOT FOUND: no Resend contact for <${email}>`);
  } else {
    console.error(`ERROR: ${error.name} — ${error.message}`);
    process.exit(1);
  }
} else if (!data) {
  console.log(`NOT FOUND: no Resend contact for <${email}>`);
} else {
  console.log(`email       : ${data.email}`);
  console.log(`unsubscribed: ${data.unsubscribed}`);
  console.log(`audience    : RESEND_SEGMENT_ALL_USERS=${allUsersSegment}`);
  console.log(`contact id  : ${data.id}`);
  console.log(`first_name  : ${data.first_name ?? '(null)'}`);
  console.log(`last_name   : ${data.last_name ?? '(null)'}`);
  console.log(`created_at  : ${data.created_at}`);
}
