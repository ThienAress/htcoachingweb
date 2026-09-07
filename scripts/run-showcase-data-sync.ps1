[CmdletBinding()]
param(
  [ValidateSet("local", "staging")]
  [string]$Target = "local",
  [switch]$Apply,
  [string]$SecretPath = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverRoot = Join-Path $repoRoot "server"
$mongoRunner = Join-Path $repoRoot "scripts\start-local-mongo.mjs"
$mongoStdout = Join-Path $repoRoot ".local-data\local-mongo-runtime.out.log"
$mongoStderr = Join-Path $repoRoot ".local-data\local-mongo-runtime.error.log"
$resolvedSecretPath = if ($SecretPath) {
  (Resolve-Path -LiteralPath $SecretPath).Path
} else {
  (Resolve-Path -LiteralPath (
    Join-Path $repoRoot ".local-data\account-sync-secret.dpapi"
  )).Path
}
$mutex = [Threading.Mutex]::new($false, "Local\HTCoachingShowcaseDataSync")
$hasLock = $false
$plainBytes = $null
$payload = $null

try {
  try {
    $hasLock = $mutex.WaitOne(0)
  } catch [Threading.AbandonedMutexException] {
    $hasLock = $true
  }

  if (-not $hasLock) {
    [PSCustomObject]@{
      status = "skipped"
      code = "SHOWCASE_SYNC_ALREADY_RUNNING"
      target = $Target
    } | ConvertTo-Json -Compress
    exit 0
  }

  if ($Target -eq "local") {
    $mongoReady = Test-NetConnection `
      -ComputerName 127.0.0.1 `
      -Port 27017 `
      -InformationLevel Quiet `
      -WarningAction SilentlyContinue
    if (-not $mongoReady) {
      Start-Process `
        -FilePath "node" `
        -ArgumentList @($mongoRunner) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $mongoStdout `
        -RedirectStandardError $mongoStderr
      foreach ($attempt in 1..60) {
        Start-Sleep -Seconds 1
        $mongoReady = Test-NetConnection `
          -ComputerName 127.0.0.1 `
          -Port 27017 `
          -InformationLevel Quiet `
          -WarningAction SilentlyContinue
        if ($mongoReady) { break }
      }
    }
    if (-not $mongoReady) {
      throw "SHOWCASE_SYNC_LOCAL_MONGO_UNAVAILABLE"
    }
  }

  Add-Type -AssemblyName System.Security
  $entropy = [Text.Encoding]::UTF8.GetBytes("HTCoachingAccountSyncV1")
  $protectedBytes = [IO.File]::ReadAllBytes($resolvedSecretPath)
  $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
    $protectedBytes,
    $entropy,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $payload = [Text.Encoding]::UTF8.GetString($plainBytes) | ConvertFrom-Json
  if (-not $payload.sourceUri) {
    throw "SHOWCASE_SYNC_DPAPI_SOURCE_INVALID"
  }
  if ($Target -eq "staging" -and -not $payload.targetUri) {
    throw "SHOWCASE_SYNC_DPAPI_STAGING_TARGET_INVALID"
  }

  $env:PRODUCTION_SHOWCASE_SYNC_READONLY_URI = [string]$payload.sourceUri
  $env:ACCOUNT_SYNC_SOURCE_ENV = "production"
  $env:ACCOUNT_SYNC_SOURCE_READ_ONLY = "yes"

  if ($Target -eq "local") {
    $env:LOCAL_SHOWCASE_SYNC_URI =
      "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0"
    $env:CONFIRM_LOCAL_SHOWCASE_SYNC = "yes"
  } else {
    $env:STAGING_SHOWCASE_SYNC_URI = [string]$payload.targetUri
    $env:ACCOUNT_SYNC_TARGET_ENV = "staging"
    $env:CONFIRM_STAGING_SHOWCASE_SYNC = "yes"
  }

  $arguments = @(
    "src/scripts/showcaseDataSync.js",
    "--target=$Target"
  )
  if ($Apply) { $arguments += "--apply" }

  Push-Location $serverRoot
  try {
    & node @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "SHOWCASE_SYNC_COMMAND_FAILED"
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($null -ne $plainBytes) {
    [Array]::Clear($plainBytes, 0, $plainBytes.Length)
  }
  $payload = $null
  Remove-Item Env:PRODUCTION_SHOWCASE_SYNC_READONLY_URI -ErrorAction SilentlyContinue
  Remove-Item Env:LOCAL_SHOWCASE_SYNC_URI -ErrorAction SilentlyContinue
  Remove-Item Env:STAGING_SHOWCASE_SYNC_URI -ErrorAction SilentlyContinue
  Remove-Item Env:ACCOUNT_SYNC_SOURCE_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:ACCOUNT_SYNC_SOURCE_READ_ONLY -ErrorAction SilentlyContinue
  Remove-Item Env:ACCOUNT_SYNC_TARGET_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:CONFIRM_LOCAL_SHOWCASE_SYNC -ErrorAction SilentlyContinue
  Remove-Item Env:CONFIRM_STAGING_SHOWCASE_SYNC -ErrorAction SilentlyContinue
  if ($hasLock) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
