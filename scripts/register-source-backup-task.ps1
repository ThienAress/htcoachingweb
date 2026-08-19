[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetDirectory,

  [string]$TaskName = "HTCoaching Source Backup",

  [ValidatePattern("^([01]\d|2[0-3]):[0-5]\d$")]
  [string]$At = "03:00"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = [IO.Path]::GetFullPath($TargetDirectory)
$relative = [IO.Path]::GetRelativePath($repoRoot, $target)

if ($relative -eq "." -or (-not $relative.StartsWith("..") -and -not [IO.Path]::IsPathRooted($relative))) {
  throw "Source backup target must be outside the repository"
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

& (Join-Path $PSScriptRoot "run-source-backup.ps1") -TargetDirectory $target
if ($LASTEXITCODE -ne 0) {
  throw "Initial source backup verification failed"
}

if ($PSCmdlet.ShouldProcess($TaskName, "Register weekly source backup task")) {
  $escapedRunner = (Join-Path $PSScriptRoot "run-source-backup.ps1").Replace('"', '`"')
  $escapedTarget = $target.Replace('"', '`"')
  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$escapedRunner`" -TargetDirectory `"$escapedTarget`""
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $At
  $principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Description "Verified weekly Git bundle and working-tree recovery archive for HTCOACHINGWEB" `
    -Force | Out-Null
}

[PSCustomObject]@{
  TaskName = $TaskName
  Schedule = "Sunday $At"
  InitialBackupVerified = $true
}
