@echo off
title SAP-MCP :: MCP Inspector
color 0D
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   SAP·MCP Intelligence Gateway                  ║
echo  ║   MCP Inspector — Interactive Tool Testing       ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  Launching MCP Inspector UI...
echo  This opens a browser-based tool to test all 12 SAP tools.
echo  ─────────────────────────────────────────────────
echo.
cd /d "D:\Projects\MCP System"
npx @modelcontextprotocol/inspector npx tsx src/index.ts
pause
