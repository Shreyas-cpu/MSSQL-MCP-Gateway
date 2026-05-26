@echo off
title SAP-MCP :: Full System Launcher
color 0B
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway
echo    Full System Launcher
echo  ====================================================
echo.
echo  Launching all system components in separate windows...
echo  ----------------------------------------------------
echo.

cd /d "D:\Projects\MCP System"

:: 1. Dashboard Server
echo  [1/4] Starting Dashboard Server...
start "SAP-MCP Dashboard" cmd /k "cd /d D:\Projects\MCP System && title SAP-MCP :: Dashboard Server && color 0B && echo. && echo  Dashboard starting on http://localhost:3000 && echo. && npx tsx src/dashboard-server.ts"
timeout /t 3 /nobreak >nul

:: 2. Audit Log Monitor
echo  [2/4] Starting Audit Log Monitor...
start "SAP-MCP Audit Monitor" "D:\Projects\MCP System\monitor-logs.bat"
timeout /t 1 /nobreak >nul

:: 3. System Status Monitor
echo  [3/4] Starting System Status Monitor...
start "SAP-MCP Status" "D:\Projects\MCP System\monitor-status.bat"
timeout /t 1 /nobreak >nul

:: 4. Open Dashboard in browser
echo  [4/4] Opening Dashboard in browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo  ----------------------------------------------------
echo  All systems launched!
echo.
echo  WINDOWS OPEN:
echo   [Cyan]    Dashboard Server    - http://localhost:3000
echo   [Yellow]  Audit Log Monitor   - Live MCP tool call stream
echo   [White]   Status Monitor      - System health dashboard
echo   [Browser] Web Dashboard       - Interactive SAP data
echo.
echo  To also test tools interactively, run:
echo   start-inspector.bat
echo.
echo  Press any key to close this launcher window...
pause >nul
