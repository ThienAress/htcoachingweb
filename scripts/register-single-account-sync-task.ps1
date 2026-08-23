[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$TaskName = "HTCoaching Single Account Pull Sync",
  [ValidateRange(15, 1440)]
  [int]$EveryMinutes = 60
)

$ErrorActionPreference = "Stop"
$runner = (Resolve-Path (
  Join-Path $PSScriptRoot "run-single-account-sync.ps1"
)).Path
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$escapedRunner = $runner.Replace('"', '`"')

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$escapedRunner`" -Apply"
$interval = New-TimeSpan -Minutes $EveryMinutes
$repeatTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At ((Get-Date).AddMinutes(2)) `
  -RepetitionInterval $interval `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal `
  -UserId $currentUser `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

if ($PSCmdlet.ShouldProcess($TaskName, "Register pull-only local account sync")) {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($repeatTrigger, $logonTrigger) `
    -Principal $principal `
    -Settings $settings `
    -Description "Pull one pinned test account from production into local MongoDB" `
    -Force | Out-Null
}

[PSCustomObject]@{
  TaskName = $TaskName
  Direction = "production-to-local"
  IntervalMinutes = $EveryMinutes
  SecretsInCommandLine = $false
}
