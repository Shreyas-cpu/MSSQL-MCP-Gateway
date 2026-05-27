@echo off
title SAP-MCP :: Dashboard Server
color c
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway
echo    Dashboard Server
echo  ====================================================
echo.
echo  Starting Express dashboard on http://localhost:3000
echo  Adapter: MockERPAdapter
echo  ----------------------------------------------------
echo.
cd /d "D:\Projects\MCP System"
npx tsx src/dashboard-server.ts
