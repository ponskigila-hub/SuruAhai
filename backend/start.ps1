# Run API from this folder so imports and reload use the correct server.py
$here = $PSScriptRoot
Set-Location $here
Write-Host "SuruAhai API — $(Get-Location)"
python server.py
