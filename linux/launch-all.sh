#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "===================================================="
echo "  SAP-MCP Intelligence Gateway"
echo "  Full System Launcher (Linux)"
echo "===================================================="
echo ""

cd "$PROJECT_ROOT"

# 1. Build if necessary
echo "[1/4] Checking build artifacts..."
if [ ! -f "$PROJECT_ROOT/dist/index.js" ] || [ ! -f "$PROJECT_ROOT/dist/dashboard-server.js" ]; then
    echo "  Compiling TypeScript gateway & dashboard..."
    npm run build
fi

if [ ! -f "$PROJECT_ROOT/btp-mock-service/dist/server.js" ]; then
    echo "  Compiling btp-mock-service..."
    npm --prefix "$PROJECT_ROOT/btp-mock-service" run build
fi

# 2. Start BTP Mock Service
echo "[2/4] Starting SAP BTP Mock Service (port 4004)..."
fuser -k 4004/tcp 2>/dev/null || true
setsid node "$PROJECT_ROOT/btp-mock-service/dist/server.js" > "$PROJECT_ROOT/btp-service.log" 2>&1 &
sleep 1

# 3. Start Dashboard Server
echo "[3/4] Starting Dashboard Server (port 3000)..."
fuser -k 3000/tcp 2>/dev/null || true
setsid node "$PROJECT_ROOT/dist/dashboard-server.js" > "$PROJECT_ROOT/dashboard.log" 2>&1 &
sleep 1

# 4. Open in browser if xdg-open exists and display is set
echo "[4/4] Opening Web Dashboard..."
if command -v xdg-open > /dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    xdg-open "http://localhost:3000" > /dev/null 2>&1 &
fi

echo ""
echo "----------------------------------------------------"
echo "All systems running!"
echo ""
echo "  Dashboard Server  : http://localhost:3000"
echo "  BTP Mock Service  : http://localhost:4004"
echo "  MCP stdio Server  : node dist/index.js"
echo ""
echo "Helpful scripts in linux/:"
echo "  ./linux/monitor-status.sh    - Live system status"
echo "  ./linux/monitor-logs.sh      - Tail MCP tool calls"
echo "  ./linux/start-inspector.sh   - Launch MCP Inspector"
echo "  ./linux/shutdown-all.sh      - Stop all services"
echo "----------------------------------------------------"
