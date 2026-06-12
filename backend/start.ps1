# Run API from this folder so imports and reload use the correct server.py
$here = $PSScriptRoot
Set-Location $here
Write-Host "SuruAhai API - $(Get-Location)"

# Stop stale uvicorn instances still bound to 8001 (they block reload and serve old code)
$port = 8001
for ($attempt = 0; $attempt -lt 5; $attempt++) {
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne 0 })
    if (-not $listeners.Count) { break }
    foreach ($procId in $listeners) {
        Write-Host ("Stopping stale process on port {0}: PID {1}" -f $port, $procId)
        taskkill /F /PID $procId /T 2>$null | Out-Null
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

python -m uvicorn server:app --host 127.0.0.1 --port $port --reload
