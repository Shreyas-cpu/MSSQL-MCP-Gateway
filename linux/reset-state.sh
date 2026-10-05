#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "===================================================="
echo "  SAP-MCP Intelligence Gateway"
echo "  Reset State and Audit Logs"
echo "===================================================="
echo ""
echo "  This will delete all persistent mock state and logs."
echo ""

read -r -p "  Are you sure you want to reset? (y/N): " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "  Aborted."
    exit 0
fi

echo ""
echo "  Stopping services..."
"$SCRIPT_DIR/shutdown-all.sh" > /dev/null 2>&1 || true

echo "  Deleting audit logs and persisted state..."
if [ -d "$PROJECT_ROOT/audit-logs" ]; then
    rm -rf "$PROJECT_ROOT/audit-logs"/*
    echo "  [OK] Cleared audit-logs directory."
fi

if [ -f "$PROJECT_ROOT/btp-mock-service/db/state.json" ]; then
    rm -f "$PROJECT_ROOT/btp-mock-service/db/state.json"
    echo "  [OK] Removed persisted BTP state.json."
fi

echo ""
echo "  State reset successfully!"
echo "  Run ./linux/launch-all.sh to start fresh."
echo ""
