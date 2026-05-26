@echo off
title SAP-MCP :: Live Audit Log Monitor
color 0E
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway
echo    Live MCP Communication Log
echo  ====================================================
echo.
echo  Monitoring audit-logs/ for new MCP tool invocations...
echo  Each line = one tool call (timestamp, tool, params, result)
echo  ----------------------------------------------------
echo.

cd /d "D:\Projects\MCP System"

:: Create audit-logs directory if it doesn't exist
if not exist "audit-logs" mkdir "audit-logs"

:: Get today's date for the log filename
for /f "tokens=1-3 delims=-" %%a in ('%SystemRoot%\System32\wbem\wmic.exe os get localdatetime ^| find "."') do (
    set "dt=%%a"
)
set "YEAR=%dt:~0,4%"
set "MONTH=%dt:~4,2%"
set "DAY=%dt:~6,2%"
set "LOGFILE=audit-logs\audit-%YEAR%-%MONTH%-%DAY%.jsonl"

echo  Log file: %LOGFILE%
echo  ----------------------------------------------------
echo.

:: If the file doesn't exist yet, create it
if not exist "%LOGFILE%" (
    echo. > "%LOGFILE%"
    echo  [Waiting for first MCP tool call...]
    echo.
)

:: Tail the log file using PowerShell (live monitoring)
powershell -Command "Get-Content '%LOGFILE%' -Wait -Tail 0 | ForEach-Object { $obj = $_ | ConvertFrom-Json -ErrorAction SilentlyContinue; if($obj) { $time = $obj.timestamp.Substring(11,8); $tool = $obj.tool.PadRight(25); $res = $obj.result; $dur = $obj.durationMs; Write-Host \"[$time]\" -NoNewline -ForegroundColor DarkGray; Write-Host \" $tool\" -NoNewline -ForegroundColor Yellow; if($res -eq 'success'){Write-Host \" OK\" -NoNewline -ForegroundColor Green} else {Write-Host \" ERR\" -NoNewline -ForegroundColor Red}; Write-Host \" ${dur}ms\" -ForegroundColor DarkGray } else { Write-Host $_ -ForegroundColor DarkGray } }"

pause
