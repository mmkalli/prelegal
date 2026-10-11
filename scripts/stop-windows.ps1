# Stops Prelegal and removes its container (and with it the temporary database).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

docker compose down
if ($LASTEXITCODE -ne 0) { throw "docker compose down failed (exit code $LASTEXITCODE)" }
Write-Host "Prelegal stopped."
