$ErrorActionPreference = 'Stop'

$taskName = 'LinkDashboard-Autostart'
$logonTaskName = 'LinkDashboard-LogonTask'
$projectRoot = Split-Path -Path $PSScriptRoot -Parent
$startScript = Join-Path $PSScriptRoot 'start-dashboard.ps1'
$taskCommand = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""

$escapedTaskCommand = $taskCommand.Replace('"', '""')
$createCmd = "schtasks /Create /TN `"$taskName`" /SC ONLOGON /RL LIMITED /TR `"$escapedTaskCommand`" /F >nul 2>nul"
cmd.exe /c $createCmd | Out-Null

if ($LASTEXITCODE -eq 0) {
	Write-Host "Autostart eingerichtet (Task): $taskName"
	exit 0
}

$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startupFile = Join-Path $startupDir 'LinkDashboard-Autostart.cmd'
$content = "@echo off`r`ncd /d `"$projectRoot`"`r`npowershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`" -NoBrowser`r`n"
Set-Content -Path $startupFile -Value $content -Encoding Ascii

try {
	$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`" -NoBrowser"
	$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
	$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
	Register-ScheduledTask -TaskName $logonTaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
	Write-Host "Zusätzlicher Login-Task eingerichtet: $logonTaskName"
} catch {
	Write-Host "Hinweis: Login-Task konnte nicht eingerichtet werden: $($_.Exception.Message)"
}

Write-Host "Autostart eingerichtet (Startup-Ordner): $startupFile"
