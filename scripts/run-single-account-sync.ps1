[CmdletBinding()]
param(
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
$mutex = [Threading.Mutex]::new($false, "Local\HTCoachingSingleAccountSync")
$hasLock = $false
$plainBytes = $null

try {
  try {
    $hasLock = $mutex.WaitOne(0)
  } catch [Threading.AbandonedMutexException] {
    $hasLock = $true
  }

  if (-not $hasLock) {
    [PSCustomObject]@{ status = "skipped"; code = "ACCOUNT_SYNC_ALREADY_RUNNING" } |
      ConvertTo-Json -Compress
    exit 0
  }

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
    throw "ACCOUNT_SYNC_LOCAL_MONGO_UNAVAILABLE"
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
  if (-not $payload.accountEmail -or -not $payload.sourceUri) {
    throw "ACCOUNT_SYNC_DPAPI_SECRET_INVALID"
  }

  $env:ACCOUNT_SYNC_EMAIL = $payload.accountEmail
  $env:PRODUCTION_ACCOUNT_SYNC_READONLY_URI = $payload.sourceUri
  $env:LOCAL_ACCOUNT_SYNC_URI = "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0"
  $env:ACCOUNT_SYNC_SOURCE_ENV = "production"
  $env:ACCOUNT_SYNC_SOURCE_READ_ONLY = "yes"
  $env:CONFIRM_LOCAL_ACCOUNT_SYNC = "yes"

  $arguments = @("src/scripts/singleAccountSync.js", "--target=local")
  if ($Apply) { $arguments += "--apply" }

  Push-Location $serverRoot
  try {
    & node @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "ACCOUNT_SYNC_LOCAL_COMMAND_FAILED"
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($null -ne $plainBytes) {
    [Array]::Clear($plainBytes, 0, $plainBytes.Length)
  }
  $payload = $null
  Remove-Item Env:ACCOUNT_SYNC_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_ACCOUNT_SYNC_READONLY_URI -ErrorAction SilentlyContinue
  Remove-Item Env:LOCAL_ACCOUNT_SYNC_URI -ErrorAction SilentlyContinue
  Remove-Item Env:ACCOUNT_SYNC_SOURCE_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:ACCOUNT_SYNC_SOURCE_READ_ONLY -ErrorAction SilentlyContinue
  Remove-Item Env:CONFIRM_LOCAL_ACCOUNT_SYNC -ErrorAction SilentlyContinue
  if ($hasLock) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
