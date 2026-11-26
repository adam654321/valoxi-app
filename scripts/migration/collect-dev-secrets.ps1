<#
.SYNOPSIS
  Builds the environment set for the DigitalOcean DEV/STAGING app and saves it to
  the gitignored file .env.do-dev. Asks only for the values that must come from a
  vendor dashboard; everything else is filled in automatically. Nothing typed or
  pasted is ever shown on screen.

.DESCRIPTION
  Run it yourself in a normal PowerShell window (it needs a keyboard, so it
  cannot be run by Claude):

    powershell -ExecutionPolicy Bypass -File scripts\migration\collect-dev-secrets.ps1

  Asked for (paste, nothing appears, press Enter; Enter alone keeps or skips):
    CLERK_PUBLISHABLE_KEY         Clerk DEVELOPMENT instance, pk_test_...
    CLERK_SECRET_KEY              Clerk DEVELOPMENT instance, sk_test_...
    CLERK_WEBHOOK_SIGNING_SECRET  Clerk dev webhook endpoint for the dev app URL, whsec_...
    STRIPE_SECRET_KEY             Stripe TEST mode, sk_test_...
    STRIPE_WEBHOOK_SECRET         Stripe test webhook endpoint for the dev app URL, whsec_...
    R2_ACCESS_KEY_ID              token scoped to the bucket valoxi-documents-dev
    R2_SECRET_ACCESS_KEY          same token

  Filled in without asking:
    DATABASE_URL                  POOLED_URL from .env.dev (must be the Neon dev endpoint)
    SESSION_SECRET                new random value, generated once and then kept
    VITE_CLERK_PUBLISHABLE_KEY    copy of CLERK_PUBLISHABLE_KEY (BUILD-TIME on DigitalOcean)
    GOOGLE_GEMINI_API_KEY, R2_ACCOUNT_ID, MARKETING_SITE_URL, FIVE_D_BILLING_START,
    TEST_INTERNAL_USER_COMPANY_ID copied from .env.do-prod
    APP_URL                       the literal ${APP_URL}, which DigitalOcean replaces with the app's URL
    fixed values                  R2_BUCKET_NAME, ISSUE_REPORT_RECIPIENT, CLERK_ENABLED, NODE_ENV, PORT,
                                  NYLAS_CONNECT_GMAIL_VISIBLE, NYLAS_CONNECT_OUTLOOK_VISIBLE

  Never written, on purpose (the dev database is a copy of production, and the
  billing, chase-up and backup jobs start by themselves): every RESEND_*, every
  SMTP_*, and the NYLAS_ secrets. Without RESEND_API_KEY the app cannot email anyone.

.PARAMETER Check
  Do not ask for anything. Report names and verdicts only, never values.

.PARAMETER AutoOnly
  Ask for nothing. Write the automatic values only and show the report.

.PARAMETER Only
  Ask only for these names (comma separated), e.g. -Only STRIPE_WEBHOOK_SECRET
#>
[CmdletBinding()]
param(
  [switch]$Check,
  # Ask for nothing; only (re)write the values that need no typing.
  [switch]$AutoOnly,
  [string]$Only = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outFile  = Join-Path $repoRoot '.env.do-dev'
$prodFile = Join-Path $repoRoot '.env.do-prod'
$devDb    = Join-Path $repoRoot '.env.dev'
$devEndpoint  = 'ep-holy-resonance-zazrpf52'
$prodEndpoint = 'ep-cold-night-za5w03lp'

# Source: ask = prompt (Hidden or shown), prod = copy from .env.do-prod, fixed = constant,
# db = POOLED_URL of .env.dev, gen = random, copy = same as another name.
$vars = @(
  # DigitalOcean fills this in with the app's own URL, so it never has to be typed.
  @{ Name = 'APP_URL';                       Source = 'fixed'; Value = '${APP_URL}' }
  @{ Name = 'CLERK_PUBLISHABLE_KEY';         Source = 'ask'; Rule = { param($v) if ($v -notmatch '^pk_test_') { 'does not start with pk_test_ (must be the DEVELOPMENT instance)' } } }
  @{ Name = 'VITE_CLERK_PUBLISHABLE_KEY';    Source = 'copy'; From = 'CLERK_PUBLISHABLE_KEY' }
  @{ Name = 'CLERK_SECRET_KEY';              Source = 'ask'; Rule = { param($v) if ($v -notmatch '^sk_test_') { 'does not start with sk_test_ (must be the DEVELOPMENT instance)' } } }
  @{ Name = 'CLERK_WEBHOOK_SIGNING_SECRET';  Source = 'ask'; Rule = { param($v) if ($v -notmatch '^whsec_') { 'does not start with whsec_' } } }
  @{ Name = 'STRIPE_SECRET_KEY';             Source = 'ask'; Rule = { param($v) if ($v -notmatch '^(sk|rk)_test_') { 'does not start with sk_test_ or rk_test_ (must be TEST mode)' } } }
  @{ Name = 'STRIPE_WEBHOOK_SECRET';         Source = 'ask'; Rule = { param($v) if ($v -notmatch '^whsec_') { 'does not start with whsec_' } } }
  @{ Name = 'R2_ACCESS_KEY_ID';              Source = 'ask' }
  @{ Name = 'R2_SECRET_ACCESS_KEY';          Source = 'ask' }
  @{ Name = 'R2_ACCOUNT_ID';                 Source = 'prod' }
  @{ Name = 'R2_BUCKET_NAME';                Source = 'fixed'; Value = 'valoxi-documents-dev' }
  @{ Name = 'DATABASE_URL';                  Source = 'db' }
  @{ Name = 'SESSION_SECRET';                Source = 'gen' }
  @{ Name = 'GOOGLE_GEMINI_API_KEY';         Source = 'prod' }
  @{ Name = 'MARKETING_SITE_URL';            Source = 'prod' }
  @{ Name = 'FIVE_D_BILLING_START';          Source = 'prod' }
  @{ Name = 'TEST_INTERNAL_USER_COMPANY_ID'; Source = 'prod' }
  @{ Name = 'ISSUE_REPORT_RECIPIENT';        Source = 'fixed'; Value = 'adam@valoxi.ai' }
  @{ Name = 'CLERK_ENABLED';                 Source = 'fixed'; Value = 'true' }
  @{ Name = 'NYLAS_CONNECT_GMAIL_VISIBLE';   Source = 'fixed'; Value = 'true' }
  @{ Name = 'NYLAS_CONNECT_OUTLOOK_VISIBLE'; Source = 'fixed'; Value = 'false' }
  @{ Name = 'NODE_ENV';                      Source = 'fixed'; Value = 'production' }
  @{ Name = 'PORT';                          Source = 'fixed'; Value = '8080' }
)

# A dev value equal to the production value of the same name means the wrong dashboard was used.
$mustDifferFromProd = @('CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SIGNING_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'SESSION_SECRET')

function Read-EnvFile([string]$path) {
  $map = [ordered]@{}
  if (Test-Path -LiteralPath $path) {
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
      if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
      $i = $line.IndexOf('=')
      $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    }
  }
  return $map
}

function Save-EnvFile([string]$path, $map) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# DEV/STAGING environment for the DigitalOcean dev app. NEVER commit, print or share.')
  $lines.Add('# Written by scripts/migration/collect-dev-secrets.ps1. Paste into the DO Bulk Editor.')
  foreach ($v in $vars) {
    if ($map.Contains($v.Name) -and $map[$v.Name] -ne '') { $lines.Add($v.Name + '=' + $map[$v.Name]) }
  }
  [System.IO.File]::WriteAllLines($path, $lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Protect-File([string]$path) {
  $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $path /inheritance:r /grant:r "${me}:(R,W,D)" | Out-Null
}

function Read-Hidden([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function New-Secret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

# Fills every value that needs no typing. Returns notes (never values).
function Set-AutoValues($map, $prod) {
  $notes = New-Object System.Collections.Generic.List[string]
  foreach ($v in $vars) {
    switch ($v.Source) {
      'fixed' { $map[$v.Name] = $v.Value }
      'prod'  {
        if ($prod.Contains($v.Name) -and $prod[$v.Name] -ne '') { $map[$v.Name] = $prod[$v.Name] }
        else { $notes.Add("$($v.Name): not found in .env.do-prod") }
      }
      'gen'   { if (-not $map.Contains($v.Name) -or $map[$v.Name] -eq '') { $map[$v.Name] = New-Secret } }
      'db'    {
        $db = Read-EnvFile $devDb
        $url = if ($db.Contains('POOLED_URL')) { $db['POOLED_URL'] } else { '' }
        if ($url -eq '') { $notes.Add('DATABASE_URL: POOLED_URL not found in .env.dev') }
        elseif ($url -notmatch [regex]::Escape($devEndpoint) -or $url -notmatch '-pooler\.' -or $url -match [regex]::Escape($prodEndpoint)) {
          $notes.Add("DATABASE_URL: POOLED_URL in .env.dev is not the pooled $devEndpoint endpoint; NOT written")
          $map.Remove($v.Name)
        } else { $map[$v.Name] = $url }
      }
      'copy'  { if ($map.Contains($v.From) -and $map[$v.From] -ne '') { $map[$v.Name] = $map[$v.From] } }
    }
  }
  return $notes
}

function Get-Verdict($v, $map, $prod) {
  if (-not $map.Contains($v.Name) -or $map[$v.Name] -eq '') { return 'MISSING' }
  $val = $map[$v.Name]
  if ($val -match '_live_') { return 'CHECK: looks like a LIVE key' }
  if ($mustDifferFromProd -contains $v.Name -and $prod.Contains($v.Name) -and $prod[$v.Name] -ceq $val) {
    return 'CHECK: identical to the PRODUCTION value'
  }
  if ($v.Rule) { $warning = & $v.Rule $val; if ($warning) { return "CHECK: $warning" } }
  if ($v.Source -eq 'ask') { return 'saved' }
  return "saved ($($v.Source))"
}

function Show-Report($map, $prod) {
  Write-Host ''
  Write-Host 'Status (names only, values are never shown):'
  $missing = 0; $suspect = 0
  foreach ($v in $vars) {
    $verdict = Get-Verdict $v $map $prod
    if ($verdict -eq 'MISSING') { $missing++ } elseif ($verdict -notmatch '^saved') { $suspect++ }
    Write-Host ('  {0,-32} {1}' -f $v.Name, $verdict)
  }
  $known = @($vars | ForEach-Object { $_.Name })
  $extra = @($map.Keys | Where-Object { $known -notcontains $_ })
  foreach ($e in $extra) { $suspect++; Write-Host ("  CHECK: unexpected name in the file: {0}" -f $e) }
  $banned = @($map.Keys | Where-Object { $_ -match '^(RESEND_|SMTP_)' -or ($_ -match '^NYLAS_' -and $_ -notmatch '_VISIBLE$') })
  foreach ($b in $banned) { Write-Host ("  DANGER: {0} must not be set on the dev app" -f $b) }
  Write-Host ''
  Write-Host ("{0} of {1} saved, {2} missing, {3} to check." -f ($vars.Count - $missing), $vars.Count, $missing, $suspect)
  Write-Host "File: $outFile"
  Write-Host 'On DigitalOcean: VITE_CLERK_PUBLISHABLE_KEY is BUILD TIME; tick Encrypt on the keys, secrets and DATABASE_URL.'
}

$saved = Read-EnvFile $outFile
$prod  = Read-EnvFile $prodFile

if ($Check) {
  Show-Report $saved $prod
  return
}

$askable = @($vars | Where-Object { $_.Source -eq 'ask' })
$ask = $askable
if ($Only.Trim() -ne '') {
  $wanted = @($Only.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
  $unknown = @($wanted | Where-Object { @($askable | ForEach-Object { $_.Name }) -notcontains $_ })
  if ($unknown.Count -gt 0) {
    Write-Host ("Not a name this script asks for: {0}. Nothing changed." -f ($unknown -join ', '))
    return
  }
  $ask = @($askable | Where-Object { $wanted -contains $_.Name })
}

if ($AutoOnly) { $ask = @() }

Write-Host ''
Write-Host 'Collecting DEV values for the DigitalOcean dev app.'
Write-Host 'Paste each value and press Enter. Secrets are not shown. Enter alone skips or keeps.'
Write-Host ''

foreach ($v in $ask) {
  $have = $saved.Contains($v.Name) -and $saved[$v.Name] -ne ''
  $label = if ($have) { "$($v.Name) (saved; Enter keeps it)" } else { $v.Name }
  $value = if ($v.Shown) { Read-Host -Prompt $label } else { Read-Hidden $label }
  $value = $value.Trim()
  if ($value -ne '') { $saved[$v.Name] = $value }
}

$notes = Set-AutoValues $saved $prod
Save-EnvFile $outFile $saved
Protect-File $outFile
foreach ($n in $notes) { Write-Host "NOTE: $n" }
Show-Report (Read-EnvFile $outFile) $prod
