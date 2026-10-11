# Builds and starts Prelegal in Docker at http://localhost:8000.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    Write-Warning "No .env file found; copy .env.example to .env and add your keys."
}

docker compose up --build --detach
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed (exit code $LASTEXITCODE)" }
Write-Host "Prelegal is running at http://localhost:8000"
