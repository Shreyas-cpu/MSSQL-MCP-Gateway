#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BTP_DIR="$PROJECT_ROOT/btp-mock-service"

echo "===================================================="
echo "  SAP BTP Mock OData V4 Service"
echo "  Starting on http://localhost:4004"
echo "===================================================="
echo ""

cd "$BTP_DIR"

if [ ! -f "dist/server.js" ] || [ "src/server.ts" -nt "dist/server.js" ]; then
    echo "  Building btp-mock-service..."
    npm run build
fi

node dist/server.js
