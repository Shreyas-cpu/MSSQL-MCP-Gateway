# Project: MSSQL MCP Gateway & Live Change Dashboard

## Overview
Connect the remote Microsoft SQL Server (`hcp.developeradda.com:4431`, user `sa`, database `TG_2024`) to the `MCP System` repository, enabling Cursor (via Model Context Protocol) to seamlessly inspect, query, and manipulate database tables. Concurrently, provide a real-time live dashboard (`localhost:3000`) where developers can visually observe every query, modification, execution latency, and affected row count executed by Cursor.

## Architecture & Technology Stack
- **Database Engine**: Microsoft SQL Server 2025 (Standard Developer Edition, Port 4431)
- **Database Target**: `TG_2024` (with access to `master`, `tempdb`, `msdb`)
- **Protocol**: Model Context Protocol (MCP) over Stdio Transport
- **MCP Runtime**: Node.js + TypeScript + `@modelcontextprotocol/sdk`
- **Database Driver**: `mssql` (Node.js Tedious wrapper) with connection pooling and SSL/TLS certificate bypass
- **Audit & Event Layer**: File-backed append-only audit logger (`audit-logs/*.jsonl`) + in-memory Event Emitter
- **Streaming Protocol**: Server-Sent Events (SSE) or WebSockets on Express dashboard server
- **Web Dashboard**: Modern HTML5 / TailwindCSS / Vanilla JS with auto-reconnecting live stream and SQL formatting
- **AI Client**: Cursor AI Editor / Composer (`~/.cursor/mcp.json`)

## Key Objectives
1. **Full Database Interactivity**: Allow Cursor to autonomously list tables, inspect schema/data types, run `SELECT` queries, and execute `INSERT`/`UPDATE`/`DELETE`/`CREATE` statements.
2. **Safety & Guardrails**: Add parameterization, transaction support, and query classification (read vs write) to prevent accidental data corruption.
3. **Live Observability**: Build a dedicated real-time live changes panel in the dashboard displaying each statement executed by Cursor as it happens, with execution duration, affected rows, and status indicators.
4. **Seamless Cursor Configuration**: Provide zero-friction Cursor MCP setup via direct configuration scripts and documentation.
