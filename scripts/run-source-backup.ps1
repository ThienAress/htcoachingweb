param(
  [Parameter(Mandatory = $true)]
  [string]$TargetDirectory
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$node = Get-Command node -ErrorAction Stop

& $node.Source (Join-Path $repoRoot "scripts\source-backup.mjs") `
  --target-dir $TargetDirectory

if ($LASTEXITCODE -ne 0) {
  throw "Source backup failed with exit code $LASTEXITCODE"
}
