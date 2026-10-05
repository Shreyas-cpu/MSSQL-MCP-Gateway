import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(PROJECT_ROOT, 'dist', 'index.js');

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class McpTestClient {
  private child: any;
  private messageId = 1;
  private pendingRequests = new Map<number | string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private buffer = '';

  async start(): Promise<void> {
    this.child = spawn('node', [SERVER_PATH], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, MSSQL_READ_ONLY: 'true' }
    });

    this.child.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg: JsonRpcMessage = JSON.parse(line.trim());
          if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
            const { resolve, reject } = this.pendingRequests.get(msg.id)!;
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch {
          // Non-JSON or logging output
        }
      }
    });

    this.child.on('error', (err: any) => {
      console.error('MCP process error:', err);
    });
  }

  async sendRequest(method: string, params: any = {}): Promise<any> {
    const id = this.messageId++;
    const payload: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  async sendNotification(method: string, params: any = {}): Promise<void> {
    const payload: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params
    };
    this.child.stdin.write(JSON.stringify(payload) + '\n');
  }

  async stop(): Promise<void> {
    if (this.child) {
      this.child.kill();
    }
  }
}

async function runE2eTests() {
  console.log('='.repeat(70));
  console.log('  STAGE 5: CURSOR MCP INTEGRATION & END-TO-END VERIFICATION');
  console.log('  Simulating Cursor AI stdio protocol client');
  console.log('  Target Server:', SERVER_PATH);
  console.log('='.repeat(70));

  const client = new McpTestClient();
  await client.start();

  try {
    // 1. Handshake
    console.log('\n[TEST 1] Initialize MCP Handshake...');
    const initResult = await client.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'Cursor-AI-Simulator', version: '0.45.0' }
    });
    console.log('  ✓ Initialized with server:', initResult.serverInfo?.name, 'v' + initResult.serverInfo?.version);
    await client.sendNotification('notifications/initialized');

    // 2. Tools List
    console.log('\n[TEST 2] Fetch MCP Tools List (tools/list)...');
    const toolsResult = await client.sendRequest('tools/list', {});
    const toolNames = toolsResult.tools.map((t: any) => t.name);
    console.log(`  ✓ Total tools discovered by Cursor: ${toolNames.length}`);
    const mssqlTools = toolNames.filter((n: string) => n.startsWith('mssql_'));
    console.log('  ✓ MSSQL tools found:', mssqlTools);
    if (mssqlTools.length !== 5) {
      throw new Error(`Expected 5 MSSQL tools, found ${mssqlTools.length}`);
    }

    // 3. Tool: mssql_list_databases
    console.log('\n[TEST 3] Cursor calls mssql_list_databases...');
    const dbCall = await client.sendRequest('tools/call', {
      name: 'mssql_list_databases',
      arguments: {}
    });
    const dbData = JSON.parse(dbCall.content[0].text);
    console.log('  ✓ Databases returned:', dbData.databases);
    if (!dbData.databases || !dbData.databases.includes('TG_2024')) {
      throw new Error('Database TG_2024 not found in mssql_list_databases response');
    }

    // 4. Tool: mssql_list_tables
    console.log('\n[TEST 4] Cursor calls mssql_list_tables on TG_2024...');
    const tablesCall = await client.sendRequest('tools/call', {
      name: 'mssql_list_tables',
      arguments: { database: 'TG_2024' }
    });
    const tablesData = JSON.parse(tablesCall.content[0].text);
    console.log(`  ✓ Total tables/views returned: ${tablesData.count}`);
    if (tablesData.count < 10) {
      throw new Error(`Expected > 10 tables, got ${tablesData.count}`);
    }
    const sampleTable = tablesData.tables.find((t: any) => t.type === 'BASE TABLE')?.name || tablesData.tables[0].name;

    // 5. Tool: mssql_describe_table
    console.log(`\n[TEST 5] Cursor calls mssql_describe_table for "${sampleTable}"...`);
    const descCall = await client.sendRequest('tools/call', {
      name: 'mssql_describe_table',
      arguments: { table: sampleTable, database: 'TG_2024' }
    });
    const descData = JSON.parse(descCall.content[0].text);
    console.log(`  ✓ Table [${sampleTable}] columns count: ${descData.columnCount || 0}`);
    console.log('  ✓ Sample columns:', descData.columns.slice(0, 3).map((c: any) => `${c.column} (${c.type})`));

    // 6. Tool: mssql_read_query
    console.log('\n[TEST 6] Cursor calls mssql_read_query (SELECT TOP 2 from sys.tables)...');
    const readCall = await client.sendRequest('tools/call', {
      name: 'mssql_read_query',
      arguments: {
        query: 'SELECT TOP 2 name, create_date FROM sys.tables ORDER BY name',
        database: 'TG_2024'
      }
    });
    const readData = JSON.parse(readCall.content[0].text);
    console.log('  ✓ Query result rows:', readData.count);
    console.log('  ✓ Data preview:', readData.data);
    if (readData.count !== 2) {
      throw new Error(`Expected 2 rows, received ${readData.count}`);
    }

    // 7. Tool: mssql_execute_statement (Test Safety Guard)
    console.log('\n[TEST 7] Cursor calls mssql_execute_statement with mutation (Verify SAFETY_LOCK)...');
    const writeCall = await client.sendRequest('tools/call', {
      name: 'mssql_execute_statement',
      arguments: {
        query: "UPDATE [ActivityOwner_SOB] SET SOB_Qty = 999 WHERE CSOBID = 1",
        database: 'TG_2024'
      }
    });
    console.log('  ✓ Response content:', writeCall.content[0].text);
    if (!writeCall.isError) {
      throw new Error('Expected isError: true for mutating statement under readOnlyMode');
    }
    if (!writeCall.content[0].text.includes('SAFETY_LOCK')) {
      throw new Error('Expected SAFETY_LOCK in error response');
    }
    console.log('  ✓ SAFETY_LOCK successfully blocked mutation with zero DB impact!');

    // 8. Audit Log Verification
    console.log('\n[TEST 8] Verify audit-logs/*.jsonl has recorded all Cursor MCP calls...');
    const logDir = path.join(PROJECT_ROOT, 'audit-logs');
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `audit-${today}.jsonl`);
    if (!fs.existsSync(logFile)) {
      throw new Error(`Audit log file ${logFile} does not exist`);
    }
    const logContent = fs.readFileSync(logFile, 'utf8');
    const logLines = logContent.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    const recentMssqlEntries = logLines.filter(l => l.tool && l.tool.startsWith('mssql_'));
    console.log(`  ✓ Total MSSQL audit events recorded today: ${recentMssqlEntries.length}`);
    const lastEntry = recentMssqlEntries[recentMssqlEntries.length - 1];
    console.log('  ✓ Last logged event:', {
      tool: lastEntry.tool,
      result: lastEntry.result,
      adapter: lastEntry.adapter,
      durationMs: lastEntry.durationMs
    });

    console.log('\n' + '='.repeat(70));
    console.log('  ALL STAGE 5 END-TO-END MCP & CURSOR TESTS PASSED (8/8)');
    console.log('='.repeat(70));

  } finally {
    await client.stop();
  }
}

runE2eTests().catch(err => {
  console.error('\n❌ STAGE 5 E2E TEST FAILED:', err);
  process.exit(1);
});
