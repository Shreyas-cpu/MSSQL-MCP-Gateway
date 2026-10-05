#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

while true; do
    clear
    echo "===================================================="
    echo "  SAP-MCP Intelligence Gateway - System Status"
    echo "===================================================="
    echo ""
    echo "  TIME: $(date)"
    echo "  ----------------------------------------------------"
    echo ""

    # Check Dashboard (:3000)
    if curl -s --max-time 2 http://localhost:3000/api/purchase-orders > /dev/null 2>&1; then
        echo -e "  [DASHBOARD]     \x1b[32mONLINE\x1b[0m   http://localhost:3000"
    else
        echo -e "  [DASHBOARD]     \x1b[31mOFFLINE\x1b[0m"
    fi

    # Check BTP Mock Service (:4004)
    if curl -s --max-time 2 http://localhost:4004/health > /dev/null 2>&1; then
        echo -e "  [BTP SERVICE]   \x1b[32mONLINE\x1b[0m   http://localhost:4004"
    else
        echo -e "  [BTP SERVICE]   \x1b[31mOFFLINE\x1b[0m"
    fi

    # Check Node processes
    PROCS=$(pgrep -f "node dist/(server|dashboard-server|index)\.js" | wc -l)
    if [ "$PROCS" -gt 0 ]; then
        echo -e "  [NODE PROCS]    \x1b[32m$PROCS running\x1b[0m"
    else
        echo -e "  [NODE PROCS]    \x1b[31mNone running\x1b[0m"
    fi

    # Check Audit Log entries
    TODAY=$(date +%Y-%m-%d)
    LOGFILE="$PROJECT_ROOT/audit-logs/audit-${TODAY}.jsonl"
    if [ -f "$LOGFILE" ]; then
        LINES=$(wc -l < "$LOGFILE")
        echo -e "  [AUDIT LOG]     \x1b[33m$LINES entries today\x1b[0m"
    else
        echo -e "  [AUDIT LOG]     No entries today"
    fi

    # Project disk usage excluding node_modules
    SIZE=$(du -sh --exclude='node_modules' "$PROJECT_ROOT" 2>/dev/null | awk '{print $1}')
    echo -e "  [PROJECT SIZE]  \x1b[36m$SIZE\x1b[0m (excl. node_modules)"

    echo ""
    echo "  ----------------------------------------------------"
    echo "  API ENDPOINTS:"
    echo "   GET /api/purchase-orders     GET /api/vendors"
    echo "   GET /api/inventory           GET /api/sales-orders"
    echo "   GET /api/open-items          GET /api/budget-variance"
    echo "   GET /api/work-orders         GET /api/delivery-status"
    echo "   GET /api/pending-approvals   GET /api/report"
    echo "   POST /api/approve            GET /api/audit-log"
    echo ""
    echo "  ----------------------------------------------------"
    echo "  Refreshing in 10 seconds... (Press Ctrl+C to exit)"
    sleep 10
done
