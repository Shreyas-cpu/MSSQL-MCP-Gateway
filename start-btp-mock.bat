@echo off
echo ╔══════════════════════════════════════════════╗
echo ║   Starting SAP BTP Mock OData V4 Service    ║
echo ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0btp-mock-service"
npx tsx src/server.ts
