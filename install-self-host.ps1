$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

# This installer is deliberately isolated from the managed Supabase compose
# path. It starts the portable backend, database, queue, object store, and
# webhook worker only; the existing hosted frontend remains untouched.
$envFile = "backend/.env.self-host"
if (-not (Test-Path $envFile)) {
    Copy-Item "backend/env.self-host.example" $envFile
    Write-Host "Created $envFile. Replace every replace-with-* value, then run this script again." -ForegroundColor Yellow
    exit 1
}

$unconfigured = Select-String -Path $envFile -Pattern "replace-with-" -Quiet
if ($unconfigured) {
    throw "$envFile still contains replace-with-* placeholders. Fill secrets/OIDC values before starting."
}

docker compose --env-file $envFile -f backend/docker-compose.self-host.yml up -d --build
docker compose --env-file $envFile -f backend/docker-compose.self-host.yml ps
Write-Host "Chatty self-host API is starting at http://localhost:8080"
