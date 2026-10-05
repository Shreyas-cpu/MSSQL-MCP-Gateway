import assert from 'node:assert';
import { mssqlAdapter, MssqlAdapter, TableInfo, ColumnInfo } from '../src/adapters/mssql-adapter.js';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void | any>): Promise<void> {
  const start = Date.now();
  process.stdout.write(`\n🔍 [TEST] ${name} ... `);
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    process.stdout.write(`✅ PASS (${durationMs}ms)\n`);
    results.push({ name, passed: true, durationMs, details });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    process.stdout.write(`❌ FAIL (${durationMs}ms)\n`);
    console.error(`   Error details:`, err?.message || err);
    results.push({ name, passed: false, durationMs, error: err?.message || String(err) });
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  MSSQL MCP GATEWAY - AUTOMATED VERIFICATION SUITE');
  console.log('  Target: hcp.developeradda.com:4431 | Database: TG_2024');
  console.log('  Safety Protocol: STRICT READ-ONLY MODE ACTIVE');
  console.log('='.repeat(70));

  // TEST 1: Connection & Pool Health
  await runTest('1. Connect to remote MSSQL server and verify connection pool', async () => {
    const pool = await mssqlAdapter.connect();
    assert.ok(pool, 'Connection pool should be defined');
    assert.strictEqual(mssqlAdapter.isConnected(), true, 'isConnected() should return true');
    assert.strictEqual(mssqlAdapter.isReadOnly(), true, 'readOnlyMode must be TRUE by default for data safety');
    console.log(`   Connected to server. Pool size: ${pool.size}, Read-only safety lock: ACTIVE`);
  });

  // TEST 2: List Databases & Verify TG_2024 and master
  await runTest('2. listDatabases() and verify TG_2024 and master exist', async () => {
    const databases = await mssqlAdapter.listDatabases();
    assert.ok(Array.isArray(databases), 'listDatabases should return an array');
    assert.ok(databases.length > 0, 'Database list should not be empty');
    assert.ok(databases.includes('TG_2024'), "Databases should include 'TG_2024'");
    assert.ok(databases.includes('master'), "Databases should include 'master'");
    console.log(`   Found ${databases.length} online databases: [${databases.join(', ')}]`);
    return { databases };
  });

  // TEST 3: List Tables in TG_2024
  let targetTable: TableInfo | undefined;
  await runTest("3. listTables('TG_2024') and verify table metadata with row counts", async () => {
    const tables = await mssqlAdapter.listTables('TG_2024');
    assert.ok(Array.isArray(tables), 'listTables should return an array');
    assert.ok(tables.length > 0, "listTables('TG_2024') should return at least 1 table");

    // Verify item schema
    const first = tables[0];
    assert.ok(typeof first.schema === 'string', 'Table schema should be string');
    assert.ok(typeof first.name === 'string', 'Table name should be string');
    assert.ok(typeof first.type === 'string', 'Table type should be string');

    // Pick first BASE TABLE for describe test
    targetTable = tables.find((t) => t.type === 'BASE TABLE');
    assert.ok(targetTable, 'Should find at least one BASE TABLE in TG_2024');

    console.log(`   Discovered ${tables.length} total objects (tables/views) in TG_2024.`);
    console.log(`   Sample tables:`);
    tables.slice(0, 5).forEach((t) => {
      console.log(`     - [${t.schema}].[${t.name}] (${t.type}, rows: ${t.rowCount ?? 'N/A'})`);
    });

    return { totalCount: tables.length, sample: tables.slice(0, 5) };
  });

  // TEST 4: Describe Table Schema
  await runTest(`4. describeTable() on user table [${targetTable?.name || 'BlackList'}]`, async () => {
    const tableName = targetTable?.name || 'BlackList';
    const schemaName = targetTable?.schema || 'dbo';
    const columns: ColumnInfo[] = await mssqlAdapter.describeTable(tableName, schemaName, 'TG_2024');

    assert.ok(Array.isArray(columns), 'describeTable should return an array');
    assert.ok(columns.length > 0, `Table ${tableName} should have at least 1 column`);

    const col0 = columns[0];
    assert.ok(typeof col0.column === 'string', 'Column name should be string');
    assert.ok(typeof col0.type === 'string', 'Column type should be string');
    assert.ok(typeof col0.nullable === 'boolean', 'Column nullable should be boolean');
    assert.ok(typeof col0.isPrimaryKey === 'boolean', 'Column isPrimaryKey should be boolean');

    console.log(`   Table [${schemaName}].[${tableName}] has ${columns.length} columns:`);
    columns.forEach((c) => {
      const pkBadge = c.isPrimaryKey ? ' [PK]' : '';
      const nullBadge = c.nullable ? 'NULL' : 'NOT NULL';
      const len = c.maxLength ? `(${c.maxLength})` : '';
      console.log(`     * ${c.column}: ${c.type}${len} ${nullBadge}${pkBadge}`);
    });

    return { tableName, columnCount: columns.length, columns };
  });

  // TEST 5: Read Query Execution (SELECT @@VERSION, DB_NAME())
  await runTest('5. query() read-only: SELECT @@VERSION as version, DB_NAME() as current_db', async () => {
    const queryResult = await mssqlAdapter.query<{ version: string; current_db: string }>(
      'SELECT @@VERSION AS version, DB_NAME() AS current_db'
    );

    assert.ok(Array.isArray(queryResult), 'query() should return an array');
    assert.strictEqual(queryResult.length, 1, 'Should return exactly 1 row');
    assert.ok(queryResult[0].version.includes('Microsoft SQL Server'), 'version should contain Microsoft SQL Server');
    assert.strictEqual(queryResult[0].current_db, 'TG_2024', 'current_db should match TG_2024');

    const cleanVer = queryResult[0].version.split('\n')[0].trim();
    console.log(`   Current Database: ${queryResult[0].current_db}`);
    console.log(`   SQL Server Version: ${cleanVer}`);

    return queryResult[0];
  });

  // TEST 6: Parameterized Read Query
  await runTest('6. query() with parameter binding: SELECT @val AS test_val, @num AS test_num', async () => {
    const testVal = 'QA_Validation_Token_2026';
    const testNum = 98765;
    const res = await mssqlAdapter.query<{ test_val: string; test_num: number }>(
      'SELECT @val AS test_val, @num AS test_num',
      { val: testVal, num: testNum }
    );

    assert.ok(Array.isArray(res), 'query() with params should return an array');
    assert.strictEqual(res.length, 1, 'Should return 1 row');
    assert.strictEqual(res[0].test_val, testVal, 'Parameter @val should match');
    assert.strictEqual(res[0].test_num, testNum, 'Parameter @num should match');

    console.log(`   Bound inputs verified: test_val="${res[0].test_val}", test_num=${res[0].test_num}`);
  });

  // TEST 7: Error Handling (Invalid SQL Query)
  await runTest('7. Error handling on syntactically invalid or non-existent table query', async () => {
    let errorCaught = false;
    let errorMessage = '';

    try {
      await mssqlAdapter.query('SELECT * FROM NON_EXISTENT_TABLE_VERIFY_QA_99999 WHERE 1=1');
    } catch (err: any) {
      errorCaught = true;
      errorMessage = err?.message || String(err);
    }

    assert.strictEqual(errorCaught, true, 'Executing invalid query should throw an error');
    assert.ok(
      errorMessage.includes('Invalid object name') || errorMessage.includes('NON_EXISTENT_TABLE'),
      `Error should indicate invalid table/object, got: "${errorMessage}"`
    );
    console.log(`   Successfully caught expected SQL Server error: "${errorMessage.trim()}"`);
  });

  // TEST 8: Safety Guard Lock Verification (Zero Remote Writes)
  await runTest('8. [SAFETY_LOCK] Intercept and reject mutating queries in readOnlyMode', async () => {
    // 8a. Test mutation via execute()
    let executeBlocked = false;
    try {
      await mssqlAdapter.execute("INSERT INTO BlackList (Name) VALUES ('QA_MALICIOUS_INSERT_TEST')");
    } catch (err: any) {
      if (err?.message?.includes('[SAFETY_LOCK]')) {
        executeBlocked = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(executeBlocked, true, 'execute() with INSERT must be blocked by [SAFETY_LOCK]');

    // 8b. Test mutation via query()
    let queryBlocked = false;
    try {
      await mssqlAdapter.query("DELETE FROM BlackList WHERE Name = 'DO_NOT_RUN'");
    } catch (err: any) {
      if (err?.message?.includes('[SAFETY_LOCK]')) {
        queryBlocked = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(queryBlocked, true, 'query() with DELETE must be blocked by [SAFETY_LOCK]');

    // 8c. Test transaction() blocked in readOnlyMode
    let txBlocked = false;
    try {
      await mssqlAdapter.transaction(async () => {});
    } catch (err: any) {
      if (err?.message?.includes('[SAFETY_LOCK]')) {
        txBlocked = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(txBlocked, true, 'transaction() must be blocked by [SAFETY_LOCK]');

    console.log('   All mutation attempts (INSERT, DELETE, TRANSACTION) intercepted by application safety guard.');
    console.log('   ZERO mutation commands were transmitted to the remote server.');
  });

  // TEST 9: Clean Disconnect
  await runTest('9. disconnect() and verify pool teardown', async () => {
    await mssqlAdapter.disconnect();
    assert.strictEqual(mssqlAdapter.isConnected(), false, 'isConnected() should return false after disconnect');
    console.log('   Connection pool gracefully closed.');
  });

  // Summary Report
  console.log('\n' + '='.repeat(70));
  console.log('  VERIFICATION SUITE SUMMARY');
  console.log('='.repeat(70));

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r, i) => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  [${i + 1}/${total}] ${status} - ${r.name} (${r.durationMs}ms)`);
  });

  console.log('-'.repeat(70));
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n💥 Unexpected fatal error in test suite:', err);
  process.exit(1);
});
