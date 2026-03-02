$ErrorActionPreference = 'Stop'

$taskName = 'LinkDashboard-Autostart'
$logonTaskName = 'LinkDashboard-LogonTask'

$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startupFile = Join-Path $startupDir 'LinkDashboard-Autostart.cmd'

$deleteCmd = "schtasks /Delete /TN `"$taskName`" /F >nul 2>nul"
cmd.exe /c $deleteCmd | Out-Null

try {
  Unregister-ScheduledTask -TaskName $logonTaskName -Confirm:$false -ErrorAction Stop
} catch {
}

if (Test-Path $startupFile) {
  Remove-Item -Path $startupFile -Force
}

Write-Host "Autostart entfernt: $taskName"
