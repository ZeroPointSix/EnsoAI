$runId = "26760423424"
$repo = "ZeroPointSix/EnsoAI"
$log = "E:\hushaokang\Data-code\Enso\EnsoAI\.build-watch-26760423424.txt"

for ($i = 0; $i -lt 30; $i++) {
  $json = gh run view $runId --repo $repo --json status,conclusion,url 2>&1 | Out-String
  $obj = $json | ConvertFrom-Json
  $line = "$(Get-Date -Format o) status=$($obj.status) conclusion=$($obj.conclusion)"
  Set-Content -Path $log -Value $line -Encoding utf8
  if ($obj.status -eq "completed") {
    gh run view $runId --repo $repo 2>&1 | Add-Content -Path $log -Encoding utf8
    gh api "repos/$repo/actions/runs/$runId/artifacts" 2>&1 | Add-Content -Path $log -Encoding utf8
    break
  }
  Start-Sleep -Seconds 90
}
