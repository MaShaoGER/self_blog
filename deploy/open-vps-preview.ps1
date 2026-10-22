param(
  [Parameter(Mandatory = $true)]
  [string]$SshHostName,
  [string]$SshUserName = "root",
  [int]$SshPort = 22,
  [int]$LocalPort = 9443,
  [string]$IdentityFile = "$env:USERPROFILE\.ssh\id_ed25519"
)

$ErrorActionPreference = "Stop"
$sshArgs = @(
  "-i", $IdentityFile, "-p", "$SshPort",
  "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
  "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30",
  "-N", "-L", "127.0.0.1:${LocalPort}:127.0.0.1:9443",
  "${SshUserName}@${SshHostName}"
)
Write-Host "Preview: https://localhost:$LocalPort"
Write-Host "Keep this terminal open. Press Ctrl+C to close the SSH tunnel."
& ssh @sshArgs
exit $LASTEXITCODE
