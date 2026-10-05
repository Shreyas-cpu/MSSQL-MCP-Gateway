# Requirements Specification: MSSQL MCP Gateway & Live Dashboard

## 1. Functional Requirements

### 1.1 MSSQL Connection & Driver
- **FR-1**: Install `mssql` and `@types/mssql` packages in `MCP System`.
- **FR-2**: Implement `MssqlAdapter` connecting to `hcp.developeradda.com:4431` with username `sa`, password `dev@1979`, and default database `TG_2024`.
- **FR-3**: Support connection pooling, automatic reconnection, and `trustServerCertificate: true` for TLS negotiation.
- **FR-4**: Allow dynamic database selection or query across databases (`USE <database>` or database parameter).

### 1.2 MCP Tools for Cursor
- **FR-5**: Tool `mssql_list_tables`: Lists all schemas, tables, and views with row counts.
- **FR-6**: Tool `mssql_describe_table`: Returns columns, data types, nullability, primary keys, and foreign key relationships.
- **FR-7**: Tool `mssql_read_query`: Runs read-only queries (`SELECT`, `SHOW`, `EXEC` read sprocs) with row limit caps.
- **FR-8**: Tool `mssql_execute_statement`: Runs DML/DDL queries (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`) and returns affected row counts.
- **FR-9**: Tool `mssql_show_databases`: Lists all databases available to the `sa` login.

### 1.3 Audit Logging & Real-Time Event Dispatch
- **FR-10**: Every MCP tool execution must be recorded by `AuditLogger` with timestamp, client ID (`cursor-agent`), SQL statement, execution time, and outcome (`success` or `error`).
- **FR-11**: Implement an EventEmitter in the audit logger to push events immediately to connected SSE/WebSocket clients.
- **FR-12**: Expose `/api/events` (Server-Sent Events) in `dashboard-server.ts` for live real-time pushing.

### 1.4 Live Changes Dashboard
- **FR-13**: Add a dedicated "Live Database Activity & AI Changes" view to the dashboard.
- **FR-14**: Display incoming queries in real-time without page refresh.
- **FR-15**: Provide badges for query types (`READ`, `INSERT`, `UPDATE`, `DELETE`, `DDL`).
- **FR-16**: Show detailed cards with formatted SQL code, affected rows, status badge, duration, and timestamp.
- **FR-17**: Provide a manual query runner tab for developers to test queries side-by-side.

### 1.5 Cursor Integration
- **FR-18**: Provide Cursor configuration snippet for `~/.cursor/mcp.json` and project-level `.cursor/mcp.json`.
- **FR-19**: Test Cursor tool execution with sample read and write operations.

---

## 2. Non-Functional Requirements
- **NFR-1 (Latency)**: MCP tool response time < 500ms for standard single-row/table queries.
- **NFR-2 (Reliability)**: Connection drops must automatically reconnect without crashing the MCP stdio pipe.
- **NFR-3 (Audit Trail)**: All modifications made by AI agents must be immutably recorded in `audit-logs/*.jsonl`.
- **NFR-4 (Security)**: Disallow multiple destructive statements in a single batch without explicit intention.
