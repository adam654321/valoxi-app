#!/usr/bin/env tsx
/**
 * Send a Valoxi-branded email to an arbitrary list of recipients (not necessarily users) via Resend.
 * Runs from Adam's machine. Uses the same template as the app (server/services/email-template.ts).
 * Does not touch any database.
 *
 * Inputs, in a campaign folder OUTSIDE the repo (e.g. Documents\Valoxi Sends\2026-11-25 example\):
 *   recipients.csv   header row required; an `email` column, optional `first_name` column.
 *   message.md       front matter then a Markdown body. {{first_name}} is replaced (falls back to "there").
 *                    ---
 *                    subject: Your subject line
 *                    heading: Big heading in the email
 *                    preheader: Inbox preview text (optional)
 *                    eyebrow: SMALL ORANGE LABEL (optional)
 *                    cta_label: Book a demo (optional, with cta_url)
 *                    cta_url: https://valoxi.ai/...
 *                    ---
 *                    Hi {{first_name}},
 *
 *                    Body in **Markdown**.
 *
 * Steps (always in this order):
 *   npx tsx scripts/send-branded-list.ts --dir "<folder>" --preview            writes preview.html, sends nothing
 *   npx tsx scripts/send-branded-list.ts --dir "<folder>" --test you@valoxi.ai one email to you, subject prefixed [TEST]
 *   npx tsx scripts/send-branded-list.ts --dir "<folder>" --send --confirm=N   N must equal the recipient count shown
 *
 * Every send is logged to <folder>\send-log.csv. Re-running --send skips addresses already logged as sent,
 * so a partial failure can be resumed safely. One email per recipient (no CC/BCC exposure).
 *
 * Suppression: suppressed.csv in the PARENT of the campaign folder (column "email", optional "reason,date")
 * lists everyone who unsubscribed, bounced or complained. It applies to every campaign folder beside it.
 * Suppressed addresses are never sent to, by --send or --test. --test takes an optional --name for the greeting.
 *
 * Key: RESEND_API_KEY_MARKETING from .env.do-prod by default (news.valoxi.ai, keeps the transactional
 * domain's reputation separate). --transactional uses RESEND_API_KEY instead. The key is never printed.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Resend } from 'resend';
import { marked } from 'marked';
import { renderBrandedEmail } from '../server/services/email-template';

const DELAY_MS = 600; // Resend default limit is 2 requests/second
const REPLY_TO = 'hello@valoxi.ai';
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[A-Za-z]{2,}$/;

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const eq = argv.find((a) => a.startsWith(`--${n}=`));
  if (eq) return eq.slice(n.length + 3);
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const die = (m: string): never => { console.error(m); process.exit(1); };

const dir = opt('dir') ?? die('Need --dir "<campaign folder>"');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (path.resolve(dir).toLowerCase().startsWith(repoRoot.toLowerCase())) die('Keep the campaign folder outside the repo (recipient lists are personal data).');

// ---------- message ----------
const raw = fs.readFileSync(path.join(dir, 'message.md'), 'utf8').replace(/^﻿/, '');
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/) ?? die('message.md must start with a --- front matter block ---');
const meta: Record<string, string> = {};
for (const line of fm[1].split(/\r?\n/)) {
  const m = line.match(/^\s*([a-z_]+)\s*:\s*(.*)$/);
  if (m) meta[m[1]] = m[2].trim();
}
const body = fm[2].trim();
if (!meta.subject || !meta.heading) die('message.md front matter needs subject and heading');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const personalise = (s: string, first: string) => s.replace(/\{\{\s*first_name\s*\}\}/gi, first);

function render(first: string) {
  const name = esc(first || 'there');
  const html = renderBrandedEmail({
    preheader: meta.preheader ? esc(personalise(meta.preheader, first || 'there')) : undefined,
    eyebrow: meta.eyebrow ? esc(meta.eyebrow) : undefined,
    heading: esc(personalise(meta.heading, first || 'there')),
    blocks: [
      { type: 'raw_html', html: marked.parse(personalise(body, name), { async: false }) as string },
      ...(meta.cta_label && meta.cta_url ? [{ type: 'cta' as const, cta: { label: esc(meta.cta_label), href: esc(meta.cta_url) } }] : []),
    ],
    footerLine: `You are receiving this email from Valoxi. To stop receiving these, reply with "unsubscribe".`,
  });
  const text = `${personalise(body, first || 'there')}\n${meta.cta_url ? `\n${meta.cta_label ?? 'Link'}: ${meta.cta_url}\n` : ''}\n--\nThe Valoxi Team\nhello@valoxi.ai\nReply "unsubscribe" to stop receiving these.`;
  return { html, text, subject: personalise(meta.subject, first || 'there') };
}

// ---------- recipients ----------
function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out.map((s) => s.trim());
}
const suppressPath = path.join(path.dirname(path.resolve(dir)), 'suppressed.csv');
function loadSuppressed(): Set<string> {
  const set = new Set<string>();
  if (!fs.existsSync(suppressPath)) return set;
  for (const l of fs.readFileSync(suppressPath, 'utf8').split(/\r?\n/)) {
    const e = (parseCsvLine(l)[0] ?? '').replace(/^﻿/, '').toLowerCase();
    if (EMAIL_RE.test(e)) set.add(e);
  }
  return set;
}
function loadRecipients() {
  const lines = fs.readFileSync(path.join(dir, 'recipients.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const ei = header.indexOf('email'); const fi = header.indexOf('first_name');
  if (ei < 0) die('recipients.csv needs a header row with an "email" column');
  const seen = new Set<string>(); const good: { email: string; first: string }[] = []; const bad: string[] = []; let dupes = 0;
  const suppressedSet = loadSuppressed(); let suppressed = 0;
  for (const l of lines.slice(1)) {
    const cells = parseCsvLine(l); const email = (cells[ei] ?? '').toLowerCase();
    if (!EMAIL_RE.test(email)) { bad.push(`line: ${l.slice(0, 60)}`); continue; }
    if (seen.has(email)) { dupes++; continue; }
    seen.add(email);
    if (suppressedSet.has(email)) { suppressed++; continue; }
    good.push({ email, first: fi >= 0 ? (cells[fi] ?? '').split(' ')[0] : '' });
  }
  return { good, bad, dupes, suppressed };
}

// ---------- key ----------
function loadKey() {
  const name = flag('transactional') ? 'RESEND_API_KEY' : 'RESEND_API_KEY_MARKETING';
  const envText = fs.readFileSync(path.join(repoRoot, '.env.do-prod'), 'utf8');
  const get = (k: string) => envText.match(new RegExp(`^${k}=["']?([^"'\\r\\n]*)`, 'm'))?.[1] ?? '';
  const key = get(name) || die(`${name} is not set in .env.do-prod`);
  const fromAddr = flag('transactional') ? 'hello@valoxi.ai' : (get('RESEND_MARKETING_FROM_ADDRESS') || 'hello@news.valoxi.ai');
  const from = opt('from') ?? `Valoxi <${fromAddr.replace(/^.*<|>.*$/g, '')}>`;
  return { key, from, name };
}

async function main() {
  if (flag('preview')) {
    const r = render('Alex');
    const out = path.join(dir, 'preview.html');
    fs.writeFileSync(out, r.html);
    const { good, bad, dupes, suppressed } = loadRecipients();
    console.log(`Subject: ${r.subject}\nPreview written (as "Alex"): ${out}\nRecipients: ${good.length} valid, ${dupes} duplicates removed, ${bad.length} invalid, ${suppressed} suppressed`);
    for (const b of bad.slice(0, 20)) console.log(`  invalid ${b}`);
    return;
  }

  const { key, from, name } = loadKey();
  const resend = new Resend(key);
  const headers = { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` };
  // Campaign tag = folder name, so opens and clicks can be filtered per campaign in Resend.
  const tags = [{ name: 'campaign', value: path.basename(path.resolve(dir)).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 256) }];

  const testTo = opt('test');
  if (testTo) {
    if (!EMAIL_RE.test(testTo)) die('--test needs an email address');
    if (loadSuppressed().has(testTo.toLowerCase())) die(`${testTo} is in suppressed.csv. Not sending.`);
    const r = render(opt('name') ?? 'Alex');
    const { data, error } = await resend.emails.send({ from, to: testTo, replyTo: REPLY_TO, subject: `[TEST] ${r.subject}`, html: r.html, text: r.text, headers, tags });
    if (error) die(`Test send failed: ${error.message}`);
    console.log(`Test sent to ${testTo} from ${from} (${name}), id ${data?.id}`);
    return;
  }

  if (!flag('send')) die('Choose one of --preview, --test you@example.com, or --send --confirm=N');
  const { good, bad, dupes, suppressed } = loadRecipients();
  const logPath = path.join(dir, 'send-log.csv');
  const already = new Set<string>();
  if (fs.existsSync(logPath)) for (const l of fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(1)) { const c = l.split(','); if (c[2] === 'sent') already.add(c[1]); }
  else fs.writeFileSync(logPath, 'time,email,status,detail\n');
  const todo = good.filter((g) => !already.has(g.email));

  console.log(`From: ${from} (${name})\nRecipients: ${good.length} valid (${dupes} duplicates, ${bad.length} invalid skipped, ${suppressed} suppressed), ${already.size} already sent, ${todo.length} to send now`);
  if (Number(opt('confirm')) !== todo.length) die(`Not sending. Re-run with --confirm=${todo.length} to send to these ${todo.length} recipients.`);

  let ok = 0, fail = 0;
  for (const [i, r] of todo.entries()) {
    const m = render(r.first);
    const { data, error } = await resend.emails.send({ from, to: r.email, replyTo: REPLY_TO, subject: m.subject, html: m.html, text: m.text, headers, tags });
    const detail = error ? error.message.replace(/[\r\n,]/g, ' ') : data?.id ?? '';
    fs.appendFileSync(logPath, `${new Date().toISOString()},${r.email},${error ? 'failed' : 'sent'},${detail}\n`);
    error ? fail++ : ok++;
    process.stdout.write(`\r${i + 1}/${todo.length} sent ${ok} failed ${fail}`);
    await new Promise((res) => setTimeout(res, DELAY_MS));
  }
  console.log(`\nDone. Sent ${ok}, failed ${fail}. Log: ${logPath}${fail ? '  (re-run the same --send command to retry failures)' : ''}`);
}

main().catch((e) => die(String(e?.message ?? e)));
