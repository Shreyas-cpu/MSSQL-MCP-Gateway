#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "===================================================="
echo "  SAP-MCP Intelligence Gateway"
echo "  Shutdown All Services"
echo "===================================================="
echo ""

# Terminate processes on port 3000 and 4004
echo "  Stopping services on port 3000 and 4004..."
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 4004/tcp 2>/dev/null || true

# Kill background nodes launched from dist
PIDS=$(pgrep -f "node.*dist/(server|dashboard-server|index)\.js" || true)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "  [OK] Terminated background processes: $PIDS"
else
    echo "  [OK] No services were running."
fi

# Remove pid files if any exist
rm -f "$PROJECT_ROOT/.btp.pid" "$PROJECT_ROOT/.dashboard.pid"

echo ""
echo "  Done."
