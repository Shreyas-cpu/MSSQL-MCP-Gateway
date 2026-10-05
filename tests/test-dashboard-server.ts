import assert from 'node:assert';
import http from 'node:http';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequest(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
  });
}

function postRequest(url: string, payload: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTestSuite() {
  console.log('='.repeat(70));
  console.log('  TESTING LIVE STREAM SSE & DASHBOARD REST ENDPOINTS');
  console.log('='.repeat(70));

  const BASE_URL = 'http://localhost:3000';

  // 1. Test SSE live-stream endpoint
  console.log('\n[TEST 1] Connecting to SSE /api/live-stream...');
  const sseEvents: string[] = [];
  let sseHeadersOk = false;

  const sseReq = http.get(`${BASE_URL}/api/live-stream`, (res) => {
    if (res.headers['content-type']?.includes('text/event-stream') &&
        res.headers['cache-control']?.includes('no-cache')) {
      sseHeadersOk = true;
    }
    res.on('data', (chunk) => {
      const text = chunk.toString();
      sseEvents.push(text);
      // console.log('  [SSE Chunk Received]:', text.trim());
    });
  });

  await delay(1000);
  assert.strictEqual(sseHeadersOk, true, 'SSE headers should include text/event-stream and no-cache');
  assert.ok(sseEvents.length > 0, 'Should have received initial handshake event from SSE');
  console.log('  ✅ SSE Handshake received successfully!');

  // 2. Test GET /api/mssql/status
  console.log('\n[TEST 2] Testing GET /api/mssql/status...');
  const statusRes = await getRequest(`${BASE_URL}/api/mssql/status`);
  assert.strictEqual(statusRes.status, 200);
  const statusJson = JSON.parse(statusRes.body);
  console.log('  Status response:', statusJson);
  assert.strictEqual(statusJson.readOnly, true, 'readOnly mode must be strictly TRUE');
  assert.strictEqual(statusJson.database, 'TG_2024');
  console.log('  ✅ /api/mssql/status verified!');

  // 3. Test GET /api/mssql/tables
  console.log('\n[TEST 3] Testing GET /api/mssql/tables (Listing TG_2024 tables)...');
  const tablesRes = await getRequest(`${BASE_URL}/api/mssql/tables`);
  assert.strictEqual(tablesRes.status, 200);
  const tablesJson = JSON.parse(tablesRes.body);
  assert.strictEqual(tablesJson.success, true);
  assert.ok(Array.isArray(tablesJson.tables), 'tables must be an array');
  assert.ok(tablesJson.tables.length > 0, 'tables array should not be empty');
  console.log(`  Discovered ${tablesJson.tables.length} tables/views in TG_2024`);
  console.log(`  First 3 tables:`, tablesJson.tables.slice(0, 3));
  console.log('  ✅ /api/mssql/tables verified!');

  // 4. Test GET /api/mssql/table-data?table=X&limit=5
  const sampleTable = tablesJson.tables[0].name;
  console.log(`\n[TEST 4] Testing GET /api/mssql/table-data?table=${sampleTable}&limit=5...`);
  const dataRes = await getRequest(`${BASE_URL}/api/mssql/table-data?table=${sampleTable}&limit=5`);
  assert.strictEqual(dataRes.status, 200);
  const dataJson = JSON.parse(dataRes.body);
  assert.strictEqual(dataJson.success, true);
  assert.ok(Array.isArray(dataJson.rows), 'rows must be an array');
  console.log(`  Fetched ${dataJson.rows.length} rows for table [${sampleTable}]`);
  console.log('  ✅ /api/mssql/table-data verified!');

  // 5. Test POST /api/mssql/query (Safe read-only SELECT)
  console.log('\n[TEST 5] Testing POST /api/mssql/query (Safe SELECT @@VERSION)...');
  const safeQueryRes = await postRequest(`${BASE_URL}/api/mssql/query`, {
    query: 'SELECT @@VERSION AS [version], DB_NAME() AS [current_db]',
  });
  assert.strictEqual(safeQueryRes.status, 200);
  const safeJson = JSON.parse(safeQueryRes.body);
  assert.strictEqual(safeJson.success, true);
  console.log('  Safe query result:', safeJson.rows[0]);
  console.log('  ✅ Safe query executed and logged!');

  // 6. Test POST /api/mssql/query (Mutating query must be blocked by SAFETY_LOCK)
  console.log('\n[TEST 6] Testing POST /api/mssql/query (Mutating query blocked by SAFETY_LOCK)...');
  const mutateRes = await postRequest(`${BASE_URL}/api/mssql/query`, {
    query: "DELETE FROM BlackList WHERE Name = 'VERIFY_SAFETY_LOCK'",
  });
  assert.strictEqual(mutateRes.status, 403, 'Mutating query must return HTTP 403');
  const mutateJson = JSON.parse(mutateRes.body);
  assert.strictEqual(mutateJson.success, false);
  assert.strictEqual(mutateJson.blocked, true);
  assert.ok(mutateJson.error.includes('[SAFETY_LOCK]'), 'Error should specify [SAFETY_LOCK]');
  console.log(`  Intercepted blocked mutation with error: "${mutateJson.error}"`);
  console.log('  ✅ SAFETY_LOCK verified: write operations safely blocked!');

  // 7. Verify SSE broadcast captured all these events
  await delay(1000);
  sseReq.destroy();
  const fullSseLog = sseEvents.join('\n');
  assert.ok(fullSseLog.includes('mssql_list_tables'), 'SSE stream must broadcast mssql_list_tables event');
  assert.ok(fullSseLog.includes('mssql_read_query'), 'SSE stream must broadcast mssql_read_query events');
  assert.ok(fullSseLog.includes('blocked'), 'SSE stream must broadcast blocked event');
  console.log(`\n  ✅ Verified: All ${sseEvents.length} SSE events broadcast to connected live clients!`);

  console.log('\n' + '='.repeat(70));
  console.log('  ALL DASHBOARD SERVER & LIVE STREAM TESTS PASSED (7/7)');
  console.log('='.repeat(70));
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
