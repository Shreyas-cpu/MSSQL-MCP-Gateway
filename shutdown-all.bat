@echo off
title SAP-MCP :: Shutdown
color 0C
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway
echo    Shutdown All Services
echo  ====================================================
echo.
echo  Stopping all Node.js processes...
echo.

taskkill /f /im node.exe 2>nul
if %errorlevel%==0 (
    echo  [OK] All Node processes terminated.
) else (
    echo  [--] No Node processes were running.
)

echo.
echo  Done. Press any key to exit.
pause >nul
