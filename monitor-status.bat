@echo off
title SAP-MCP :: System Status Monitor
color 0F

cd /d "D:\Projects\MCP System"

:loop
cls
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway - System Status
echo  ====================================================
echo.

:: Current time
echo  TIME: %date% %time%
echo  ----------------------------------------------------

:: Check Dashboard Server (port 3000)
echo.
powershell -Command "$r = $null; try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/purchase-orders' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; Write-Host '  [DASHBOARD]     ' -NoNewline; Write-Host 'ONLINE' -ForegroundColor Green -NoNewline; Write-Host '   http://localhost:3000' } catch { Write-Host '  [DASHBOARD]     ' -NoNewline; Write-Host 'OFFLINE' -ForegroundColor Red }"

:: Check active connections on port 3000
echo.
powershell -Command "$conns = (netstat -an 2>$null | Select-String ':3000.*ESTABLISHED').Count; Write-Host '  [CONNECTIONS]   ' -NoNewline; Write-Host \"$conns active\" -ForegroundColor Cyan -NoNewline; Write-Host ' clients on port 3000'"

:: Check Node processes
echo.
powershell -Command "$procs = Get-Process -Name 'node' -ErrorAction SilentlyContinue; if($procs){ Write-Host '  [NODE PROCS]    ' -NoNewline; Write-Host \"$($procs.Count) running\" -ForegroundColor Green -NoNewline; $mem = [math]::Round(($procs | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1); Write-Host \" ($mem MB total)\" } else { Write-Host '  [NODE PROCS]    ' -NoNewline; Write-Host 'None' -ForegroundColor Red }"

:: Check audit log entries today
echo.
for /f "tokens=1-3 delims=-" %%a in ('%SystemRoot%\System32\wbem\wmic.exe os get localdatetime ^| find "."') do set "dt=%%a"
set "Y=%dt:~0,4%"
set "M=%dt:~4,2%"
set "D=%dt:~6,2%"
set "LF=audit-logs\audit-%Y%-%M%-%D%.jsonl"
if exist "%LF%" (
    powershell -Command "$lines = (Get-Content '%LF%' -ErrorAction SilentlyContinue | Measure-Object).Count; Write-Host '  [AUDIT LOG]     ' -NoNewline; Write-Host \"$lines entries today\" -ForegroundColor Yellow"
) else (
    echo   [AUDIT LOG]     No entries today
)

:: Disk usage of project
echo.
powershell -Command "$size = [math]::Round((Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike '*node_modules*' } | Measure-Object Length -Sum).Sum / 1KB, 1); Write-Host '  [PROJECT SIZE]  ' -NoNewline; Write-Host \"$size KB\" -ForegroundColor Cyan -NoNewline; Write-Host ' (excl. node_modules)'"

echo.
echo  ----------------------------------------------------
echo  API ENDPOINTS:
echo   GET /api/purchase-orders     GET /api/vendors
echo   GET /api/inventory           GET /api/sales-orders
echo   GET /api/open-items          GET /api/budget-variance
echo   GET /api/work-orders         GET /api/delivery-status
echo   GET /api/pending-approvals   GET /api/report
echo   POST /api/approve            GET /api/audit-log
echo.
echo  ----------------------------------------------------
echo  Refreshing in 10 seconds... (Press Ctrl+C to exit)

timeout /t 10 /nobreak >nul
goto loop
