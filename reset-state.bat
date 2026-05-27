@echo off
title SAP-MCP :: Reset System State
color 0C
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway
echo    Reset State and Audit Logs
echo  ====================================================
echo.
echo  This will delete all persistent mock state and logs.
echo  Make sure you have run shutdown-all.bat first!
echo.
set /p confirm="Are you sure you want to reset? (Y/N): "
if /i "%confirm%" neq "Y" (
    echo  Aborted.
    pause
    exit /b
)

echo.
echo  Stopping Node.js processes just in case...
taskkill /f /im node.exe >nul 2>nul

echo  Deleting persistent files...
if exist "audit-logs" (
    del /q "audit-logs\*.*"
    echo  [OK] Persistent state and logs deleted.
) else (
    echo  [--] No persistent files found.
)

echo.
echo  State reset successfully!
echo  Run launch-all.bat and restart Claude Desktop to start fresh.
echo.
pause
