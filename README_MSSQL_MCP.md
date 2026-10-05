# MSSQL MCP Gateway & Real-Time Live Monitor

Complete Model Context Protocol (MCP) gateway bridging **Microsoft SQL Server 2025** (`hcp.developeradda.com:4431`) with **Cursor AI**, accompanied by a real-time reactive web dashboard.

---

## 🛡️ Data Safety & Protection Protocol

The system has a **strict Read-Only Safety Guard (`readOnlyMode = true`)**:
- All write, modify, delete, and DDL queries (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `MERGE`, `CREATE`) are intercepted by the application safety guard before any network socket transmission.
- Cursor will receive an explicit `[SAFETY_LOCK]` block response without touching the database.
- Read operations (`SELECT`, `INFORMATION_SCHEMA`, database lists, table metadata) are fully operational.

---

## 🚀 Quick Start Guide

### 1. Launch the Live Dashboard & SSE Server
```bash
cd "/run/media/promethious/Personal/Projects/MCP System"
npm run dashboard
```
Open your browser to: **[http://localhost:3000](http://localhost:3000)**

### 2. What You Can See on the Dashboard
- **Top Bar**: Live connection dot (green pulse) and `🛡️ READ-ONLY LOCK` status badge.
- **Metrics Counter**: Real-time counters for Total Events, Read Queries, Mutations Attempted, and Blocked Queries.
- **Real-Time Activity Feed**: Streams every SQL query executed by Cursor with:
  - Color-coded operation badges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `BLOCKED`)
  - Execution duration in milliseconds
  - Caller identity tag (`Cursor AI`, `MCP Agent`, `dashboard_viewer`)
  - Full syntax-highlighted SQL statement with a "Copy SQL" button
- **TG_2024 Table Explorer**: Browse all 187 tables/views in `TG_2024` and preview the top rows with one click.

---

## 🤖 Using in Cursor AI

Cursor is pre-configured via `~/.cursor/mcp.json`. When Cursor opens:
1. The MCP Gateway automatically launches in the background via stdio transport.
2. Cursor has access to 21 tools, including the 5 MSSQL tools:
   - `mssql_list_databases`: Lists all online databases (`TG_2024`, `master`, `tempdb`, `model`, `msdb`).
   - `mssql_list_tables`: Lists all 187 tables and views with schema names and row estimates.
   - `mssql_describe_table`: Fetches column names, data types, nullability, and primary key flags.
   - `mssql_read_query`: Runs read-only queries with optional parameter bindings and row limits.
   - `mssql_execute_statement`: Mutation tool guarded by the safety lock.

### Sample Prompts to Try in Cursor

#### 1. Discover Databases & Tables
> *"Cursor, list all databases available on the MSSQL server."*  
> *"Cursor, what tables exist in TG_2024 related to customer orders or SOB?"*

#### 2. Inspect Table Schemas
> *"Cursor, describe the columns and primary keys of the ActivityOwner_SOB table."*

#### 3. Query Data
> *"Cursor, query the top 5 records from ActivityOwner_SOB for Customer_Code 'BAJAJ'."*

#### 4. Test Safety Guard
> *"Cursor, try running an UPDATE on ActivityOwner_SOB."*  
*(Cursor will call `mssql_execute_statement`, get blocked by `[SAFETY_LOCK]`, and report to you that write access is safely disabled!)*

---

## 🧪 Automated Verification Suites

You can re-run all automated test suites at any time:

```bash
# Test 1: MSSQL Adapter & Database Connection (9/9 tests)
npx tsx tests/test-mssql-adapter.ts

# Test 2: Dashboard Server & SSE Real-time Stream (7/7 tests)
npx tsx tests/test-dashboard-server.ts

# Test 3: Cursor AI Stdio MCP Protocol Simulation (8/8 tests)
npx tsx tests/test-cursor-mcp-e2e.ts
```

All 24 automated tests pass with 100% success rate.
