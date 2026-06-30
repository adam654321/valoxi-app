import pg from 'pg';
const { Pool } = pg;

// READ-ONLY script — SELECT + reporting only.
// No INSERT/UPDATE/DELETE/ALTER/DDL. No recalculate(). No .update().

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function ts(d: Date | null | undefined): string {
  if (!d) return 'NULL';
  return new Date(d).toISOString();
}
function divider(title: string) {
  console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function checkModel(client: pg.PoolClient, modelId: number) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  MODEL ID: ${modelId}`);
  console.log(`${'═'.repeat(70)}`);

  // ── 0. Resolve targetCompanyId ───────────────────────────────────────────
  const modelRes = await client.query(`
    SELECT dm.id, dm.name, dm.target_company_id, tc.company_name
    FROM deal_models dm
    JOIN target_companies tc ON tc.id = dm.target_company_id
    WHERE dm.id = $1
  `, [modelId]);

  if (modelRes.rows.length === 0) {
    console.log('  NOT FOUND — skipping.');
    return { verdict: 'NOT FOUND', evidence: [] };
  }
  const { target_company_id: tcId, company_name: companyName } = modelRes.rows[0];
  console.log(`  Company: ${companyName}  (target_company_id=${tcId})`);

  // ── 1. current_offers ────────────────────────────────────────────────────
  divider('1. current_offers rows');
  const offersRes = await client.query(`
    SELECT id, status, sent_at, accepted_at, accepted_by,
           delivery_method, deal_document_id, deal_model_id,
           offer_price, enterprise_value, created_at
    FROM current_offers
    WHERE deal_model_id = $1
       OR deal_document_id IN (SELECT id FROM deal_documents WHERE deal_model_id = $1)
    ORDER BY created_at
  `, [modelId]);

  if (offersRes.rows.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of offersRes.rows) {
      console.log(`  offerId=${r.id}  status=${r.status}  delivery_method=${r.delivery_method ?? 'NULL'}`);
      console.log(`    sent_at=${ts(r.sent_at)}  accepted_at=${ts(r.accepted_at)}  accepted_by=${r.accepted_by ?? 'NULL'}`);
      console.log(`    deal_document_id=${r.deal_document_id ?? 'NULL'}  deal_model_id=${r.deal_model_id ?? 'NULL'}`);
      console.log(`    offer_price=${r.offer_price ?? 'NULL'}  enterprise_value=${r.enterprise_value ?? 'NULL'}`);
      console.log(`    created_at=${ts(r.created_at)}`);
    }
  }

  // ── 2. deal_documents ─────────────────────────────────────────────────────
  divider('2. deal_documents');
  const docsRes = await client.query(`
    SELECT id, document_type, status, delivery_method, sent_at, viewed_at,
           responded_at, portal_token_id, created_at,
           (generated_file_url IS NOT NULL) AS has_generated_file
    FROM deal_documents
    WHERE deal_model_id = $1 OR target_company_id = $2
    ORDER BY created_at
  `, [modelId, tcId]);

  if (docsRes.rows.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of docsRes.rows) {
      console.log(`  docId=${r.id}  type=${r.document_type}  status=${r.status}  delivery=${r.delivery_method}`);
      console.log(`    sent_at=${ts(r.sent_at)}  viewed_at=${ts(r.viewed_at)}  responded_at=${ts(r.responded_at)}`);
      console.log(`    portal_token_id=${r.portal_token_id ?? 'NULL'}  has_generated_file=${r.has_generated_file}  created_at=${ts(r.created_at)}`);
    }
  }

  // ── 3. portal_access_tokens ───────────────────────────────────────────────
  divider('3. portal_access_tokens');
  const tokensRes = await client.query(`
    SELECT id, token_purpose, is_active, created_at, last_accessed, access_count,
           array_length(ip_addresses_used, 1) AS distinct_ips,
           expires_at
    FROM portal_access_tokens
    WHERE target_company_id = $1
    ORDER BY created_at
  `, [tcId]);

  if (tokensRes.rows.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of tokensRes.rows) {
      console.log(`  tokenId=${r.id}  purpose=${r.token_purpose}  is_active=${r.is_active}`);
      console.log(`    created_at=${ts(r.created_at)}  expires_at=${ts(r.expires_at)}`);
      console.log(`    last_accessed=${ts(r.last_accessed)}  access_count=${r.access_count}  distinct_ips=${r.distinct_ips ?? 0}`);
    }
  }

  const tokenIds: number[] = tokensRes.rows.map((r: any) => r.id);

  // ── 4. portal_activity_log ───────────────────────────────────────────────
  divider('4. portal_activity_log');
  if (tokenIds.length === 0) {
    console.log('  (no portal tokens — skipping)');
  } else {
    const actRes = await client.query(`
      SELECT COUNT(*)::int AS total_rows,
             array_agg(DISTINCT activity_type) AS activity_types,
             MIN(activity_timestamp) AS first_activity,
             MAX(activity_timestamp) AS last_activity
      FROM portal_activity_log
      WHERE portal_token_id = ANY($1)
    `, [tokenIds]);
    const a = actRes.rows[0];
    console.log(`  Total rows: ${a.total_rows}`);
    if (a.total_rows > 0) {
      console.log(`  Activity types: ${(a.activity_types ?? []).join(', ')}`);
      console.log(`  First: ${ts(a.first_activity)}  Last: ${ts(a.last_activity)}`);
    }
  }

  // ── 5. portal_communications_log ─────────────────────────────────────────
  divider('5. portal_communications_log');
  // Get contacts for this target company
  const contactsRes = await client.query(`
    SELECT id FROM target_contacts WHERE target_company_id = $1`, [tcId]);
  const contactIds: number[] = contactsRes.rows.map((r: any) => r.id);

  if (contactIds.length === 0 && tokenIds.length === 0) {
    console.log('  (no contacts or tokens — skipping)');
  } else {
    // Join via target_contact_id only (portal_token_id not present in live DB)
    const commsRes = await client.query(`
      SELECT id, communication_type, email_status, sent_at, delivered_at, opened_at, clicked_at, created_at
      FROM portal_communications_log
      WHERE $1::int[] IS NOT NULL AND target_contact_id = ANY($1::int[])
      ORDER BY created_at
    `, [contactIds.length > 0 ? contactIds : null]);

    if (commsRes.rows.length === 0) {
      console.log('  (none)');
    } else {
      console.log(`  Total rows: ${commsRes.rows.length}`);
      for (const r of commsRes.rows) {
        console.log(`  commId=${r.id}  type=${r.communication_type}  email_status=${r.email_status ?? 'NULL'}`);
        console.log(`    sent_at=${ts(r.sent_at)}  delivered_at=${ts(r.delivered_at)}  opened_at=${ts(r.opened_at)}  clicked_at=${ts(r.clicked_at)}`);
      }
    }
  }

  // ── 6. chase_up_emails ───────────────────────────────────────────────────
  divider('6. chase_up_emails');
  if (tokenIds.length === 0) {
    console.log('  (no portal tokens — skipping)');
  } else {
    const chaseRes = await client.query(`
      SELECT id, email_sequence_number, email_type, sent_at, delivery_status, created_at
      FROM chase_up_emails
      WHERE portal_token_id = ANY($1)
      ORDER BY created_at
    `, [tokenIds]);
    if (chaseRes.rows.length === 0) {
      console.log('  (none)');
    } else {
      console.log(`  Total rows: ${chaseRes.rows.length}`);
      for (const r of chaseRes.rows) {
        console.log(`  chaseId=${r.id}  seq=${r.email_sequence_number}  type=${r.email_type}  sent_at=${ts(r.sent_at)}  status=${r.delivery_status}`);
      }
    }
  }

  // ── 7. Verdict ───────────────────────────────────────────────────────────
  divider('7. VERDICT');

  // Collect evidence
  const evidence: string[] = [];

  // Portal token access
  for (const t of tokensRes.rows) {
    if (t.last_accessed != null && Number(t.access_count) > 0) {
      evidence.push(`portal_token ${t.id} last_accessed=${ts(t.last_accessed)} access_count=${t.access_count} distinct_ips=${t.distinct_ips ?? 0}`);
    }
  }

  // Document viewed
  for (const d of docsRes.rows) {
    if (d.viewed_at != null) {
      evidence.push(`doc ${d.id} (${d.document_type}) viewed_at=${ts(d.viewed_at)}`);
    }
  }

  // Document responded
  for (const d of docsRes.rows) {
    if (d.responded_at != null) {
      evidence.push(`doc ${d.id} (${d.document_type}) responded_at=${ts(d.responded_at)}`);
    }
  }

  // Portal activity
  if (tokenIds.length > 0) {
    const actCheck = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM portal_activity_log WHERE portal_token_id = ANY($1)`, [tokenIds]);
    if (actCheck.rows[0].cnt > 0) {
      evidence.push(`portal_activity_log has ${actCheck.rows[0].cnt} row(s) for this company's tokens`);
    }
  }

  // Comms opened
  if (contactIds.length > 0) {
    const openedCheck = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM portal_communications_log
      WHERE opened_at IS NOT NULL
        AND target_contact_id = ANY($1::int[])
    `, [contactIds]);
    if (openedCheck.rows[0].cnt > 0) {
      evidence.push(`portal_communications_log: ${openedCheck.rows[0].cnt} email(s) opened by seller`);
    }
  }

  const hasSeen = evidence.length > 0;

  // Transmission evidence (sent but no view confirmation)
  const transmissionEvidence: string[] = [];
  for (const d of docsRes.rows) {
    if (d.sent_at != null) transmissionEvidence.push(`doc ${d.id} sent_at=${ts(d.sent_at)}`);
  }
  for (const r of offersRes.rows) {
    if (r.sent_at != null) transmissionEvidence.push(`current_offer ${r.id} sent_at=${ts(r.sent_at)}`);
  }
  if (contactIds.length > 0) {
    const sentCheck = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM portal_communications_log
      WHERE sent_at IS NOT NULL AND target_contact_id = ANY($1::int[])
    `, [contactIds]);
    if (sentCheck.rows[0].cnt > 0) {
      transmissionEvidence.push(`portal_communications_log: ${sentCheck.rows[0].cnt} email(s) sent`);
    }
  }
  if (tokenIds.length > 0) {
    const chaseCheck = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM chase_up_emails WHERE portal_token_id = ANY($1) AND sent_at IS NOT NULL`, [tokenIds]);
    if (chaseCheck.rows[0].cnt > 0) {
      transmissionEvidence.push(`chase_up_emails: ${chaseCheck.rows[0].cnt} sent`);
    }
  }

  const hasTransmission = transmissionEvidence.length > 0;

  let verdict: string;
  if (hasSeen) {
    verdict = 'TRANSMITTED + SEEN';
    console.log(`  *** VERDICT: TRANSMITTED + SEEN ***`);
    console.log(`  Evidence:`);
    for (const e of evidence) console.log(`    • ${e}`);
  } else if (hasTransmission) {
    verdict = 'TRANSMITTED, NOT CONFIRMED SEEN';
    console.log(`  *** VERDICT: TRANSMITTED, NOT CONFIRMED SEEN ***`);
    console.log(`  Transmission evidence:`);
    for (const e of transmissionEvidence) console.log(`    • ${e}`);
    console.log(`  No view/access/open evidence found.`);
  } else {
    verdict = 'INTERNAL DRAFT, NO TRANSMISSION';
    console.log(`  *** VERDICT: INTERNAL DRAFT, NO TRANSMISSION ***`);
    console.log(`  No sent_at on any document, no comms sent, no portal access.`);
  }

  return { verdict, evidence: hasSeen ? evidence : transmissionEvidence };
}

async function main() {
  const client = await pool.connect();
  try {
    // Identity guard
    const guard = await client.query(
      `SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 3`);
    const names = guard.rows.map((r: any) => r.last_name);
    const env = names.includes('Coxon') ? 'PROD' : names.includes('David') ? 'DEV' : 'UNKNOWN';
    console.log(`\n=== IDENTITY GUARD: [${names.join(', ')}] — branch = ${env} ===`);
    if (env !== 'PROD') {
      console.log('  WARNING: Expected PROD. Proceeding anyway.');
    }

    const modelIds = [42, 65, 70, 96];
    const results: Record<number, { verdict: string; evidence: string[] }> = {};

    for (const mid of modelIds) {
      results[mid] = await checkModel(client, mid);
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`=== SUMMARY: TRANSMISSION STATUS FOR MODELS 42, 65, 70, 96 ===`);
    console.log(`${'═'.repeat(70)}`);

    const focusModels = [65, 70, 96];
    let anySeenByRealSeller = false;

    for (const mid of modelIds) {
      const r = results[mid];
      const label = mid === 42 ? '(REAL/Valoxi, accepted Apr-2026 — for completeness)' :
                    mid === 65 ? '(REAL/Dentiva Health — zero seller responses)' :
                    mid === 70 ? '(REAL/Peters Strategic Capital — zero seller responses)' :
                    '(REAL/Stampe & Partners — zero seller responses)';
      console.log(`\n  Model ${mid} ${label}`);
      console.log(`    Verdict: ${r.verdict}`);
      if (focusModels.includes(mid) && r.verdict === 'TRANSMITTED + SEEN') {
        anySeenByRealSeller = true;
        console.log(`    *** A real seller SAW a figure from this model. ***`);
      }
    }

    console.log(`\n  ─────────────────────────────────────────────────────────`);
    if (!anySeenByRealSeller) {
      console.log(`  *** HEADLINE: NONE of the three focus models (65, 70, 96) reached`);
      console.log(`      "TRANSMITTED + SEEN". No external seller confirmed to have seen`);
      console.log(`      a figure from a since-drifted model basis.`);
    } else {
      console.log(`  *** HEADLINE: ONE OR MORE focus models reached "TRANSMITTED + SEEN".`);
      console.log(`      A real external seller saw a figure from a since-drifted model.`);
      console.log(`      Review the evidence per model above.`);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`=== WRITE-SAFETY CONFIRMATION ===`);
    console.log(`  SELECT + in-memory only. No INSERT/UPDATE/DELETE/ALTER/DDL.`);
    console.log(`  recalculate() and .update() were NOT called.`);
    console.log(`${'═'.repeat(70)}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
