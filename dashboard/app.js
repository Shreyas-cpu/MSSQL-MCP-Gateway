const API = '';
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const main=$('#mainContent');

// ─── Clock ───
setInterval(()=>{
  const n=new Date();
  $('#clock').textContent=n.toLocaleTimeString('en-IN',{hour12:false})+' IST';
},1000);

// ─── Navigation ───
$$('.nav-item').forEach(item=>{
  item.addEventListener('click',()=>{
    $$('.nav-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    loadPage(item.dataset.page);
  });
});

// ─── Adapter Selection ───
let currentAdapter = 'MockERPAdapter';
function changeAdapter() {
  currentAdapter = document.getElementById('adapterSelect').value;
  const activePage = document.querySelector('.nav-item.active').dataset.page;
  loadPage(activePage);
}

// ─── Fetch helper ───
async function api(endpoint){
  const res=await fetch(API+endpoint, {
    headers: { 'x-adapter': currentAdapter }
  });
  return res.json();
}

// ─── Format currency ───
function fmt(n){return '₹'+Number(n).toLocaleString('en-IN')}
function fmtL(n){return '₹'+(n/100000).toFixed(1)+'L'}

// ─── Badge helper ───
function badge(status){
  const cls=status.replace(/\s+/g,'-').toLowerCase();
  return `<span class="badge badge-${cls}">${status}</span>`;
}

// ─── Page Router ───
async function loadPage(page){
  main.innerHTML='<div class="loading"><div class="spinner"></div>Loading...</div>';
  try{
    switch(page){
      case 'dashboard': await renderDashboard(); break;
      case 'query': renderQuery(); break;
      case 'purchase-orders': await renderPOs(); break;
      case 'inventory': await renderInventory(); break;
      case 'vendors': await renderVendors(); break;
      case 'sales-orders': await renderSalesOrders(); break;
      case 'open-items': await renderOpenItems(); break;
      case 'work-orders': await renderWorkOrders(); break;
      case 'approvals': await renderApprovals(); break;
      case 'audit': await renderAudit(); break;
    }
  }catch(e){main.innerHTML=`<p style="color:var(--red)">Error: ${e.message}</p>`}
}

// ═══ DASHBOARD ═══
async function renderDashboard(){
  const [pos,inv,sos,approvals,items]=await Promise.all([
    api('/api/purchase-orders'),api('/api/inventory?below_reorder=true'),
    api('/api/sales-orders'),api('/api/pending-approvals'),api('/api/open-items')
  ]);
  const pendingPOs=pos.data.filter(p=>p.status==='pending').length;
  const totalPOValue=pos.data.reduce((s,p)=>s+p.netPrice,0);
  const totalSOValue=sos.data.reduce((s,o)=>s+o.netValue,0);
  const overdueItems=items.data.filter(i=>i.overdueDays>0);
  document.getElementById('approvalBadge').textContent=approvals.count;

  main.innerHTML=`
    <div class="page-header"><h1>Dashboard</h1><p>Real-time SAP ERP overview via MCP protocol</p></div>
    <div class="stat-grid">
      <div class="stat-card accent"><div class="stat-label">Purchase Orders</div><div class="stat-value">${pos.count}</div><div class="stat-sub">${pendingPOs} pending approval</div></div>
      <div class="stat-card orange"><div class="stat-label">PO Value</div><div class="stat-value">${fmtL(totalPOValue)}</div><div class="stat-sub">Across all active POs</div></div>
      <div class="stat-card green"><div class="stat-label">Sales Pipeline</div><div class="stat-value">${fmtL(totalSOValue)}</div><div class="stat-sub">${sos.count} active orders</div></div>
      <div class="stat-card red"><div class="stat-label">Stock Shortages</div><div class="stat-value">${inv.count}</div><div class="stat-sub">Below reorder point</div></div>
      <div class="stat-card purple"><div class="stat-label">Pending Approvals</div><div class="stat-value">${approvals.count}</div><div class="stat-sub">${approvals.data.filter(a=>a.overdue).length} overdue</div></div>
    </div>
    <div class="table-wrap">
      <div class="table-header"><span class="table-title">Recent Purchase Orders</span><span class="table-count">${pos.count} records</span></div>
      <table><thead><tr><th>PO #</th><th>Vendor</th><th>Material</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${pos.data.slice(0,8).map(po=>`<tr>
        <td class="cell-mono">${po.poNumber}</td><td>${po.vendorName}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${po.materialDescription}</td>
        <td class="cell-amount">${fmt(po.netPrice)}</td><td>${badge(po.status)}</td>
        <td class="cell-mono">${po.createdDate}</td>
      </tr>`).join('')}</tbody></table>
    </div>
    ${overdueItems.length?`<div class="table-wrap">
      <div class="table-header"><span class="table-title">⚠️ Overdue Items</span><span class="table-count">${overdueItems.length}</span></div>
      <table><thead><tr><th>Document</th><th>Partner</th><th>Amount</th><th>Due Date</th><th>Overdue</th></tr></thead>
      <tbody>${overdueItems.map(i=>`<tr>
        <td class="cell-mono">${i.documentNumber}</td><td>${i.name}</td>
        <td class="cell-amount">${fmt(i.amount)}</td><td class="cell-mono">${i.dueDate}</td>
        <td>${badge('overdue')} ${i.overdueDays}d</td>
      </tr>`).join('')}</tbody></table>
    </div>`:''}`;
}

// ═══ QUERY SAP ═══
function renderQuery(){
  main.innerHTML=`
    <div class="page-header"><h1>Query SAP</h1><p>Ask questions in natural language — the MCP tool selector picks the right SAP operation</p></div>
    <div class="query-panel">
      <div class="query-header"><span>🔍</span><h3>SAP Query</h3></div>
      <div class="query-input-wrap">
        <input class="query-input" id="queryInput" placeholder="e.g. Show all pending POs over ₹3L from the last 7 days..." autofocus>
        <button class="query-submit" onclick="runQuery()">Run Query →</button>
      </div>
      <div class="query-result hidden" id="queryResult"><pre id="queryOutput"></pre></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="query-panel" style="cursor:pointer" onclick="quickQuery('pending POs')"><div class="query-header"><h3>📦 Pending POs</h3></div></div>
      <div class="query-panel" style="cursor:pointer" onclick="quickQuery('stock shortages')"><div class="query-header"><h3>🏭 Stock Shortages</h3></div></div>
      <div class="query-panel" style="cursor:pointer" onclick="quickQuery('overdue payments')"><div class="query-header"><h3>📑 Overdue Payments</h3></div></div>
      <div class="query-panel" style="cursor:pointer" onclick="quickQuery('open work orders')"><div class="query-header"><h3>🔧 Open Work Orders</h3></div></div>
    </div>`;
}
async function quickQuery(type){
  const queries={'pending POs':'/api/purchase-orders?status=pending','stock shortages':'/api/inventory?below_reorder=true','overdue payments':'/api/open-items?overdue=true','open work orders':'/api/work-orders?status=open'};
  const data=await api(queries[type]);
  $('#queryInput').value=type;
  $('#queryResult').classList.remove('hidden');
  $('#queryOutput').textContent=JSON.stringify(data,null,2);
}
async function runQuery(){
  const q=$('#queryInput').value.toLowerCase();
  let endpoint='/api/purchase-orders';
  if(q.includes('pending'))endpoint='/api/purchase-orders?status=pending';
  else if(q.includes('inventory')||q.includes('stock')||q.includes('shortage'))endpoint='/api/inventory?below_reorder=true';
  else if(q.includes('vendor'))endpoint='/api/vendors';
  else if(q.includes('sales')||q.includes('order'))endpoint='/api/sales-orders';
  else if(q.includes('delivery'))endpoint='/api/delivery-status';
  else if(q.includes('overdue')||q.includes('payment')||q.includes('open item'))endpoint='/api/open-items?overdue=true';
  else if(q.includes('budget')||q.includes('variance'))endpoint='/api/budget-variance';
  else if(q.includes('work order')||q.includes('maintenance'))endpoint='/api/work-orders';
  else if(q.includes('approval'))endpoint='/api/pending-approvals';
  const data=await api(endpoint);
  $('#queryResult').classList.remove('hidden');
  $('#queryOutput').textContent=JSON.stringify(data,null,2);
}

// ═══ PURCHASE ORDERS ═══
async function renderPOs(){
  const data=await api('/api/purchase-orders');
  main.innerHTML=`
    <div class="page-header"><h1>Purchase Orders</h1><p>MM Module — ${data.count} records from MockERPAdapter</p></div>
    <div class="filter-bar">
      <select class="filter-select" id="poStatusFilter"><option value="">All Status</option><option value="open">Open</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select>
      <button class="filter-btn" onclick="filterPOs()">Apply</button>
    </div>
    <div class="table-wrap" id="poTable"></div>`;
  renderPOTable(data.data);
}
async function filterPOs(){
  const status=$('#poStatusFilter').value;
  const data=await api('/api/purchase-orders'+(status?'?status='+status:''));
  renderPOTable(data.data);
}
function renderPOTable(rows){
  $('#poTable').innerHTML=`<div class="table-header"><span class="table-title">Purchase Orders</span><span class="table-count">${rows.length}</span></div>
  <table><thead><tr><th>PO #</th><th>Vendor</th><th>Material</th><th>Qty</th><th>Amount</th><th>Status</th><th>Created</th><th>Delivery</th></tr></thead>
  <tbody>${rows.map(po=>`<tr><td class="cell-mono">${po.poNumber}</td><td>${po.vendorName}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${po.materialDescription}</td><td>${po.quantity} ${po.unit}</td><td class="cell-amount">${fmt(po.netPrice)}</td><td>${badge(po.status)}</td><td class="cell-mono">${po.createdDate}</td><td class="cell-mono">${po.deliveryDate}</td></tr>`).join('')}</tbody></table>`;
}

// ═══ INVENTORY ═══
async function renderInventory(){
  const data=await api('/api/inventory');
  main.innerHTML=`
    <div class="page-header"><h1>Inventory</h1><p>MM/WM Module — Stock levels across plants</p></div>
    <div class="table-wrap"><div class="table-header"><span class="table-title">Material Stock</span><span class="table-count">${data.count}</span></div>
    <table><thead><tr><th>Material ID</th><th>Description</th><th>Plant</th><th>Stock</th><th>Reorder</th><th>Status</th><th>Price</th></tr></thead>
    <tbody>${data.data.map(m=>{
      const low=m.currentStock<m.reorderPoint;
      return`<tr><td class="cell-mono">${m.materialId}</td><td>${m.description}</td><td>${m.plant}</td><td class="cell-amount" style="color:${low?'var(--red)':'var(--green)'}">${m.currentStock} ${m.unit}</td><td>${m.reorderPoint}</td><td>${low?badge('shortage'):badge('ok')}</td><td class="cell-amount">${fmt(m.standardPrice)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

// ═══ VENDORS ═══
async function renderVendors(){
  const data=await api('/api/vendors');
  main.innerHTML=`
    <div class="page-header"><h1>Vendors</h1><p>MM Module — Vendor master data</p></div>
    <div class="table-wrap"><div class="table-header"><span class="table-title">Vendor Directory</span><span class="table-count">${data.count}</span></div>
    <table><thead><tr><th>ID</th><th>Name</th><th>City</th><th>Rating</th><th>Status</th><th>Open Orders</th><th>YTD Spend</th></tr></thead>
    <tbody>${data.data.map(v=>`<tr><td class="cell-mono">${v.vendorId}</td><td>${v.name}</td><td>${v.city}, ${v.country}</td><td><span class="badge badge-${v.rating==='A'?'approved':v.rating==='B'?'pending':'overdue'}">${v.rating}</span></td><td>${badge(v.status)}</td><td>${v.totalOpenOrders}</td><td class="cell-amount">${fmtL(v.ytdSpend)}</td></tr>`).join('')}</tbody></table></div>`;
}

// ═══ SALES ORDERS ═══
async function renderSalesOrders(){
  const data=await api('/api/sales-orders');
  main.innerHTML=`
    <div class="page-header"><h1>Sales Orders</h1><p>SD Module — Customer orders pipeline</p></div>
    <div class="table-wrap"><div class="table-header"><span class="table-title">Sales Orders</span><span class="table-count">${data.count}</span></div>
    <table><thead><tr><th>Order #</th><th>Customer</th><th>Material</th><th>Qty</th><th>Value</th><th>Status</th><th>Delivery Date</th></tr></thead>
    <tbody>${data.data.map(o=>`<tr><td class="cell-mono">${o.orderNumber}</td><td>${o.customerName}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.materialDescription}</td><td>${o.quantity}</td><td class="cell-amount">${fmt(o.netValue)}</td><td>${badge(o.status)}</td><td class="cell-mono">${o.requestedDeliveryDate}</td></tr>`).join('')}</tbody></table></div>`;
}

// ═══ OPEN ITEMS ═══
async function renderOpenItems(){
  const data=await api('/api/open-items');
  main.innerHTML=`
    <div class="page-header"><h1>Open Items</h1><p>FI Module — Accounts Payable & Receivable</p></div>
    <div class="table-wrap"><div class="table-header"><span class="table-title">Open Line Items</span><span class="table-count">${data.count}</span></div>
    <table><thead><tr><th>Doc #</th><th>Type</th><th>Partner</th><th>Amount</th><th>Due Date</th><th>Overdue</th><th>Status</th></tr></thead>
    <tbody>${data.data.map(i=>`<tr><td class="cell-mono">${i.documentNumber}</td><td>${badge(i.type)}</td><td>${i.name}</td><td class="cell-amount">${fmt(i.amount)}</td><td class="cell-mono">${i.dueDate}</td><td>${i.overdueDays>0?`<span style="color:var(--red)">${i.overdueDays}d</span>`:'—'}</td><td>${badge(i.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

// ═══ WORK ORDERS ═══
async function renderWorkOrders(){
  const data=await api('/api/work-orders');
  main.innerHTML=`
    <div class="page-header"><h1>Work Orders</h1><p>PM Module — Plant maintenance</p></div>
    <div class="table-wrap"><div class="table-header"><span class="table-title">Work Orders</span><span class="table-count">${data.count}</span></div>
    <table><thead><tr><th>WO #</th><th>Description</th><th>Equipment</th><th>Priority</th><th>Status</th><th>Type</th><th>Scheduled</th></tr></thead>
    <tbody>${data.data.map(w=>`<tr><td class="cell-mono">${w.orderNumber}</td><td>${w.description}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w.equipmentName}</td><td>${badge(w.priority)}</td><td>${badge(w.status)}</td><td>${badge(w.type)}</td><td class="cell-mono">${w.scheduledDate}</td></tr>`).join('')}</tbody></table></div>`;
}

// ═══ APPROVALS ═══
async function renderApprovals(){
  const data=await api('/api/pending-approvals');
  document.getElementById('approvalBadge').textContent=data.count;
  main.innerHTML=`
    <div class="page-header"><h1>Pending Approvals</h1><p>Workflow — ${data.count} items awaiting action</p></div>
    <div class="table-wrap" id="approvalTable"><div class="table-header"><span class="table-title">Workflow Queue</span><span class="table-count">${data.count}</span></div>
    <table><thead><tr><th>ID</th><th>Type</th><th>Description</th><th>Amount</th><th>Priority</th><th>Due</th><th>Actions</th></tr></thead>
    <tbody>${data.data.map(w=>`<tr id="row-${w.itemId}"><td class="cell-mono">${w.itemId}</td><td>${badge(w.type.replace(/_/g,' ').toLowerCase())}</td><td style="max-width:250px">${w.description}</td><td class="cell-amount">${fmt(w.amount)}</td><td>${badge(w.priority)}</td><td class="cell-mono">${w.dueDate} ${w.overdue?badge('overdue'):''}</td><td><button class="approve-btn yes" onclick="doApprove('${w.itemId}','approve')">✓ Approve</button><button class="approve-btn no" onclick="doApprove('${w.itemId}','reject')">✕ Reject</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function doApprove(id,action){
  const reason=action==='reject'?prompt('Reason for rejection:'):undefined;
  if(action==='reject'&&!reason)return;
  const res=await fetch(API+'/api/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:id,action,reason})});
  const data=await res.json();
  if(data.success){
    const row=document.getElementById('row-'+id);
    if(row)row.style.opacity='0.3';
    setTimeout(()=>renderApprovals(),500);
  }else{alert(data.message)}
}

// ═══ AUDIT LOG ═══
async function renderAudit(){
  const data=await api('/api/audit-log');
  main.innerHTML=`
    <div class="page-header"><h1>Audit Log</h1><p>All MCP tool invocations — append-only</p></div>
    ${data.length?`<div class="table-wrap"><div class="table-header"><span class="table-title">Recent Activity</span><span class="table-count">${data.length}</span></div>
    <table><thead><tr><th>Time</th><th>Tool</th><th>Result</th><th>Duration</th><th>Adapter</th></tr></thead>
    <tbody>${data.map(e=>`<tr><td class="cell-mono" style="font-size:11px">${new Date(e.timestamp).toLocaleString()}</td><td class="cell-mono">${e.tool}</td><td>${badge(e.result)}</td><td class="cell-mono">${e.durationMs}ms</td><td>${e.adapter}</td></tr>`).join('')}</tbody></table></div>`
    :'<p style="color:var(--text-dim);padding:20px">No audit entries yet. Make some queries first!</p>'}`;
}

// ─── Init ───
loadPage('dashboard');
