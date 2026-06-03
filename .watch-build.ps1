$runId = "26758002729"
$repo = "ZeroPointSix/EnsoAI"
$wd = "E:\hushaokang\Data-code\Enso\EnsoAI"
$log = Join-Path $wd ".build-watch-result.txt"

for ($i = 0; $i -lt 40; $i++) {
  try {
    $json = gh run view $runId --repo $repo --json status,conclusion,url,displayTitle 2>&1 | Out-String
    $obj = $json | ConvertFrom-Json
    $line = "$(Get-Date -Format o) status=$($obj.status) conclusion=$($obj.conclusion) url=$($obj.url)"
    Set-Content -Path $log -Value $line -Encoding utf8
    if ($obj.status -eq "completed") {
      gh run view $runId --repo $repo 2>&1 | Add-Content -Path $log -Encoding utf8
      break
    }
  } catch {
  }
  Start-Sleep -Seconds 90
}
