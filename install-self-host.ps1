$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
if (-not (Test-Path "backend/.env")) { Copy-Item "backend/.env.example" "backend/.env" }
if (-not (Test-Path "frontend/.env")) { Copy-Item "frontend/.env.example" "frontend/.env" }

docker compose --env-file .env up -d --build
docker compose --env-file .env ps
Write-Host "Chatty is starting at http://localhost:3000"
