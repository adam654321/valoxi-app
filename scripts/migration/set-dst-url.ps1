<#
.SYNOPSIS
  Saves Neon connection strings in a gitignored env file, with hidden input.
  The connection strings are never shown.

.DESCRIPTION
  Run it yourself in a normal PowerShell window:

    powershell -ExecutionPolicy Bypass -File C:\Users\AdamAuty\valoxi\scripts\migration\set-dst-url.ps1 -Target rehearsal3
    powershell -ExecutionPolicy Bypass -File C:\Users\AdamAuty\valoxi\scripts\migration\set-dst-url.ps1 -Target cutover

  rehearsal3 writes .env.rehearsal3 (the Neon branch rehearsal-3).
  cutover    writes .env.cutover    (the Neon branch production).

  Without -Pooled it saves the DIRECT string as DST_URL (used by the dump and
  restore runner). In Neon turn "Connection pooling" OFF before copying; a
  pooled string is refused.

  With -Pooled it saves the POOLED string as POOLED_URL in the same file (the
  value for DATABASE_URL on DigitalOcean). In Neon turn pooling ON; a direct
  string is refused, and so is a string for a different endpoint than the
  DST_URL already saved.

  Each run replaces only its own line and keeps the other.

  Prints only the endpoint name (ep-...), which is needed for -ExpectedDstHost
  and is not a secret. Never prints the user, password or full string.

.PARAMETER Check
  Do not ask for anything. Report whether the file exists and looks right.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('rehearsal3', 'cutover')]
  [string]$Target,
  [switch]$Pooled,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outFile  = Join-Path $repoRoot (".env.$Target")
$branch   = if ($Target -eq 'cutover') { 'production' } else { 'rehearsal-3' }

# Returns a hashtable: Problem (string or $null), Endpoint, IsPooled.
function Test-Url([string]$url) {
  $result = @{ Problem = $null; Endpoint = $null; IsPooled = $false }
  if ($url -match "[`r`n\s]") { $result.Problem = 'contains a space or line break'; return $result }
  if ($url -notmatch '^postgres(ql)?://') { $result.Problem = 'does not start with postgresql://'; return $result }
  if ($url -notmatch '@([^/:?]+)') { $result.Problem = 'no host found after the @'; return $result }
  $dbHost = $Matches[1]
  if ($dbHost -notmatch '^(ep-[a-z0-9-]+?)(-pooler)?\.') { $result.Problem = 'host does not look like a Neon endpoint (ep-...)'; return $result }
  $result.Endpoint = $Matches[1]
  $result.IsPooled = [bool]$Matches[2]
  return $result
}

function Read-Saved([string]$path) {
  $map = @{}
  if (Test-Path -LiteralPath $path) {
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
      if ($line -match '^\s*(DST_URL|POOLED_URL)\s*=\s*"?([^"]*)"?\s*$') { $map[$Matches[1]] = $Matches[2] }
    }
  }
  return $map
}

function Get-Status([string]$key, $map) {
  if (-not $map.ContainsKey($key) -or $map[$key] -eq '') { return 'MISSING' }
  $t = Test-Url $map[$key]
  if ($t.Problem) { return "CHECK: $($t.Problem)" }
  if ($key -eq 'DST_URL' -and $t.IsPooled) { return 'CHECK: this is a pooled string, expected direct' }
  if ($key -eq 'POOLED_URL' -and -not $t.IsPooled) { return 'CHECK: this is a direct string, expected pooled' }
  $kind = if ($t.IsPooled) { 'pooled' } else { 'direct' }
  return "saved, $kind string, endpoint $($t.Endpoint)"
}

$saved = Read-Saved $outFile

if ($Check) {
  if (-not (Test-Path -LiteralPath $outFile)) { Write-Host "$outFile : MISSING"; return }
  Write-Host $outFile
  Write-Host ("  DST_URL     {0}" -f (Get-Status 'DST_URL' $saved))
  Write-Host ("  POOLED_URL  {0}" -f (Get-Status 'POOLED_URL' $saved))
  if ($saved.ContainsKey('DST_URL') -and $saved.ContainsKey('POOLED_URL')) {
    $a = Test-Url $saved['DST_URL']; $b = Test-Url $saved['POOLED_URL']
    if ($a.Endpoint -and $b.Endpoint -and $a.Endpoint -ne $b.Endpoint) {
      Write-Host '  CHECK: the two strings are for different endpoints (different Neon branches)'
    }
  }
  return
}

$key  = if ($Pooled) { 'POOLED_URL' } else { 'DST_URL' }
$kind = if ($Pooled) { 'POOLED' } else { 'DIRECT' }
$onOff = if ($Pooled) { 'ON' } else { 'OFF' }

Write-Host ''
Write-Host "Neon branch: $branch   ->   $outFile ($key)"
Write-Host "In Neon, turn Connection pooling $onOff, copy the string, paste here and press Enter."
Write-Host 'Nothing you paste is shown.'
Write-Host ''

$secure = Read-Host -Prompt "$kind connection string for '$branch'" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

# Neon's copy button sometimes gives: psql 'postgresql://...'  Strip that wrapper.
$url = $url.Trim()
$url = $url -replace '^psql\s+', ''
$url = $url.Trim("'", '"', ' ')

if ($url -eq '') { Write-Host 'Nothing entered. Nothing changed.'; return }

$t = Test-Url $url
if ($t.Problem) { Write-Host "NOT saved: $($t.Problem)."; return }
if ($Pooled -and -not $t.IsPooled) { Write-Host 'NOT saved: this is the DIRECT string (no -pooler in the host). Turn pooling on in Neon and copy again.'; return }
if (-not $Pooled -and $t.IsPooled) { Write-Host 'NOT saved: this is the POOLED string (host contains -pooler). Turn pooling off in Neon and copy again.'; return }

# The two strings in one file must be for the same Neon endpoint.
$otherKey = if ($Pooled) { 'DST_URL' } else { 'POOLED_URL' }
if ($saved.ContainsKey($otherKey) -and $saved[$otherKey] -ne '') {
  $o = Test-Url $saved[$otherKey]
  if ($o.Endpoint -and $o.Endpoint -ne $t.Endpoint) {
    Write-Host "NOT saved: this string is for endpoint $($t.Endpoint), but $otherKey in this file is for $($o.Endpoint). Check the branch selected in Neon."
    return
  }
}

$saved[$key] = $url
$text = ''
foreach ($k in @('DST_URL', 'POOLED_URL')) {
  if ($saved.ContainsKey($k) -and $saved[$k] -ne '') { $text += "$k=`"$($saved[$k])`"`n" }
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, $text, $utf8NoBom)

# Remove inherited permissions and allow only the current Windows user.
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $outFile /inheritance:r /grant:r "${me}:(R,W,D)" | Out-Null

$url = $null
Write-Host ''
Write-Host "Saved $key to $outFile"
Write-Host "Endpoint name (not a secret): $($t.Endpoint)"
