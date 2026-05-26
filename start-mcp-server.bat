@echo off
title SAP-MCP :: MCP Server (stdio)
color 0A
echo.
echo  ====================================================
echo    SAP-MCP Intelligence Gateway
echo    MCP Server - stdio transport
echo  ====================================================
echo.
echo  This runs the MCP server in stdio mode.
echo  Connect via Claude Desktop or MCP Inspector.
echo  ----------------------------------------------------
echo.
cd /d "D:\Projects\MCP System"
npx tsx src/index.ts
pause
