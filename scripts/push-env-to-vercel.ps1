# Pushes every variable in an env file to a Vercel environment.
#
#   npm i -g vercel
#   vercel login
#   vercel link                 # once, to connect this folder to the project
#   .\scripts\push-env-to-vercel.ps1
#
# Existing values are replaced, so it is safe to run again after editing.

param(
  [string]$EnvFile = ".env.vercel.local",
  [ValidateSet("production", "preview", "development")]
  [string]$Target = "production"
)

if (-not (Test-Path $EnvFile)) {
  Write-Error "$EnvFile not found. Run this from the project root."
  exit 1
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }

  $i = $line.IndexOf("=")
  if ($i -lt 1) { return }

  $key = $line.Substring(0, $i).Trim()
  $value = $line.Substring($i + 1).Trim().Trim('"')

  if (-not $value) {
    Write-Host "skip  $key (empty)" -ForegroundColor DarkGray
    return
  }

  # Remove first: `vercel env add` refuses to overwrite an existing name.
  vercel env rm $key $Target --yes *> $null

  $value | vercel env add $key $Target *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "set   $key" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $key" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Done. Now redeploy so the new values are baked in:" -ForegroundColor Cyan
Write-Host "  vercel --prod"
