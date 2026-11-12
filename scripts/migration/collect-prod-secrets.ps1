<#
.SYNOPSIS
  Collects the production environment values for the DigitalOcean app, one at a
  time, with hidden input, and saves them to a gitignored file. Nothing typed or
  pasted is ever shown on screen or written anywhere else.

.DESCRIPTION
  Run it yourself in a normal PowerShell window (it needs a keyboard, so it
  cannot be run by Claude):

    powershell -ExecutionPolicy Bypass -File scripts\migration\collect-prod-secrets.ps1

  For each name: copy the value from the Replit production secrets pane, paste
  it at the prompt (right-click or Ctrl+V; nothing appears, that is correct) and
  press Enter. Press Enter on an empty prompt to skip a name, or to keep the
  value already saved from an earlier run. The script can be re-run as often as
  needed; it only replaces the values you paste.

  Output: .env.do-prod in the repo root (matched by .gitignore ".env.*"),
  readable by your Windows user only. One NAME=value per line.

  The password manager stays the source of truth. Delete .env.do-prod after the
  cutover.

  Deliberately NOT collected (see the list at the bottom of the run):
    - DATABASE_URL: on DigitalOcean this is the Neon production URL, not the
      Replit one. The old Replit URLs are for the cutover dump only.
    - Anything Replit injects for itself, and names the code does not read.

.PARAMETER Check
  Do not ask for anything. Report which names are saved, missing or suspect.
  Prints names and verdicts only, never values.
#>
[CmdletBinding()]
param(
  [switch]$Check,
  # Ask only for these names (comma separated), e.g. -Only NYLAS_API_KEY
  [string]$Only = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outFile  = Join-Path $repoRoot '.env.do-prod'

# Name, group, and an optional sanity rule. A rule is a script block that gets
# the value and returns $null when fine, or a short warning that must NOT
# contain the value.
$vars = @(
  @{ Name = 'APP_URL';                          Group = 'App';     Rule = { param($v) if ($v -ne 'https://app.valoxi.ai') { 'expected exactly https://app.valoxi.ai (no trailing slash)' } } }
  @{ Name = 'MARKETING_SITE_URL';               Group = 'App';     Rule = { param($v) if ($v -notmatch '^https://') { 'expected an https:// URL' } } }
  @{ Name = 'SESSION_SECRET';                   Group = 'App';     Rule = { param($v) if ($v.Length -lt 32) { 'shorter than 32 characters' } } }
  @{ Name = 'ISSUE_REPORT_RECIPIENT';           Group = 'App';     Rule = { param($v) if ($v -notmatch '@') { 'expected an email address' } } }
  @{ Name = 'FIVE_D_BILLING_START';             Group = 'App' }
  @{ Name = 'TEST_INTERNAL_USER_COMPANY_ID';    Group = 'App';     Rule = { param($v) if ($v -notmatch '^\d+$') { 'expected a whole number' } } }

  @{ Name = 'CLERK_ENABLED';                    Group = 'Clerk';   Rule = { param($v) if ($v -ne 'true') { 'expected true' } } }
  @{ Name = 'CLERK_SECRET_KEY';                 Group = 'Clerk';   Rule = { param($v) if ($v -notmatch '^sk_live_') { 'does not start with sk_live_ (is this the production instance?)' } } }
  @{ Name = 'CLERK_PUBLISHABLE_KEY';            Group = 'Clerk';   Rule = { param($v) if ($v -notmatch '^pk_live_') { 'does not start with pk_live_ (is this the production instance?)' } } }
  @{ Name = 'VITE_CLERK_PUBLISHABLE_KEY';       Group = 'Clerk';   Rule = { param($v) if ($v -notmatch '^pk_live_') { 'does not start with pk_live_. This one is a BUILD-TIME variable on DigitalOcean' } } }
  @{ Name = 'CLERK_WEBHOOK_SIGNING_SECRET';     Group = 'Clerk';   Rule = { param($v) if ($v -notmatch '^whsec_') { 'does not start with whsec_' } } }

  @{ Name = 'STRIPE_SECRET_KEY';                Group = 'Stripe';  Rule = { param($v) if ($v -notmatch '^(sk|rk)_live_') { 'does not start with sk_live_ or rk_live_ (a test key here would break live billing)' } } }
  @{ Name = 'STRIPE_WEBHOOK_SECRET';            Group = 'Stripe';  Rule = { param($v) if ($v -notmatch '^whsec_') { 'does not start with whsec_' } } }

  @{ Name = 'GOOGLE_GEMINI_API_KEY';            Group = 'Gemini' }

  @{ Name = 'R2_ACCOUNT_ID';                    Group = 'R2' }
  @{ Name = 'R2_BUCKET_NAME';                   Group = 'R2';      Rule = { param($v) if ($v -ne 'valoxi-documents') { 'expected valoxi-documents (the production bucket, not valoxi-documents-dev)' } } }
  @{ Name = 'R2_ACCESS_KEY_ID';                 Group = 'R2' }
  @{ Name = 'R2_SECRET_ACCESS_KEY';             Group = 'R2' }

  @{ Name = 'RESEND_API_KEY';                   Group = 'Resend';  Rule = { param($v) if ($v -notmatch '^re_') { 'does not start with re_' } } }
  @{ Name = 'RESEND_API_KEY_MARKETING';         Group = 'Resend';  Rule = { param($v) if ($v -notmatch '^re_') { 'does not start with re_' } } }
  @{ Name = 'RESEND_MARKETING_FROM_ADDRESS';    Group = 'Resend';  Rule = { param($v) if ($v -notmatch '@') { 'expected an email address' } } }
  @{ Name = 'RESEND_WEBHOOK_SECRET';            Group = 'Resend' }
  @{ Name = 'RESEND_SEGMENT_ALL_USERS';         Group = 'Resend' }
  @{ Name = 'RESEND_SEGMENT_ACTIVE_SUBSCRIBERS';    Group = 'Resend' }
  @{ Name = 'RESEND_SEGMENT_CANCELLED_SUBSCRIBERS'; Group = 'Resend' }
  @{ Name = 'RESEND_SEGMENT_PAST_DUE';          Group = 'Resend' }
  @{ Name = 'RESEND_SEGMENT_TRIALING';          Group = 'Resend' }
  @{ Name = 'RESEND_SEGMENT_TEST_INTERNAL';     Group = 'Resend' }

  @{ Name = 'SMTP_HOST';                        Group = 'SMTP' }
  @{ Name = 'SMTP_SECURE';                      Group = 'SMTP';    Rule = { param($v) if ($v -notmatch '^(true|false)$') { 'expected true or false' } } }
  @{ Name = 'SMTP_FROM_EMAIL';                  Group = 'SMTP';    Rule = { param($v) if ($v -notmatch '@') { 'expected an email address' } } }
  @{ Name = 'SMTP_ALERT_EMAIL';                 Group = 'SMTP';    Rule = { param($v) if ($v -notmatch '@') { 'expected an email address' } } }

  @{ Name = 'NYLAS_API_KEY';                    Group = 'Nylas' }
  @{ Name = 'NYLAS_API_URI';                    Group = 'Nylas';   Rule = { param($v) if ($v -notmatch '^https://') { 'expected an https:// URL' } } }
  @{ Name = 'NYLAS_CLIENT_ID';                  Group = 'Nylas' }
  @{ Name = 'NYLAS_REDIRECT_URI';               Group = 'Nylas';   Rule = { param($v) if ($v -notmatch '^https://app\.valoxi\.ai/') { 'expected to start with https://app.valoxi.ai/' } } }
  @{ Name = 'NYLAS_STATE_SECRET';               Group = 'Nylas' }
  @{ Name = 'NYLAS_CONNECT_GMAIL_VISIBLE';      Group = 'Nylas';   Rule = { param($v) if ($v -ne 'true') { 'the migration notes say this must be true on DigitalOcean' } } }
  @{ Name = 'NYLAS_CONNECT_OUTLOOK_VISIBLE';    Group = 'Nylas';   Rule = { param($v) if ($v -ne 'false') { 'the migration notes say this must be false on DigitalOcean' } } }
)

# In Replit production, but not wanted on DigitalOcean. Shown for reference.
$skipped = @(
  'DATABASE_URL, PROD_DATABASE_URL: old Replit database. Password manager only; DigitalOcean gets the Neon production URL'
  'PGDATABASE, PGHOST, PGPORT, PGUSER, PGPASSWORD: old Replit database, set by Replit'
  'AI_INTEGRATIONS_GEMINI_BASE_URL, AI_INTEGRATIONS_GEMINI_API_KEY: Replit AI integration, ignored by the code'
  'DEFAULT_OBJECT_STORAGE_BUCKET_ID, PUBLIC_OBJECT_SEARCH_PATHS, PRIVATE_OBJECT_DIR: Replit object storage, not read by the code'
  'CONNECTORS_HOSTNAME, REPLIT_CONNECTORS_HOSTNAME: set by Replit'
  'WEBHOOK_URL, file_upload_webhook, STAGE1_JSON_ANALYSER_WEBHOOK_URL, STAGE1_Detailed_Analysis_URL: not read by the code'
  'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID: not read by the code'
  'RESEND_TOPIC_TIPS_AND_RESOURCES, RESEND_TOPIC_PRODUCT_UPDATES, OPEN_ACCESS_ENABLED: not read by the code'
  'sk_test_key, PROD_STRIPE_KEY: not read by the code (the app reads STRIPE_SECRET_KEY)'
)

function Read-EnvFile([string]$path) {
  $map = [ordered]@{}
  if (Test-Path -LiteralPath $path) {
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
      if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
      $i = $line.IndexOf('=')
      $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1)
    }
  }
  return $map
}

function Save-EnvFile([string]$path, $map) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# Production environment for the DigitalOcean app. NEVER commit, print or share.')
  $lines.Add('# Written by scripts/migration/collect-prod-secrets.ps1. Delete after the cutover.')
  foreach ($v in $vars) {
    if ($map.Contains($v.Name) -and $map[$v.Name] -ne '') {
      $lines.Add($v.Name + '=' + $map[$v.Name])
    }
  }
  # UTF-8 without a byte order mark, so any env parser can read it.
  [System.IO.File]::WriteAllLines($path, $lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Protect-File([string]$path) {
  # Remove inherited permissions and allow only the current Windows user.
  $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $path /inheritance:r /grant:r "${me}:(R,W,D)" | Out-Null
}

function Read-Hidden([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Get-Verdict($v, $map) {
  if (-not $map.Contains($v.Name) -or $map[$v.Name] -eq '') { return 'MISSING' }
  if ($v.Rule) {
    $warning = & $v.Rule $map[$v.Name]
    if ($warning) { return "CHECK: $warning" }
  }
  return 'saved'
}

function Show-Report($map) {
  Write-Host ''
  Write-Host 'Status (names only, values are never shown):'
  $missing = 0; $suspect = 0
  foreach ($v in $vars) {
    $verdict = Get-Verdict $v $map
    if ($verdict -eq 'MISSING') { $missing++ } elseif ($verdict -ne 'saved') { $suspect++ }
    Write-Host ('  {0,-38} {1}' -f $v.Name, $verdict)
  }
  # Cross-check: the two Clerk publishable keys must be the same value.
  if ($map.Contains('CLERK_PUBLISHABLE_KEY') -and $map.Contains('VITE_CLERK_PUBLISHABLE_KEY') -and
      $map['CLERK_PUBLISHABLE_KEY'] -cne $map['VITE_CLERK_PUBLISHABLE_KEY']) {
    $suspect++
    Write-Host '  CHECK: CLERK_PUBLISHABLE_KEY and VITE_CLERK_PUBLISHABLE_KEY are different values; they should match'
  }
  Write-Host ''
  Write-Host ("{0} of {1} saved, {2} missing, {3} to check." -f ($vars.Count - $missing), $vars.Count, $missing, $suspect)
  Write-Host "File: $outFile"
}

$saved = Read-EnvFile $outFile

if ($Check) {
  Show-Report $saved
  return
}

Write-Host ''
Write-Host 'Collecting production values for the DigitalOcean app.'
Write-Host 'Paste each value and press Enter. Nothing you paste is shown. Enter alone skips or keeps.'
Write-Host ''

$ask = $vars
if ($Only.Trim() -ne '') {
  $wanted = @($Only.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
  $known = @($vars | ForEach-Object { $_.Name })
  $unknown = @($wanted | Where-Object { $known -notcontains $_ })
  if ($unknown.Count -gt 0) {
    Write-Host ("Unknown name(s): {0}. Nothing changed." -f ($unknown -join ', '))
    return
  }
  $ask = @($vars | Where-Object { $wanted -contains $_.Name })
}

$group = ''
$index = 0
foreach ($v in $ask) {
  $index++
  if ($v.Group -ne $group) {
    $group = $v.Group
    Write-Host ''
    Write-Host "== $group =="
  }

  $have = $saved.Contains($v.Name) -and $saved[$v.Name] -ne ''
  $hint = ''
  if ($have) { $hint = ' (already saved, Enter keeps it)' }

  $value = (Read-Hidden ("[{0}/{1}] {2}{3}" -f $index, $ask.Count, $v.Name, $hint)).Trim()

  if ($value -eq '') {
    if ($have) { Write-Host '      kept' } else { Write-Host '      skipped' }
    continue
  }
  if ($value -match "[`r`n]") {
    Write-Host '      NOT saved: the value contains a line break. Copy it again as a single line.'
    continue
  }

  $saved[$v.Name] = $value
  # Save after every value, so an interrupted run loses nothing.
  Save-EnvFile $outFile $saved
  Protect-File $outFile

  $verdict = Get-Verdict $v $saved
  if ($verdict -eq 'saved') { Write-Host '      saved' } else { Write-Host "      saved, but $verdict" }
  $value = $null
}

Show-Report $saved

Write-Host ''
Write-Host 'In Replit production but deliberately NOT collected:'
foreach ($line in $skipped) { Write-Host "  - $line" }
Write-Host ''
Write-Host 'Not in Replit production, so not asked for: SMTP_USER, SMTP_PASS, SMTP_PORT.'
Write-Host 'Still needed on DigitalOcean and set there directly: DATABASE_URL (Neon production, pooled or direct as the plan says), GIT_SHA (build time), NODE_ENV, PORT.'
