$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $root

function Copy-IfMissing($source, $target) {
  if (-not (Test-Path $target)) { Copy-Item $source $target }
}

Copy-IfMissing ".env.example" ".env"
Copy-IfMissing "backend/.env.example" "backend/.env"
Copy-IfMissing "frontend/.env.example" "frontend/.env"

$envPath = Join-Path $root ".env"
$envText = Get-Content $envPath -Raw
if ($envText -notmatch "(?m)^POSTGRES_PASSWORD=(?!change-me$).+") {
  $password = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 })).TrimEnd("=").Replace("+","-").Replace("/","_")
  Add-Content $envPath "`nPOSTGRES_PASSWORD=$password`nS3_SECRET_KEY=$password"
}

docker compose --env-file .env -f docker-compose.selfhost.yml up -d --build
docker compose --env-file .env -f docker-compose.selfhost.yml ps
Write-Host "Chatty is starting at http://localhost:3000"
