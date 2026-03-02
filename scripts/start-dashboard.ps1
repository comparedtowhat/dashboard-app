param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

function Write-Log {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -Path $script:LogFile -Value $line
}

function Resolve-NpmPath {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCmd) { return $npmCmd.Source }
  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\\npm.cmd'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\\npm.cmd')
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

function Resolve-NodePath {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) { return $nodeCmd.Source }
  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\\node.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\\node.exe')
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

function Test-ListeningPort {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $listener
}

$projectRoot = Split-Path -Path $PSScriptRoot -Parent
Set-Location $projectRoot

$logDir = Join-Path $env:LOCALAPPDATA 'LinkDashboard'
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$script:LogFile = Join-Path $logDir 'autostart.log'
Write-Log '--- start-dashboard.ps1 started ---'
Write-Log "ProjectRoot=$projectRoot"

$npmPath = Resolve-NpmPath
$nodePath = Resolve-NodePath

if (-not $nodePath) {
  Write-Log 'Node wurde nicht gefunden. Abbruch.'
  exit 1
}

if (-not $npmPath) {
  Write-Log 'npm wurde nicht gefunden. npm install wird übersprungen.'
}

if ((-not (Test-Path (Join-Path $projectRoot 'node_modules'))) -and $npmPath) {
  Write-Log 'node_modules fehlt, starte npm install.'
  & $npmPath install | Out-Null
}

if (Test-ListeningPort -Port 3000) {
  Write-Log 'Port 3000 ist bereits belegt. Kein neuer Start erforderlich.'
  if (-not $NoBrowser) {
    Start-Process 'http://localhost:3000'
  }
  exit 0
}

Write-Log "Starte Server mit Node: $nodePath"
Start-Process -FilePath $nodePath -ArgumentList 'server.js' -WorkingDirectory $projectRoot -WindowStyle Hidden

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-ListeningPort -Port 3000) {
    Write-Log 'Port 3000 ist aktiv. Start erfolgreich.'
    if (-not $NoBrowser) {
      Start-Process 'http://localhost:3000'
    }
    exit 0
  }
}

Write-Log 'Server hat Port 3000 nicht rechtzeitig geöffnet.'
exit 1
