#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "===================================================="
echo "  SAP-MCP Intelligence Gateway"
echo "  Starting Dashboard on http://localhost:3000"
echo "===================================================="
echo ""

cd "$PROJECT_ROOT"

if [ ! -f "dist/dashboard-server.js" ] || [ "src/dashboard-server.ts" -nt "dist/dashboard-server.js" ]; then
    echo "  Building project..."
    npm run build
fi

node dist/dashboard-server.js
