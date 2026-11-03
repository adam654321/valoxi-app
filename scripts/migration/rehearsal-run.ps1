# Rehearsal dump and restore, one step at a time, for Windows PowerShell. No Docker needed.
# Uses the local PostgreSQL 18 client tools. Never prints a connection string (host only).
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File scripts\migration\rehearsal-run.ps1 -Step Check
#
# Steps, in order:
#   Check           connectivity probe to source and target (select version only)
#   CountsBefore    exact table counts on the SOURCE (old prod, read-only)  -> rehearsal2\source-before.txt
#   Dump            pg_dump of the SOURCE (read-only)                       -> rehearsal2\valoxi-rehearsal.dump
#   CountsAfter     counts on the SOURCE again                              -> rehearsal2\source-after.txt
#   CompareDrift    source-before vs source-after (small drift on live tables is expected)
#   Restore         pg_restore into the rehearsal TARGET only (guarded)
#   RestoredCounts  counts on the TARGET                                    -> rehearsal2\restored.txt
#   CompareRestored source-after vs restored (must match, apart from the drift above)
#   SourceStructure indexes, constraints, views, enums on the SOURCE      -> rehearsal2\source-structure.txt
#   RestoredStructure same checks on the TARGET                            -> rehearsal2\restored-structure.txt
#   CompareStructure  source vs restored structure (must match exactly)
#
# Source is read from .env.prod (SRC_URL). Target is read from .env.rehearsal (DST_URL).
# Add -DryRun to print what a step would do without doing it.

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Check', 'CountsBefore', 'Dump', 'CountsAfter', 'CompareDrift', 'Restore', 'RestoredCounts', 'CompareRestored', 'SourceStructure', 'RestoredStructure', 'CompareStructure')]
  [string]$Step,
  [string]$SrcEnv = '.env.prod',
  [string]$DstEnv = '.env.rehearsal',
  [string]$OutDir = 'rehearsal2',
  [string]$ExpectedDstHost = 'ep-calm-smoke-za9wqm88',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
$repo = (Get-Location).Path

$bin = 'C:\Program Files\PostgreSQL\18\bin'
$psql = Join-Path $bin 'psql.exe'
$pgDump = Join-Path $bin 'pg_dump.exe'
$pgRestore = Join-Path $bin 'pg_restore.exe'
foreach ($t in @($psql, $pgDump, $pgRestore)) {
  if (-not (Test-Path $t)) { throw "Missing $t. Install the PostgreSQL 18 client tools." }
}

# A hung connection fails after 20 seconds instead of waiting forever.
$env:PGCONNECT_TIMEOUT = '20'

function Get-EnvValue([string]$file, [string]$key) {
  if (-not (Test-Path $file)) { throw "Missing file $file" }
  $line = Get-Content $file | Where-Object { $_ -like "$key=*" } | Select-Object -First 1
  if (-not $line) { throw "No $key= line in $file" }
  return ($line.Substring($key.Length + 1)).Trim().Trim('"').Trim("'")
}

function Get-DbHost([string]$url) {
  if ($url -match '@([^/?]+)') { return $Matches[1] }
  return 'unknown'
}

function Assert-Ok([string]$what) {
  if ($LASTEXITCODE -ne 0) { throw "$what failed with exit code $LASTEXITCODE" }
}

function Show-Elapsed($sw) {
  Write-Host ("ELAPSED {0:mm\:ss}  ({1:N0} seconds)" -f $sw.Elapsed, $sw.Elapsed.TotalSeconds)
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$dumpFile = Join-Path $OutDir 'valoxi-rehearsal.dump'
$before = Join-Path $OutDir 'source-before.txt'
$after = Join-Path $OutDir 'source-after.txt'
$restored = Join-Path $OutDir 'restored.txt'
$srcStruct = Join-Path $OutDir 'source-structure.txt'
$dstStruct = Join-Path $OutDir 'restored-structure.txt'
$structSql = Join-Path $repo 'scripts\migration\structure-checks.sql'
$countsSql = Join-Path $repo 'scripts\migration\table-counts.sql'
$spotSql = Join-Path $repo 'scripts\migration\spot-checks.sql'

function Get-Src {
  $u = Get-EnvValue $SrcEnv 'SRC_URL'
  $h = Get-DbHost $u
  if ($h -eq 'unknown') { throw 'Could not read the source host' }
  Write-Host "source host: $h"
  return $u
}

function Get-Dst {
  $u = Get-EnvValue $DstEnv 'DST_URL'
  $h = Get-DbHost $u
  Write-Host "target host: $h"
  if ($h -eq 'unknown') { throw 'Could not read the target host' }
  if ($h -like '*ep-old-recipe*') { throw 'ABORT: target is the OLD PROD host' }
  if ($h -like '*ep-ancient-breeze*') { throw 'ABORT: target is the Neon dev branch (staging uses it)' }
  if ($h -like '*-pooler*') { throw 'ABORT: target is a pooled host, use the DIRECT connection string' }
  return $u
}

function Invoke-Counts([string]$url, [string]$outFile) {
  & $psql $url -X -A -t -F '|' -f $countsSql -f $spotSql -o $outFile
  Assert-Ok 'psql counts'
  $n = (Select-String -Path $outFile -Pattern '^COUNT\|').Count
  Write-Host "COUNT lines: $n (expect 94)  file: $outFile"
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Write-Host "STEP $Step  ($(Get-Date -Format 'HH:mm:ss'))"

switch ($Step) {
  'Check' {
    $s = Get-Src
    & $psql $s -X -A -t -c "select 'connected: server ' || current_setting('server_version') || ', database ' || current_database()"
    Assert-Ok 'source probe'
    $d = Get-Dst
    & $psql $d -X -A -t -c "select 'connected: server ' || current_setting('server_version') || ', database ' || current_database() || ', tables in public: ' || (select count(*) from information_schema.tables where table_schema = 'public')"
    Assert-Ok 'target probe'
    & $pgDump --version
  }
  'CountsBefore' {
    $s = Get-Src
    if ($DryRun) { Write-Host "DRYRUN: would run table-counts.sql and spot-checks.sql on the source -> $before" } else { Invoke-Counts $s $before }
  }
  'Dump' {
    $s = Get-Src
    if ($DryRun) { Write-Host "DRYRUN: would run pg_dump -Fc --no-owner --no-privileges on the source -> $dumpFile" }
    else {
      & $pgDump $s -Fc --no-owner --no-privileges -f $dumpFile
      Assert-Ok 'pg_dump'
      $len = (Get-Item $dumpFile).Length
      Write-Host ("dump size: {0:N0} bytes (last time: 10,021,863)" -f $len)
    }
  }
  'CountsAfter' {
    $s = Get-Src
    if ($DryRun) { Write-Host "DRYRUN: would run counts on the source -> $after" } else { Invoke-Counts $s $after }
  }
  'CompareDrift' {
    node scripts/migration/compare-counts.mjs $before $after
  }
  'Restore' {
    $d = Get-Dst
    $h = Get-DbHost $d
    if ($h -notlike "*$ExpectedDstHost*") { throw "ABORT: target host is not the expected rehearsal branch ($ExpectedDstHost)" }
    if (-not (Test-Path $dumpFile)) { throw "ABORT: $dumpFile not found. Run -Step Dump first." }
    if ($DryRun) { Write-Host "DRYRUN: would pg_restore $dumpFile into the target with --clean --if-exists --exit-on-error" }
    else {
      & $pgRestore -d $d --no-owner --no-privileges --clean --if-exists --exit-on-error $dumpFile
      Assert-Ok 'pg_restore'
      Write-Host 'restore finished with exit code 0'
    }
  }
  'RestoredCounts' {
    $d = Get-Dst
    if ($DryRun) { Write-Host "DRYRUN: would run counts on the target -> $restored" } else { Invoke-Counts $d $restored }
  }
  'CompareRestored' {
    node scripts/migration/compare-counts.mjs $after $restored
  }
  'SourceStructure' {
    $s = Get-Src
    & $psql $s -X -A -t -F '|' -f $structSql -o $srcStruct
    Assert-Ok 'psql structure (source)'
    Write-Host "STRUCT lines: $((Select-String -Path $srcStruct -Pattern '^STRUCT\|').Count) (expect 10)  file: $srcStruct"
  }
  'RestoredStructure' {
    $d = Get-Dst
    & $psql $d -X -A -t -F '|' -f $structSql -o $dstStruct
    Assert-Ok 'psql structure (target)'
    Write-Host "STRUCT lines: $((Select-String -Path $dstStruct -Pattern '^STRUCT\|').Count) (expect 10)  file: $dstStruct"
  }
  'CompareStructure' {
    node scripts/migration/compare-counts.mjs $srcStruct $dstStruct
  }
}

Show-Elapsed $sw
