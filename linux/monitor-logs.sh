#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "===================================================="
echo "  SAP-MCP Intelligence Gateway"
echo "  Live MCP Audit Log Monitor"
echo "===================================================="
echo ""

cd "$PROJECT_ROOT"

mkdir -p audit-logs
TODAY=$(date +%Y-%m-%d)
LOGFILE="$PROJECT_ROOT/audit-logs/audit-${TODAY}.jsonl"

echo "  Log file: $LOGFILE"
echo "  ----------------------------------------------------"
echo ""

touch "$LOGFILE"

# Tail log file and format JSON entries with colors
tail -n 0 -f "$LOGFILE" | while read -r line; do
    if [ -z "$line" ]; then
        continue
    fi
    node -e '
        try {
            const obj = JSON.parse(process.argv[1]);
            const time = obj.timestamp ? obj.timestamp.substring(11, 19) : "--:--:--";
            const tool = (obj.tool || "unknown").padEnd(25);
            const status = obj.result === "success" ? "\x1b[32mOK \x1b[0m" : "\x1b[31mERR\x1b[0m";
            const dur = obj.durationMs !== undefined ? `${obj.durationMs}ms` : "";
            console.log(`\x1b[90m[${time}]\x1b[0m \x1b[33m${tool}\x1b[0m ${status} \x1b[90m${dur}\x1b[0m`);
        } catch {
            console.log(process.argv[1]);
        }
    ' "$line"
done
