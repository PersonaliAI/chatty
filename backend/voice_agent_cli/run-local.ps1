param(
    [ValidateSet("doctor", "schema", "account", "list-tools", "console", "dev", "start", "connect", "token")]
    [string]$Command = "doctor",
    [string]$ServiceAccountPath = "D:\Documents\personaliai-ed1f909e0d2a.json",
    [string]$Room = "",
    [string]$Identity = ""
)

$ErrorActionPreference = "Stop"
$backendPath = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path
$agentsRoot = "D:\Documents\_personaliai\agents-main\agents-main"
$pythonPath = Join-Path $agentsRoot ".venv\Scripts\python.exe"
$googleProject = "personaliai"
$chattySupabaseProjectRef = "dckjbkcormifiuwfpahj"

function Import-DotEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([^#=][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            if ($name -eq "SUPABASE_SERVICE_ROLE_KEY") {
                $name = "SUPABASE_SECRET_KEY"
            }
            if ($name -in @(
                "GOOGLE_CLOUD_PROJECT",
                "GOOGLE_CLOUD_LOCATION", "LIVEKIT_URL", "LIVEKIT_API_KEY",
                "LIVEKIT_API_SECRET", "VOICE_LLM_MODEL", "VOICE_LLM_TIMEOUT_SECONDS",
                "VOICE_STT_MODEL", "VOICE_STT_LANGUAGE",
                "VOICE_STT_LOCATION", "VOICE_TTS_MODEL", "VOICE_TTS_VOICE",
                "VOICE_TTS_LOCATION"
            )) {
                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }
}

Import-DotEnv "D:\Documents\_personaliai\kin-backend\.env"
Import-DotEnv "D:\Documents\_personaliai\kin-voice-worker\.env"
Import-DotEnv "D:\Documents\_personaliai\agents-main\agents-main\examples\.env"
Import-DotEnv (Join-Path $PSScriptRoot ".env.livekit.local")

# Do not inherit the Kin project's Vertex consumer from the convenience env
# files above. The provided ADC service account belongs to personaliai.
$env:GOOGLE_CLOUD_PROJECT = $googleProject

$gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCommand) {
    throw "gcloud is required to load Chatty Supabase secrets from Google Secret Manager"
}

function Read-GoogleSecret([string]$SecretName) {
    $value = & $gcloudCommand.Source secrets versions access latest `
        --secret=$SecretName --project=$googleProject --quiet 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $value) {
        throw "Could not read Google Secret Manager secret: $SecretName"
    }
    return ($value -join "`n").Trim()
}

# The Chatty frontend and database use this Supabase project. Do not inherit
# SUPABASE_* values from the Kin environment files above; that silently points
# local voice commands at the wrong tenant database.
$env:SUPABASE_URL = "https://$chattySupabaseProjectRef.supabase.co"
# Chatty disabled its legacy anon/service_role JWT keys on 2026-09-19. Use
# the current Supabase Secret Key from Secret Manager instead.
$env:SUPABASE_SECRET_KEY = Read-GoogleSecret "chatty-supabase-secret-key"

if (-not (Test-Path -LiteralPath $ServiceAccountPath)) {
    throw "ADC service-account JSON was not found: $ServiceAccountPath"
}
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "LiveKit Agents workspace Python was not found: $pythonPath"
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $ServiceAccountPath
$env:GOOGLE_GENAI_USE_VERTEXAI = "true"

Push-Location $backendPath
try {
    $cliArgs = @($Command)
    if ($Command -eq "connect") {
        if (-not $Room) {
            throw "-Room is required when -Command connect is used"
        }
        $cliArgs += @("--room", $Room)
        if ($Identity) {
            $cliArgs += @("--identity", $Identity)
        }
    } elseif ($Command -eq "token") {
        if (-not $Room -or -not $Identity) {
            throw "-Room and -Identity are required when -Command token is used"
        }
        $cliArgs += @("--room", $Room, "--identity", $Identity)
    }
    & $pythonPath -m voice_agent_cli @cliArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
