# Database Restore Procedure

## Prerequisites

- `psql` CLI installed (v14+ recommended)
- `gunzip` or `gzip -d` available
- Access to the Neon database connection string (`DATABASE_URL`)
- Access to `/tmp/backup-*.sql.gz` files on the Replit instance, or a locally downloaded copy

## 1. Locate the backup file

Backups are stored in `/tmp` with the naming pattern `backup-YYYY-MM-DD.sql.gz`. The cron retains the last 7 days.

```bash
ls -lh /tmp/backup-*.sql.gz
```

Pick the file you want to restore from. If you need a file from before the 7-day window, check if Neon branch snapshots are available (see section 6).

## 2. Restore the database

Decompress and pipe directly into `psql`:

```bash
gunzip -c /tmp/backup-2026-03-01.sql.gz | psql "$DATABASE_URL"
```

If the target database already has data and you want a clean restore, drop and recreate first:

```bash
# WARNING: This destroys all existing data in the target database
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c /tmp/backup-2026-03-01.sql.gz | psql "$DATABASE_URL"
```

## 3. Verify the restore

Run spot-check queries to confirm data is present and counts look reasonable:

```bash
psql "$DATABASE_URL" -c "
  SELECT 'users' AS tbl, COUNT(*) FROM users
  UNION ALL SELECT 'user_companies', COUNT(*) FROM user_companies
  UNION ALL SELECT 'target_companies', COUNT(*) FROM target_companies
  UNION ALL SELECT 'documents', COUNT(*) FROM documents
  UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions;
"
```

Compare counts against your most recent known-good numbers or admin dashboard overview.

## 4. If the restore fails

- Check `psql` error output for constraint violations or encoding issues.
- Try restoring to a fresh Neon branch instead (see section 6) to isolate the problem.
- If the `.sql.gz` file is corrupt, try a different day's backup.
- If all backups are corrupt, contact Neon support about point-in-time recovery.

## 5. Post-restore steps

- Restart the application so connection pools pick up any schema changes.
- Verify the app loads and key flows work (login, view targets, view documents).
- Check the admin overview dashboard for expected metrics.

## 6. Neon-specific: branch-based recovery

Neon supports instant branching from any point in time within the retention window. This is often faster and safer than a file-based restore.

1. Open the Neon console → select your project.
2. Go to **Branches** → **Create branch**.
3. Choose "From parent at specific point in time" and pick the timestamp.
4. Copy the new branch's connection string.
5. Update `DATABASE_URL` in your environment to point to the new branch.
6. Restart the application.

This avoids destructive operations on the main branch entirely.
