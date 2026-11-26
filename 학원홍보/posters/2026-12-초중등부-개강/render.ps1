# poster.html 을 PNG로 뽑습니다. 사용법: 이 폴더에서  powershell -File render.ps1
#   out/insta.png : 1080x1350 (인스타 피드 4:5)
#   out/a4.png    : 2480x3508 (A4 세로, 300dpi 인쇄용)
$ErrorActionPreference = 'Continue'  # Edge가 무해한 경고를 stderr로 내보내므로 Stop 금지
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
$out = Join-Path $here 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$url = ([Uri](Join-Path $here 'poster.html')).AbsoluteUri

$jobs = @(
  @{ name = 'insta'; w = 1080; h = 1350; scale = '1' },
  @{ name = 'a4';    w = 1080; h = 1528; scale = '2.2963' }
)
foreach ($j in $jobs) {
  $png = Join-Path $out "$($j.name).png"
  $profile = Join-Path $env:TEMP "tnb-poster-edge-$($j.name)"
  & $edge --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files `
    "--user-data-dir=$profile" "--force-device-scale-factor=$($j.scale)" `
    "--window-size=$($j.w),$($j.h)" "--screenshot=$png" --virtual-time-budget=3000 `
    "$url`?size=$($j.name)" 2>$null | Out-Null
  Start-Sleep -Milliseconds 300
  Write-Output "$($j.name): $png"
}
