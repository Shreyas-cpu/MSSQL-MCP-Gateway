const API = '';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const main = $('#mainContent');

// ─── Clock ───
setInterval(() => {
  const n = new Date();
  $('#clock').textContent = n.toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
}, 1000);

// ─── Navigation ───
$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    $$('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    loadPage(item.dataset.page);
  });
});

// ─── Fetch helper ───
async function api(endpoint, options = {}) {
  const res = await fetch(API + endpoint, options);
  return res.json();
}

// ─── Page Router ───
async function loadPage(page) {
  main.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
  try {
    switch (page) {
      case 'mssql-monitor':
        await renderMssqlMonitor();
        break;
      case 'table-explorer':
        await renderTableExplorer();
        break;
      case 'query-runner':
        renderQueryRunner();
        break;
      case 'audit':
        await renderAudit();
        break;
      default:
        await renderMssqlMonitor();
    }
  } catch (e) {
    main.innerHTML = `<p style="color:var(--red);padding:24px">Error loading page: ${e.message}</p>`;
  }
}

// ═══════════════════════════════════════════════════════
// REAL-TIME SSE STREAM & LIVE METRICS
// ═══════════════════════════════════════════════════════
let sseSource = null;
let liveEvents = [];
let activeFilter = 'all';

function initLiveStream() {
  if (sseSource) {
    sseSource.close();
  }

  const liveDot = document.getElementById('liveDot');
  const liveText = document.getElementById('liveStatusText');

  try {
    sseSource = new EventSource('/api/live-stream');

    sseSource.onopen = () => {
      if (liveDot) liveDot.className = 'live-dot connected';
      if (liveText) liveText.textContent = 'Live Connected';
    };

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return;

        liveEvents.unshift(data);
        if (liveEvents.length > 200) liveEvents.pop();

        updateMonitorMetrics();

        const streamEl = document.getElementById('liveEventStream');
        if (streamEl) {
          const emptyMsg = document.getElementById('emptyStreamMsg');
          if (emptyMsg) emptyMsg.remove();

          const cardHtml = createEventCardHtml(data);
          const temp = document.createElement('div');
          temp.innerHTML = cardHtml;
          const newCard = temp.firstElementChild;

          if (activeFilter !== 'all' && !cardMatchesFilter(data, activeFilter)) {
            newCard.style.display = 'none';
          }

          streamEl.insertBefore(newCard, streamEl.firstChild);
        }
      } catch (err) {
        console.error('Error processing live SSE event:', err);
      }
    };

    sseSource.onerror = () => {
      if (liveDot) liveDot.className = 'live-dot disconnected';
      if (liveText) liveText.textContent = 'Reconnecting...';
    };
  } catch (err) {
    console.error('Failed to init SSE stream:', err);
  }
}

function updateMonitorMetrics() {
  const total = liveEvents.length;
  const reads = liveEvents.filter(e => {
    const q = (e.params?.query || '').trim().toUpperCase();
    return q.startsWith('SELECT') || e.tool === 'mssql_read_query' || e.tool === 'mssql_list_tables' || e.tool === 'mssql_describe_table';
  }).length;
  const mutations = liveEvents.filter(e => {
    const q = (e.params?.query || '').trim().toUpperCase();
    return q.startsWith('INSERT') || q.startsWith('UPDATE') || q.startsWith('DELETE') || e.tool === 'mssql_execute_statement';
  }).length;
  const blocked = liveEvents.filter(e => e.result === 'error' || e.tool === 'mssql_execute_statement').length;

  const tEl = document.getElementById('metricTotal');
  const rEl = document.getElementById('metricReads');
  const mEl = document.getElementById('metricMutations');
  const bEl = document.getElementById('metricBlocked');

  if (tEl) tEl.textContent = total;
  if (rEl) rEl.textContent = reads;
  if (mEl) mEl.textContent = mutations;
  if (bEl) bEl.textContent = blocked;
}

function classifyQuery(queryStr, toolName) {
  const q = (queryStr || '').trim().toUpperCase();
  if (toolName === 'mssql_list_databases') return { op: 'DATABASES', badge: 'badge-select' };
  if (toolName === 'mssql_list_tables') return { op: 'TABLES', badge: 'badge-select' };
  if (toolName === 'mssql_describe_table') return { op: 'SCHEMA', badge: 'badge-select' };
  if (q.startsWith('SELECT')) return { op: 'SELECT', badge: 'badge-select' };
  if (q.startsWith('INSERT')) return { op: 'INSERT', badge: 'badge-insert' };
  if (q.startsWith('UPDATE')) return { op: 'UPDATE', badge: 'badge-update' };
  if (q.startsWith('DELETE')) return { op: 'DELETE', badge: 'badge-delete' };
  if (q.startsWith('CREATE') || q.startsWith('ALTER') || q.startsWith('DROP')) return { op: 'DDL', badge: 'badge-ddl' };
  return { op: 'SQL', badge: 'badge-select' };
}

function cardMatchesFilter(event, filter) {
  if (filter === 'all') return true;
  const q = (event.params?.query || '').trim().toUpperCase();
  if (filter === 'SELECT') return q.startsWith('SELECT') || event.tool === 'mssql_read_query';
  if (filter === 'INSERT') return q.startsWith('INSERT');
  if (filter === 'UPDATE') return q.startsWith('UPDATE');
  if (filter === 'DELETE') return q.startsWith('DELETE');
  if (filter === 'BLOCKED') return event.result === 'error' || event.tool === 'mssql_execute_statement';
  return true;
}

function filterStream(filterType) {
  activeFilter = filterType;
  $$('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filterType);
  });
  $$('.event-card').forEach(card => {
    const op = card.dataset.op;
    const isBlocked = card.dataset.blocked === 'true';
    let match = false;
    if (filterType === 'all') match = true;
    else if (filterType === 'BLOCKED') match = isBlocked;
    else match = op === filterType;
    card.style.display = match ? 'block' : 'none';
  });
}

function highlightSql(sql) {
  if (!sql) return '';
  const escaped = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|TRUNCATE|AND|OR|IN|NOT|NULL|ORDER BY|GROUP BY|JOIN|LEFT|RIGHT|INNER|OUTER|ON|TOP|AS|DISTINCT|LIMIT)\b/gi, '<span class="sql-keyword">$1</span>')
    .replace(/('(?:''|[^'])*')/g, '<span class="sql-string">$1</span>')
    .replace(/(--.*$)/gm, '<span class="sql-comment">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="sql-num">$1</span>');
}

function copySql(btn, sqlText) {
  navigator.clipboard.writeText(sqlText).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('copied');
    }, 1500);
  });
}

function createEventCardHtml(event) {
  const queryStr = event.params?.query || (event.params?.table ? `SELECT TOP (${event.params.limit || 20}) * FROM [${event.params.table}]` : `${event.tool}()`);
  const classification = classifyQuery(queryStr, event.tool);
  const isBlocked = event.result === 'error' || event.tool === 'mssql_execute_statement';
  const duration = event.durationMs !== undefined ? `${event.durationMs}ms` : '—';
  const caller = event.userId === 'mcp_agent' || event.userId === 'cursor_agent' ? 'Cursor AI' : 'Dashboard';

  return `
    <div class="event-card ${isBlocked ? 'event-blocked' : ''}" data-op="${classification.op}" data-blocked="${isBlocked}">
      <div class="event-card-header">
        <div class="event-card-left">
          <span class="event-op-badge ${isBlocked ? 'badge-blocked' : classification.badge}">
            ${isBlocked ? '🛡️ BLOCKED' : classification.op}
          </span>
          <span class="event-tool-name">${event.tool}</span>
          <span class="event-caller">${caller}</span>
        </div>
        <div class="event-card-right">
          <span class="event-duration">⏱️ ${duration}</span>
          <span class="event-status ${isBlocked ? 'status-blocked' : 'status-success'}">
            ${isBlocked ? '🔒 SAFETY LOCKED' : '✓ SUCCESS'}
          </span>
          <span class="event-time">${new Date(event.timestamp).toLocaleTimeString('en-IN', { hour12: false })}</span>
        </div>
      </div>
      <div class="sql-box-wrapper">
        <pre class="sql-code-box"><code>${highlightSql(queryStr)}</code></pre>
        <button class="btn-copy-sql" onclick="copySql(this, ${JSON.stringify(queryStr).replace(/"/g, '&quot;')})">Copy SQL</button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// VIEW 1: LIVE MSSQL MONITOR
// ═══════════════════════════════════════════════════════
async function renderMssqlMonitor() {
  if (liveEvents.length === 0) {
    try {
      const recent = await api('/api/audit-log');
      if (Array.isArray(recent)) {
        liveEvents = [...recent].reverse();
      }
    } catch (_) {}
  }

  main.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1>⚡ Live MSSQL Monitor & Cursor Activity</h1>
        <p>Real-time event stream tracing Cursor AI queries, table reads, and safety locks on TG_2024</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="topbar-safety-badge" style="font-size:12px;padding:6px 12px">
          🛡️ STRICT READ-ONLY ACTIVE
        </div>
      </div>
    </div>

    <!-- METRICS CARDS -->
    <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px;">
      <div class="stat-card accent">
        <div class="stat-label">Total Streamed Queries</div>
        <div class="stat-value" id="metricTotal">${liveEvents.length}</div>
        <div class="stat-sub">Across all tools & Cursor</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Read Queries (SELECT)</div>
        <div class="stat-value" id="metricReads">0</div>
        <div class="stat-sub">Safely executed on TG_2024</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Mutations Intercepted</div>
        <div class="stat-value" id="metricMutations">0</div>
        <div class="stat-sub">INSERT / UPDATE / DELETE</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Protected by Safety Lock</div>
        <div class="stat-value" id="metricBlocked">0</div>
        <div class="stat-sub">100% blocked before network</div>
      </div>
    </div>

    <!-- MONITOR CONTROLS & FILTER BAR -->
    <div class="monitor-controls-card">
      <div class="filter-group">
        <span style="font-size:12px;font-weight:600;color:var(--text-dim);margin-right:4px">FILTER:</span>
        <button class="filter-btn active" data-filter="all" onclick="filterStream('all')">All Events</button>
        <button class="filter-btn" data-filter="SELECT" onclick="filterStream('SELECT')">SELECT</button>
        <button class="filter-btn" data-filter="BLOCKED" onclick="filterStream('BLOCKED')">🔒 Blocked</button>
      </div>
      <div class="action-group">
        <button class="btn-test btn-test-safe" onclick="triggerTestSelect()">
          ▷ Test Safe Read
        </button>
        <button class="btn-test btn-test-lock" onclick="triggerTestLock()">
          🔒 Test Safety Lock
        </button>
        <button class="btn-test" style="border:1px solid var(--border);color:var(--text-dim)" onclick="clearLiveStream()">
          Clear Feed
        </button>
      </div>
    </div>

    <!-- REAL-TIME EVENT STREAM -->
    <div class="stream-container" id="liveEventStream">
      ${liveEvents.length === 0 ? `
        <div id="emptyStreamMsg" style="text-align:center;padding:50px;color:var(--text-dim);font-size:13px">
          <div style="font-size:36px;margin-bottom:12px">⚡</div>
          <div style="font-weight:600;color:var(--text)">Live Stream Active</div>
          <div style="margin-top:6px">Waiting for Cursor AI queries or tool executions. Every query executed via Cursor MCP will stream here in real time!</div>
        </div>
      ` : liveEvents.map(e => createEventCardHtml(e)).join('')}
    </div>
  `;

  updateMonitorMetrics();
}

async function triggerTestSelect() {
  try {
    await fetch('/api/mssql/table-data?table=ActivityOwner_SOB&limit=3&database=TG_2024');
  } catch (err) {
    console.error('Test query failed:', err);
  }
}

async function triggerTestLock() {
  try {
    await fetch('/api/mssql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "UPDATE [ActivityOwner_SOB] SET SOB_Qty = 999 WHERE CSOBID = 1" })
    });
  } catch (err) {
    // Expected to fail safely with 403
  }
}

function clearLiveStream() {
  liveEvents = [];
  const streamEl = document.getElementById('liveEventStream');
  if (streamEl) {
    streamEl.innerHTML = `<div id="emptyStreamMsg" style="text-align:center;padding:40px;color:var(--text-dim);font-size:13px">Stream cleared. Waiting for real-time Cursor or MCP queries...</div>`;
  }
  updateMonitorMetrics();
}

// ═══════════════════════════════════════════════════════
// VIEW 2: TG_2024 DATABASE TABLE EXPLORER
// ═══════════════════════════════════════════════════════
let cachedTables = [];
let selectedTableName = null;

async function renderTableExplorer() {
  main.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1>🗄️ TG_2024 Database Table Explorer</h1>
        <p>Browse tables and inspect live data via strict read-only MSSQL queries</p>
      </div>
      <div class="topbar-safety-badge">
        🛡️ STRICT READ-ONLY ACTIVE
      </div>
    </div>

    <div class="explorer-container">
      <!-- Left: Table Selector -->
      <div class="explorer-sidebar">
        <div class="explorer-search-wrap">
          <input type="text" class="explorer-search" id="tableSearchInput" placeholder="Filter 187 tables..." oninput="filterTableList(this.value)">
        </div>
        <div class="explorer-table-list" id="tableListContainer">
          <div class="loading"><div class="spinner"></div>Loading tables...</div>
        </div>
      </div>

      <!-- Right: Table Preview -->
      <div class="explorer-content" id="tablePreviewContainer">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-dim);padding:40px;text-align:center">
          <div style="font-size:32px;margin-bottom:12px">👈</div>
          <div style="font-weight:500;color:var(--text)">Select a table from TG_2024</div>
          <div style="font-size:12px;margin-top:4px">Preview the first 20 records safely. Each preview generates a live event in the monitor.</div>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await api('/api/mssql/tables?database=TG_2024');
    if (res.success && Array.isArray(res.tables)) {
      cachedTables = res.tables;
      renderTableListItems(cachedTables);

      if (!selectedTableName && cachedTables.length > 0) {
        const firstBase = cachedTables.find(t => t.type === 'BASE TABLE') || cachedTables[0];
        selectTablePreview(firstBase.schema, firstBase.name);
      }
    } else {
      $('#tableListContainer').innerHTML = `<p style="padding:16px;color:var(--red)">Failed to load tables</p>`;
    }
  } catch (err) {
    $('#tableListContainer').innerHTML = `<p style="padding:16px;color:var(--red)">Error: ${err.message}</p>`;
  }
}

function filterTableList(query) {
  const q = query.toLowerCase().trim();
  const filtered = cachedTables.filter(t => t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q));
  renderTableListItems(filtered);
}

function renderTableListItems(tables) {
  const container = document.getElementById('tableListContainer');
  if (!container) return;

  if (tables.length === 0) {
    container.innerHTML = `<p style="padding:14px;color:var(--text-dim);font-size:12px">No matching tables</p>`;
    return;
  }

  container.innerHTML = tables.map(t => {
    const fullName = `${t.schema}.${t.name}`;
    const isActive = selectedTableName === fullName ? 'active' : '';
    const rowCountText = t.rowCount !== undefined ? `${Number(t.rowCount).toLocaleString()} rows` : t.type;

    return `
      <div class="explorer-table-item ${isActive}" onclick="selectTablePreview('${t.schema}', '${t.name}')">
        <div>
          <div class="explorer-table-name">[${t.schema}].[${t.name}]</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${t.type}</div>
        </div>
        <span class="explorer-table-badge">${rowCountText}</span>
      </div>
    `;
  }).join('');
}

async function selectTablePreview(schema, name) {
  selectedTableName = `${schema}.${name}`;
  renderTableListItems(cachedTables);

  const preview = document.getElementById('tablePreviewContainer');
  if (!preview) return;

  preview.innerHTML = `
    <div class="explorer-header">
      <div class="explorer-title-box">
        <h3><span>📄</span> [${schema}].[${name}]</h3>
        <div class="explorer-sql-preview">SELECT TOP (20) * FROM [${schema}].[${name}]</div>
      </div>
      <button class="btn-test btn-test-safe" onclick="selectTablePreview('${schema}', '${name}')">
        ⟳ Refresh
      </button>
    </div>
    <div class="loading"><div class="spinner"></div>Fetching top 20 rows...</div>
  `;

  try {
    const res = await api(`/api/mssql/table-data?table=${name}&schema=${schema}&limit=20&database=TG_2024`);
    if (res.success && Array.isArray(res.rows)) {
      if (res.rows.length === 0) {
        preview.innerHTML = `
          <div class="explorer-header">
            <div class="explorer-title-box">
              <h3><span>📄</span> [${schema}].[${name}]</h3>
              <div class="explorer-sql-preview">SELECT TOP (20) * FROM [${schema}].[${name}]</div>
            </div>
            <button class="btn-test btn-test-safe" onclick="selectTablePreview('${schema}', '${name}')">⟳ Refresh</button>
          </div>
          <div style="padding:40px;text-align:center;color:var(--text-dim)">Table [${schema}].[${name}] contains 0 records.</div>
        `;
        return;
      }

      const columns = Object.keys(res.rows[0]);
      preview.innerHTML = `
        <div class="explorer-header">
          <div class="explorer-title-box">
            <h3><span>📄</span> [${schema}].[${name}]</h3>
            <div class="explorer-sql-preview">SELECT TOP (20) * FROM [${schema}].[${name}]</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="table-count">${res.count} records previewed</span>
            <button class="btn-test btn-test-safe" onclick="selectTablePreview('${schema}', '${name}')">⟳ Refresh</button>
          </div>
        </div>
        <div class="explorer-table-scroll">
          <table>
            <thead>
              <tr>
                <th style="width:40px;text-align:center">#</th>
                ${columns.map(c => `<th>${c}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${res.rows.map((row, idx) => `
                <tr>
                  <td class="cell-mono" style="text-align:center;color:var(--text-dim)">${idx + 1}</td>
                  ${columns.map(c => {
                    const val = row[c];
                    if (val === null || val === undefined) {
                      return `<td><span class="null-cell">NULL</span></td>`;
                    }
                    if (typeof val === 'object') {
                      return `<td class="cell-mono">${JSON.stringify(val)}</td>`;
                    }
                    return `<td class="cell-mono">${String(val)}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      preview.innerHTML = `
        <div style="padding:20px;color:var(--red)">
          <strong>Error querying table:</strong> ${res.error || 'Failed to fetch table records.'}
        </div>
      `;
    }
  } catch (err) {
    preview.innerHTML = `
      <div style="padding:20px;color:var(--red)">
        <strong>Request error:</strong> ${err.message}
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════
// VIEW 3: SQL QUERY RUNNER (READ-ONLY)
// ═══════════════════════════════════════════════════════
function renderQueryRunner() {
  main.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1>🔍 SQL Query Runner</h1>
        <p>Safely run read-only queries against TG_2024 with instant execution</p>
      </div>
      <div class="topbar-safety-badge">
        🛡️ READ-ONLY ACTIVE
      </div>
    </div>

    <div class="card" style="padding:20px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <label style="font-weight:600;font-size:13px;color:var(--text)">SQL Statement</label>
        <span style="font-size:11px;color:var(--text-dim)">Mutations (INSERT/UPDATE/DELETE) will be blocked</span>
      </div>
      <textarea id="sqlQueryInput" style="width:100%;height:100px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:var(--font-mono);font-size:13px;resize:vertical;outline:none" placeholder="SELECT TOP 10 * FROM [dbo].[ActivityOwner_SOB]"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn-test btn-test-safe" style="padding:8px 18px" onclick="executeManualQuery()">
          ▶ Execute Query
        </button>
      </div>
    </div>

    <div id="queryResultArea"></div>
  `;
}

async function executeManualQuery() {
  const query = $('#sqlQueryInput').value.trim();
  const resultArea = $('#queryResultArea');
  if (!query) return;

  resultArea.innerHTML = '<div class="loading"><div class="spinner"></div>Executing query...</div>';

  try {
    const res = await api('/api/mssql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, database: 'TG_2024' })
    });

    if (res.success && Array.isArray(res.rows)) {
      if (res.rows.length === 0) {
        resultArea.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--text-dim)">Query executed successfully. 0 rows returned.</div>`;
        return;
      }
      const columns = Object.keys(res.rows[0]);
      resultArea.innerHTML = `
        <div class="table-wrap">
          <div class="table-header">
            <span class="table-title">Query Results</span>
            <span class="table-count">${res.count} rows</span>
          </div>
          <table>
            <thead>
              <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${res.rows.map(r => `
                <tr>
                  ${columns.map(c => `<td class="cell-mono">${r[c] === null ? '<span class="null-cell">NULL</span>' : String(r[c])}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      resultArea.innerHTML = `
        <div class="card" style="padding:20px;border-left:4px solid var(--red)">
          <div style="font-weight:600;color:var(--red);margin-bottom:6px">Execution Blocked / Error:</div>
          <div style="font-family:var(--font-mono);font-size:12px;color:var(--text)">${res.error || 'Failed to execute query.'}</div>
        </div>
      `;
    }
  } catch (err) {
    resultArea.innerHTML = `
      <div class="card" style="padding:20px;border-left:4px solid var(--red)">
        <div style="font-weight:600;color:var(--red)">Error:</div>
        <div>${err.message}</div>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════
// VIEW 4: AUDIT TRAIL LOG
// ═══════════════════════════════════════════════════════
async function renderAudit() {
  const entries = await api('/api/audit-log');
  main.innerHTML = `
    <div class="page-header">
      <h1>📋 Audit Trail & Governance Log</h1>
      <p>Immutable record of every AI tool execution and query performed on MSSQL</p>
    </div>
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">Audit Log Entries</span>
        <span class="table-count">${entries.length} entries</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Tool</th>
            <th>Caller</th>
            <th>Duration</th>
            <th>Result</th>
            <th>Parameters</th>
          </tr>
        </thead>
        <tbody>
          ${entries.slice(-50).reverse().map(e => `
            <tr>
              <td class="cell-mono">${e.timestamp.replace('T', ' ').slice(0, 19)}</td>
              <td class="cell-mono" style="font-weight:600;color:var(--accent)">${e.tool}</td>
              <td>${e.userId || 'cursor_agent'}</td>
              <td class="cell-mono">${e.durationMs}ms</td>
              <td><span class="badge ${e.result === 'success' ? 'badge-completed' : 'badge-rejected'}">${e.result}</span></td>
              <td class="cell-mono" style="max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${JSON.stringify(e.params)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── Initialize Live Stream and Default Page ───
initLiveStream();
loadPage('mssql-monitor');
