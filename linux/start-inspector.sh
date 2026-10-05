#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "===================================================="
echo "  SAP-MCP Intelligence Gateway"
echo "  Starting MCP Inspector (Interactive Testing)"
echo "===================================================="
echo ""

cd "$PROJECT_ROOT"

if [ ! -f "dist/index.js" ] || [ "src/index.ts" -nt "dist/index.js" ]; then
    echo "  Building project..."
    npm run build
fi

npx @modelcontextprotocol/inspector node dist/index.js
