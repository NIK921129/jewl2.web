/* =========================================================
   NOVA ADMIN — 30+ management tools in one panel
   ========================================================= */
let PAGE = "dashboard", STATS = null, CACHE = {};

document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.theme = store.get("theme", "dark");
  $("#gateForm").onsubmit = gateSubmit;
  $$("#gate .tabs button").forEach((b) => (b.onclick = () => {
    $$("#gate .tabs button").forEach((x) => x.classList.toggle("active", x === b));
    $("#gName").style.display = b.dataset.tab === "signup" ? "block" : "none";
    $("#gateBtn").textContent = b.dataset.tab === "signup" ? "Create account" : "Login";
    $("#gateForm").dataset.tab = b.dataset.tab;
  }));
  if (auth.token() && auth.isAdmin()) boot();
});

async function gateSubmit(e) {
  e.preventDefault();
  const tab = e.target.dataset.tab || "login";
  const f = Object.fromEntries(new FormData(e.target));
  const btn = $("#gateBtn"); btn.disabled = true; btn.textContent = "Please wait…";
  try {
    const d = await api("/auth/" + tab, { method: "POST", body: { name: f.name, email: f.email.trim(), password: f.password } });
    auth.save(d.token, d.user);
    if (d.user.role !== "admin") { auth.clear(); throw new Error("This account is not an administrator"); }
    boot();
  } catch (err) { toast(err.message, "err"); }
  finally { btn.disabled = false; btn.textContent = tab === "signup" ? "Create account" : "Login"; }
}

function boot() {
  $("#gate").classList.add("hide");
  $("#app").classList.remove("hide");
  $("#whoami").textContent = (auth.user() || {}).email || "admin";
  $$("#menu a[data-page]").forEach((a) => (a.onclick = () => go(a.dataset.page)));
  $("#logout").onclick = () => { auth.clear(); location.reload(); };
  $("#refreshBtn").onclick = () => go(PAGE);
  $("#burger").onclick = () => $("#side").classList.toggle("open");
  $("#themeBtn2").onclick = () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; store.set("theme", t);
  };
  $("#adminModal").onclick = (e) => e.target.id === "adminModal" && closeModal();
  connectSocket();
  go("dashboard");
}

const TITLES = {
  dashboard: ["Dashboard", "Live store overview"],
  analytics: ["Statistics", "Revenue, traffic and product performance"],
  products: ["Products", "Edit, feature, restock or remove items"],
  addproduct: ["Add product", "Create a new catalogue entry"],
  inventory: ["Inventory & stock", "Bulk stock and price tools"],
  reviews: ["Reviews", "Moderate customer feedback"],
  storefront: ["Storefront", "Customize homepage content"],
  orders: ["Orders", "Full order lifecycle management"],
  coupons: ["Coupons", "Discount codes and campaigns"],
  users: ["Customers & IDs", "Create logins, reset passwords, block users"],
  bags: ["Bag lists", "What customers are carrying right now"],
  messages: ["Messages", "Contact form inbox"],
  exports: ["Data export", "Download CSV or JSON backups"],
  settings: ["Settings", "Store configuration and environment"],
};

async function go(p) {
  PAGE = p;
  $$("#menu a").forEach((a) => a.classList.toggle("active", a.dataset.page === p));
  $("#pageTitle").textContent = TITLES[p][0];
  $("#pageSub").textContent = TITLES[p][1];
  $("#side").classList.remove("open");
  $("#page").innerHTML = '<div class="empty">Loading…</div>';
  try { await RENDER[p](); } catch (e) { $("#page").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function connectSocket() {
  const socket = io(API.replace("/api", ""), { auth: { token: auth.token() } });
  socket.on("connect", () => console.log("Live socket connected"));
  socket.on("new_order", (order) => {
    toast(`📦 New order #${order.orderNo} for ${money(order.total)}`);
    if (PAGE === "dashboard" || PAGE === "orders") {
      STATS = null; CACHE.products = null; // Invalidate cache
      go(PAGE);
    }
  });
}

/* ============================ pages ============================ */
const RENDER = {};

/* ---- 1. dashboard ---- */
RENDER.dashboard = async () => {
  STATS = await api("/admin/stats");
  const s = STATS, max = Math.max(1, ...s.days.map((d) => d.revenue));
  $("#page").innerHTML = `
  <div class="stats">
    <div class="stat"><span>Revenue</span><b>${money(s.revenue)}</b><i>all time</i></div>
    <div class="stat"><span>Orders</span><b>${s.orders}</b><i>${s.byStatus.pending || 0} pending</i></div>
    <div class="stat"><span>Products</span><b>${s.products}</b><i>${s.lowStock.length} low stock</i></div>
    <div class="stat"><span>Customers</span><b>${s.users}</b><i>${s.unreadMessages} unread messages</i></div>
    <div class="stat"><span>Avg order value</span><b>${money(s.avgOrder)}</b><i>per order</i></div>
  </div>
  <div class="panel"><h3>Revenue — last 14 days</h3>
    <div class="bars">${s.days.map((d) => `<div style="height:${(d.revenue / max) * 100}%" data-v="${d.date}: ${money(d.revenue)}"></div>`).join("")}</div>
    <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:11px;margin-top:8px"><span>${s.days[0].date}</span><span>${s.days.at(-1).date}</span></div>
  </div>
  <div class="grid2">
    <div class="panel"><h3>Recent orders</h3>${table(
      ["Order", "Email", "Total", "Status"],
      s.recent.map((o) => [`<span class="mono">${esc(o.orderNo)}</span>`, esc(o.email), money(o.total), pill(o.status)])
    )}</div>
    <div class="panel"><h3>Top selling products</h3>${s.topProducts.length ? s.topProducts.map((p) =>
      `<div class="rowline"><span>${esc(p.title)}</span><b>${p.qty} sold</b></div>`).join("") : '<div class="empty">No sales yet.</div>'}</div>
  </div>
  <div class="panel"><h3>⚠️ Low stock alerts</h3>${s.lowStock.length ? s.lowStock.map((p) =>
    `<div class="rowline"><span>${esc(p.title)}</span><span class="pill ${p.stock ? "pending" : "cancelled"}">${p.stock} left</span></div>`).join("") : '<div class="empty">All products are well stocked.</div>'}</div>`;
};

/* ---- 2. analytics ---- */
RENDER.analytics = async () => {
  const s = STATS || (STATS = await api("/admin/stats"));
  const prods = (CACHE.products = await api("/admin/products"));
  const byCat = {}; prods.forEach((p) => (byCat[p.category] = (byCat[p.category] || 0) + 1));
  const inventoryValue = prods.reduce((a, p) => a + p.price * p.stock, 0);
  const maxO = Math.max(1, ...s.days.map((d) => d.orders));
  $("#page").innerHTML = `
  <div class="stats">
    <div class="stat"><span>Inventory value</span><b>${money(inventoryValue)}</b></div>
    <div class="stat"><span>Conversion (demo)</span><b>${s.users ? Math.round((s.orders / Math.max(1, s.users)) * 100) : 0}%</b></div>
    <div class="stat"><span>Total views</span><b>${prods.reduce((a, p) => a + (p.views || 0), 0)}</b></div>
    <div class="stat"><span>Categories</span><b>${Object.keys(byCat).length}</b></div>
  </div>
  <div class="panel"><h3>Orders per day</h3><div class="bars">${s.days.map((d) => `<div style="height:${(d.orders / maxO) * 100}%" data-v="${d.date}: ${d.orders} orders"></div>`).join("")}</div></div>
  <div class="grid2">
    <div class="panel"><h3>Orders by status</h3>${Object.entries(s.byStatus).length ? Object.entries(s.byStatus).map(([k, v]) =>
      `<div class="rowline">${pill(k)}<b>${v}</b></div>`).join("") : '<div class="empty">No orders yet.</div>'}</div>
    <div class="panel"><h3>Products per category</h3>${Object.entries(byCat).map(([k, v]) =>
      `<div class="rowline"><span>${esc(k)}</span><b>${v}</b></div>`).join("")}</div>
  </div>
  <div class="panel"><h3>Most viewed products</h3>${table(["Product", "Views", "Rating", "Stock", "Price"],
    [...prods].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10)
      .map((p) => [esc(p.title), p.views || 0, `<span class="stars">${stars(p.rating)}</span>`, p.stock, money(p.price)]))}</div>`;
};

/* ---- 3. products ---- */
RENDER.products = async () => {
  const items = (CACHE.products = await api("/admin/products"));
  $("#page").innerHTML = `
  <div class="panel">
    <div class="toolbar">
      <input class="input" id="pq" placeholder="Search products…" style="max-width:280px" />
      <select class="input" id="pcat" style="width:auto"><option value="">All categories</option>${[...new Set(items.map((i) => i.category))].map((c) => `<option>${esc(c)}</option>`).join("")}</select>
      <button class="btn btn-primary btn-sm" onclick="go('addproduct')">➕ New product</button>
      <button class="btn btn-ghost btn-sm" id="bulkDel">Delete selected</button>
      <button class="btn btn-ghost btn-sm" id="bulkFeat">Feature selected</button>
    </div>
    <div class="tbl-wrap" id="ptable"></div>
  </div>`;
  const draw = () => {
    const q = $("#pq").value.toLowerCase(), c = $("#pcat").value;
    const rows = items.filter((p) => (!q || p.title.toLowerCase().includes(q)) && (!c || p.category === c));
    $("#ptable").innerHTML = table(
      ['<input type="checkbox" id="all">', "Product", "Category", "Price", "Stock", "Rating", "Status", "Actions"],
      rows.map((p) => [
        `<input type="checkbox" class="sel" value="${p._id}">`,
        `<div style="display:flex;gap:10px;align-items:center"><img class="thumb" src="${esc(p.image)}" alt=""><div><b>${esc(p.title)}</b><div class="mono" style="color:var(--muted)">${esc(p._id)}</div></div></div>`,
        esc(p.category), money(p.price),
        `<span class="pill ${p.stock > 5 ? "paid" : p.stock ? "pending" : "cancelled"}">${p.stock}</span>`,
        `<span class="stars">${stars(p.rating)}</span>`,
        p.active ? '<span class="pill paid">active</span>' : '<span class="pill cancelled">hidden</span>',
        `<button class="btn btn-sm btn-ghost" data-edit="${p._id}">Edit</button>
         <button class="btn btn-sm btn-ghost" data-toggle="${p._id}">${p.active ? "Hide" : "Show"}</button>
         <button class="btn btn-sm btn-danger" data-del="${p._id}">Delete</button>`,
      ])
    );
    $("#all").onclick = (e) => $$(".sel").forEach((s) => (s.checked = e.target.checked));
    $$("[data-edit]").forEach((b) => (b.onclick = () => productForm(items.find((x) => x._id === b.dataset.edit))));
    $$("[data-toggle]").forEach((b) => (b.onclick = async () => {
      const p = items.find((x) => x._id === b.dataset.toggle);
      await api("/admin/products/" + p._id, { method: "PUT", body: { active: !p.active } }); toast("Updated"); go("products");
    }));
    $$("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Delete this product?")) return;
      await api("/admin/products/" + b.dataset.del, { method: "DELETE" }); toast("Product deleted"); go("products");
    }));
  };
  $("#pq").oninput = draw; $("#pcat").onchange = draw;
  const sel = () => $$(".sel:checked").map((s) => s.value);
  $("#bulkDel").onclick = async () => { if (!sel().length || !confirm("Delete selected products?")) return; await api("/admin/products/bulk", { method: "POST", body: { ids: sel(), action: "delete" } }); go("products"); };
  $("#bulkFeat").onclick = async () => { if (!sel().length) return; await api("/admin/products/bulk", { method: "POST", body: { ids: sel(), action: "feature", value: true } }); toast("Featured"); go("products"); };
  draw();
};

/* ---- 4. add / edit product ---- */
RENDER.addproduct = async () => productForm(null, true);

function productForm(p, inline = false) {
  const html = `
    <form id="pf">
      <div class="grid2">
        <label class="field"><span>Title *</span><input class="input" name="title" required value="${esc(p?.title || "")}" /></label>
        <label class="field"><span>Category *</span><input class="input" name="category" required value="${esc(p?.category || "General")}" /></label>
        <label class="field"><span>Brand</span><input class="input" name="brand" value="${esc(p?.brand || "")}" /></label>
        <label class="field"><span>SKU / Product ID</span><input class="input" name="sku" value="${esc(p?.sku || "")}" /></label>
        <label class="field"><span>Price *</span><input class="input" name="price" type="number" min="0" required value="${p?.price ?? ""}" /></label>
        <label class="field"><span>Compare-at price</span><input class="input" name="compareAtPrice" type="number" min="0" value="${p?.compareAtPrice ?? 0}" /></label>
        <label class="field"><span>Stock</span><input class="input" name="stock" type="number" value="${p?.stock ?? 0}" /></label>
        <label class="field"><span>Rating</span><input class="input" name="rating" type="number" step="0.1" max="5" value="${p?.rating ?? 4.5}" /></label>
      </div>
      <label class="field"><span>Image URL</span><input class="input" name="image" value="${esc(p?.image || "")}" placeholder="https://…" /></label>
      <label class="field"><span>Description</span><textarea class="input" name="description">${esc(p?.description || "")}</textarea></label>
      <label class="field"><span>Tags (comma separated)</span><input class="input" name="tags" value="${esc((p?.tags || []).join(", "))}" /></label>
      <div style="display:flex;gap:18px;margin:10px 0 18px;font-size:14px">
        <label><input type="checkbox" name="featured" ${p?.featured ? "checked" : ""}> Featured</label>
        <label><input type="checkbox" name="active" ${p?.active !== false ? "checked" : ""}> Visible in store</label>
      </div>
      <button class="btn btn-primary">${p ? "Save changes" : "Create product"}</button>
    </form>`;
  if (inline) $("#page").innerHTML = `<div class="panel" style="max-width:820px">${html}</div>`;
  else openModal(`<div class="modal-head"><h3>Edit product</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>${html}`, true);
  $("#pf").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const body = { ...f, price: +f.price, compareAtPrice: +f.compareAtPrice, stock: +f.stock, rating: +f.rating,
      tags: f.tags ? f.tags.split(",").map((t) => t.trim()) : [], featured: !!f.featured, active: !!f.active };
    try {
      if (p) await api("/admin/products/" + p._id, { method: "PUT", body });
      else await api("/admin/products", { method: "POST", body });
      toast(p ? "Product updated" : "Product created"); closeModal(); go("products");
    } catch (err) { toast(err.message, "err"); }
  };
}

/* ---- NEW: storefront ---- */
RENDER.storefront = async () => {
  const s = await api("/settings/storefront");
  $("#page").innerHTML = `
  <div class="panel" style="max-width:820px"><h3>Hero section</h3>
    <form id="sf">
      <label class="field"><span>Pill text</span><input class="input" name="pill" value="${esc(s.pill || "New season drop")}" /></label>
      <label class="field"><span>Headline</span><textarea class="input" name="headline">${esc(s.headline || "Gear that feels <em>designed for you</em>.")}</textarea></label>
      <label class="field"><span>Sub-headline</span><textarea class="input" name="subheadline">${esc(s.subheadline || "A tight, curated catalogue of audio, wearables and everyday carry — tested by us, priced fairly, delivered fast. No account needed until you check out.")}</textarea></label>
      <label class="field"><span>Image URL</span><input class="input" name="image" value="${esc(s.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80")}" /></label>
      <div class="grid2">
        <label class="field"><span>Button 1 text</span><input class="input" name="cta1_text" value="${esc(s.cta1_text || "Shop the collection")}" /></label>
        <label class="field"><span>Button 1 link</span><input class="input" name="cta1_link" value="${esc(s.cta1_link || "#shop")}" /></label>
        <label class="field"><span>Button 2 text</span><input class="input" name="cta2_text" value="${esc(s.cta2_text || "See today's deals")}" /></label>
        <label class="field"><span>Button 2 link</span><input class="input" name="cta2_link" value="${esc(s.cta2_link || "#deals")}" /></label>
      </div>
      <button class="btn btn-primary">Save changes</button>
    </form>
  </div>`;
  $("#sf").onsubmit = async (e) => {
    e.preventDefault();
    const value = Object.fromEntries(new FormData(e.target));
    await api("/admin/settings", { method: "PUT", body: { key: "storefront", value } });
    toast("Storefront updated");
    go("storefront");
  };
};

/* ---- 5. inventory ---- */
RENDER.inventory = async () => {
  const items = await api("/admin/products");
  $("#page").innerHTML = `
  <div class="panel"><h3>Bulk tools</h3>
    <div class="toolbar">
      <select class="input" id="bulkAction" style="width:auto">
        <option value="stock">Set stock to</option><option value="price">Set price to</option>
        <option value="activate">Set visibility</option><option value="feature">Set featured</option>
      </select>
      <input class="input" id="bulkValue" placeholder="value (number or 1/0)" style="max-width:200px" />
      <button class="btn btn-primary btn-sm" id="applyBulk">Apply to selected</button>
    </div>
    <div class="tbl-wrap" id="itable"></div>
  </div>`;
  $("#itable").innerHTML = table(
    ['<input type="checkbox" id="all">', "Product", "SKU", "Stock", "Value", "Restock"],
    [...items].sort((a, b) => a.stock - b.stock).map((p) => [
      `<input type="checkbox" class="sel" value="${p._id}">`, esc(p.title), `<span class="mono">${esc(p.sku || p._id.slice(-6))}</span>`,
      `<span class="pill ${p.stock > 5 ? "paid" : p.stock ? "pending" : "cancelled"}">${p.stock}</span>`,
      money(p.price * p.stock),
      `<button class="btn btn-sm btn-ghost" data-add10="${p._id}">+10</button>`,
    ])
  );
  $("#all").onclick = (e) => $$(".sel").forEach((s) => (s.checked = e.target.checked));
  $$("[data-add10]").forEach((b) => (b.onclick = async () => {
    const p = items.find((x) => x._id === b.dataset.add10);
    await api("/admin/products/" + p._id, { method: "PUT", body: { stock: p.stock + 10 } }); toast("Restocked +10"); go("inventory");
  }));
  $("#applyBulk").onclick = async () => {
    const ids = $$(".sel:checked").map((s) => s.value);
    if (!ids.length) return toast("Select some products first", "err");
    await api("/admin/products/bulk", { method: "POST", body: { ids, action: $("#bulkAction").value, value: $("#bulkValue").value } });
    toast("Bulk update applied"); go("inventory");
  };
};

/* ---- 6. orders ---- */
const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
RENDER.orders = async () => {
  const orders = await api("/admin/orders");
  $("#page").innerHTML = `
  <div class="stats">
    ${STATUSES.map((s) => `<div class="stat"><span>${s}</span><b>${orders.filter((o) => o.status === s).length}</b></div>`).join("")}
  </div>
  <div class="panel">
    <div class="toolbar">
      <input class="input" id="oq" placeholder="Search order no / email…" style="max-width:280px" />
      <select class="input" id="ost" style="width:auto"><option value="">All statuses</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select>
      <button class="btn btn-ghost btn-sm" onclick="downloadCSV('orders')">⬇️ Export CSV</button>
    </div>
    <div class="tbl-wrap" id="otable"></div>
  </div>`;
  const draw = () => {
    const q = $("#oq").value.toLowerCase(), st = $("#ost").value;
    const rows = orders.filter((o) => (!q || (o.orderNo + o.email).toLowerCase().includes(q)) && (!st || o.status === st));
    $("#otable").innerHTML = table(["Order", "Date", "Customer", "Items", "Total", "Payment", "Status", "Actions"],
      rows.map((o) => [
        `<span class="mono">${esc(o.orderNo)}</span>`, dt(o.createdAt), esc(o.email), o.items.length, money(o.total), esc(o.paymentMethod || "cod"),
        `<select class="input" data-st="${o._id}" style="padding:5px 8px">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>`,
        `<button class="btn btn-sm btn-ghost" data-inv="${o._id}">View</button><button class="btn btn-sm btn-danger" data-odel="${o._id}">Delete</button>`,
      ]));
    $$("[data-st]").forEach((s) => (s.onchange = async () => {
      await api("/admin/orders/" + s.dataset.st, { method: "PUT", body: { status: s.value } }); toast("Status updated");
    }));
    $$("[data-odel]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Delete this order?")) return;
      await api("/admin/orders/" + b.dataset.odel, { method: "DELETE" }); go("orders");
    }));
    $$("[data-inv]").forEach((b) => (b.onclick = () => invoice(orders.find((o) => o._id === b.dataset.inv))));
  };
  $("#oq").oninput = draw; $("#ost").onchange = draw; draw();
};

function invoice(o) {
  openModal(`
    <div class="modal-head"><div><h3>${esc(o.orderNo)}</h3><p>${dt(o.createdAt)} · ${esc(o.email)}</p></div>
      <button class="icon-btn" onclick="closeModal()">✕</button></div>
    ${table(["Item", "Qty", "Price", "Total"], o.items.map((i) => [esc(i.title), i.qty, money(i.price), money(i.price * i.qty)]))}
    <div style="margin-top:14px">
      <div class="sumline"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      <div class="sumline"><span>Discount ${o.coupon ? "(" + esc(o.coupon) + ")" : ""}</span><span>−${money(o.discount)}</span></div>
      <div class="sumline"><span>Shipping</span><span>${money(o.shipping)}</span></div>
      <div class="sumline total"><span>Total</span><span>${money(o.total)}</span></div>
    </div>
    <div class="panel" style="margin-top:14px"><h3>Shipping address</h3>
      <p style="color:var(--muted);font-size:13px">${Object.entries(o.shippingAddress || {}).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join("<br>") || "—"}</p></div>
    <label class="field"><span>Tracking number</span><input class="input" id="trk" value="${esc(o.tracking || "")}" /></label>
    <div style="display:flex;gap:10px"><button class="btn btn-primary" id="saveTrk">Save tracking</button>
      <button class="btn btn-ghost" onclick="window.print()">🖨️ Print invoice</button></div>`);
  $("#saveTrk").onclick = async () => {
    await api("/admin/orders/" + o._id, { method: "PUT", body: { tracking: $("#trk").value } }); toast("Tracking saved"); closeModal();
  };
}

/* ---- 7. coupons ---- */
RENDER.coupons = async () => {
  const cs = await api("/admin/coupons");
  $("#page").innerHTML = `
  <div class="grid2">
    <div class="panel"><h3>Create coupon</h3>
      <form id="cf">
        <label class="field"><span>Code</span><input class="input" name="code" required placeholder="SUMMER20" /></label>
        <div class="grid2">
          <label class="field"><span>Type</span><select class="input" name="type"><option value="percent">Percent %</option><option value="flat">Flat amount</option></select></label>
          <label class="field"><span>Value</span><input class="input" name="value" type="number" required value="10" /></label>
        </div>
        <label class="field"><span>Minimum order</span><input class="input" name="minOrder" type="number" value="0" /></label>
        <button class="btn btn-primary btn-block">Create coupon</button>
      </form></div>
    <div class="panel"><h3>Active coupons</h3><div class="tbl-wrap">${table(["Code", "Type", "Value", "Min", "Used", "Actions"],
      cs.map((c) => [`<b class="mono">${esc(c.code)}</b>`, c.type, c.type === "percent" ? c.value + "%" : money(c.value), money(c.minOrder), c.usedCount || 0,
        `<button class="btn btn-sm btn-danger" data-cdel="${c._id}">Delete</button>`]))}</div></div>
  </div>`;
  $("#cf").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await api("/admin/coupons", { method: "POST", body: { ...f, code: f.code.toUpperCase(), value: +f.value, minOrder: +f.minOrder, active: true } });
    toast("Coupon created"); go("coupons");
  };
  $$("[data-cdel]").forEach((b) => (b.onclick = async () => { await api("/admin/coupons/" + b.dataset.cdel, { method: "DELETE" }); go("coupons"); }));
};

/* ---- 8. users ---- */
RENDER.users = async () => {
  const us = await api("/admin/users");
  $("#page").innerHTML = `
  <div class="grid2">
    <div class="panel"><h3>Create a new login ID</h3>
      <form id="uf">
        <label class="field"><span>Name</span><input class="input" name="name" /></label>
        <label class="field"><span>Email (login id)</span><input class="input" name="email" type="email" required /></label>
        <label class="field"><span>Password</span><input class="input" name="password" required value="123456" /></label>
        <label class="field"><span>Role</span><select class="input" name="role"><option value="customer">Customer</option><option value="admin">Admin</option></select></label>
        <button class="btn btn-primary btn-block">Create account</button>
      </form></div>
    <div class="panel"><h3>Quick stats</h3>
      <div class="rowline"><span>Total customers</span><b>${us.length}</b></div>
      <div class="rowline"><span>Admins</span><b>${us.filter((u) => u.role === "admin").length}</b></div>
      <div class="rowline"><span>Blocked</span><b>${us.filter((u) => u.blocked).length}</b></div>
      <div class="rowline"><span>Buyers</span><b>${us.filter((u) => u.orderCount).length}</b></div>
      <div class="rowline"><span>Lifetime value</span><b>${money(us.reduce((s, u) => s + (u.spent || 0), 0))}</b></div>
    </div>
  </div>
  <div class="panel"><h3>All accounts</h3><div class="tbl-wrap">${table(
    ["Name", "Email / ID", "Role", "Orders", "Spent", "Joined", "Actions"],
    us.map((u) => [esc(u.name || "—"), `<span class="mono">${esc(u.email)}</span>`,
      u.role === "admin" ? '<span class="pill paid">admin</span>' : '<span class="pill processing">customer</span>',
      u.orderCount || 0, money(u.spent || 0), dt(u.createdAt),
      `<button class="btn btn-sm btn-ghost" data-pw="${u._id}">Reset password</button>
       <button class="btn btn-sm btn-ghost" data-block="${u._id}">${u.blocked ? "Unblock" : "Block"}</button>
       <button class="btn btn-sm btn-danger" data-udel="${u._id}">Delete</button>`]))}</div></div>`;
  $("#uf").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/admin/users", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); toast("Account created"); go("users"); }
    catch (err) { toast(err.message, "err"); }
  };
  $$("[data-pw]").forEach((b) => (b.onclick = async () => {
    const pw = prompt("New password for this user:", "123456"); if (!pw) return;
    await api("/admin/users/" + b.dataset.pw, { method: "PUT", body: { password: pw } }); toast("Password reset");
  }));
  $$("[data-block]").forEach((b) => (b.onclick = async () => {
    const u = us.find((x) => x._id === b.dataset.block);
    await api("/admin/users/" + u._id, { method: "PUT", body: { blocked: !u.blocked } }); go("users");
  }));
  $$("[data-udel]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Delete this account?")) return;
    await api("/admin/users/" + b.dataset.udel, { method: "DELETE" }); go("users");
  }));
};

/* ---- 9. bag lists ---- */
RENDER.bags = async () => {
  const us = await api("/admin/users");
  const withBag = us.filter((u) => (u.bag || []).length);
  $("#page").innerHTML = `<div class="panel"><h3>Saved bags (abandoned carts)</h3>
    ${withBag.length ? withBag.map((u) => `<div class="panel" style="background:var(--surface-2)">
      <b>${esc(u.email)}</b> · ${u.bag.length} item(s)
      ${u.bag.map((i) => `<div class="rowline"><span>${esc(i.title || i.productId)} × ${i.qty || 1}</span><b>${money((i.price || 0) * (i.qty || 1))}</b></div>`).join("")}
    </div>`).join("") : '<div class="empty">No saved bags yet. Bags sync when customers log in and add items.</div>'}
  </div>
  <div class="panel"><h3>Wishlist activity</h3>${table(["Customer", "Wishlist items"],
    us.map((u) => [esc(u.email), (u.wishlist || []).length]))}</div>`;
};

/* ---- 10. reviews ---- */
RENDER.reviews = async () => {
  const rs = await api("/admin/reviews");
  $("#page").innerHTML = `<div class="panel"><h3>Customer reviews</h3><div class="tbl-wrap">${table(
    ["Date", "Author", "Rating", "Comment", ""],
    rs.map((r) => [dt(r.createdAt), esc(r.name || r.email || "—"), `<span class="stars">${stars(r.rating)}</span>`, esc(r.comment),
      `<button class="btn btn-sm btn-danger" data-rdel="${r._id}">Delete</button>`]))}</div></div>`;
  $$("[data-rdel]").forEach((b) => (b.onclick = async () => { await api("/admin/reviews/" + b.dataset.rdel, { method: "DELETE" }); go("reviews"); }));
};

/* ---- 11. messages ---- */
RENDER.messages = async () => {
  const ms = await api("/admin/messages");
  $("#page").innerHTML = `<div class="panel"><h3>Inbox (${ms.filter((m) => !m.read).length} unread)</h3>
    ${ms.length ? ms.map((m) => `<div class="panel" style="background:var(--surface-2)">
      <div style="display:flex;justify-content:space-between"><b>${esc(m.email)}</b><span style="color:var(--muted);font-size:12px">${dt(m.createdAt)}</span></div>
      <p style="color:var(--muted);font-size:14px;margin:8px 0">${esc(m.message)}</p>
      <div style="display:flex;gap:8px">
        <a class="btn btn-sm btn-ghost" href="mailto:${esc(m.email)}">Reply by email</a>
        ${m.read ? "" : `<button class="btn btn-sm btn-primary" data-mread="${m._id}">Mark read</button>`}
        <button class="btn btn-sm btn-danger" data-mdel="${m._id}">Delete</button></div></div>`).join("")
      : '<div class="empty">No messages yet.</div>'}</div>`;
  $$("[data-mread]").forEach((b) => (b.onclick = async () => { await api("/admin/messages/" + b.dataset.mread, { method: "PUT" }); go("messages"); }));
  $$("[data-mdel]").forEach((b) => (b.onclick = async () => { await api("/admin/messages/" + b.dataset.mdel, { method: "DELETE" }); go("messages"); }));
};

/* ---- 12. exports ---- */
RENDER.exports = async () => {
  const kinds = ["orders", "products", "users", "coupons", "reviews", "messages"];
  $("#page").innerHTML = `<div class="panel"><h3>Download your store data</h3>
    <p style="color:var(--muted);font-size:14px;margin-bottom:14px">Exports open as a file download. CSV opens in Excel or Google Sheets.</p>
    ${kinds.map((k) => `<div class="rowline"><b style="text-transform:capitalize">${k}</b><span style="display:flex;gap:8px">
      <button class="btn btn-sm btn-primary" onclick="downloadCSV('${k}')">CSV</button>
      <button class="btn btn-sm btn-ghost" onclick="downloadJSON('${k}')">JSON</button></span></div>`).join("")}
  </div>`;
};

async function downloadCSV(type) {
  const rows = await api(`/admin/export/${type}?format=json`);
  const list = Array.isArray(rows) ? rows : [];
  const keys = [...new Set(list.flatMap((r) => Object.keys(r)))];
  const csv = [keys.join(","), ...list.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  save(csv, `${type}.csv`, "text/csv");
}
async function downloadJSON(type) {
  const rows = await api(`/admin/export/${type}?format=json`);
  save(JSON.stringify(rows, null, 2), `${type}.json`, "application/json");
}
function save(text, name, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
  toast("Download started");
}

/* ---- 13. settings ---- */
RENDER.settings = async () => {
  $("#page").innerHTML = `
  <div class="grid2">
    <div class="panel"><h3>Connection</h3>
      <div class="rowline"><span>API base url</span><span class="mono">${esc(CFG.API_BASE_URL)}</span></div>
      <div class="rowline"><span>Mode</span>${isDemo() ? '<span class="pill pending">Demo (offline data)</span>' : '<span class="pill paid">Live API</span>'}</div>
      <div class="rowline"><span>Signed in as</span><b>${esc((auth.user() || {}).email)}</b></div>
      <p style="color:var(--muted);font-size:13px;margin-top:10px">Change the API url in <span class="mono">public/assets/js/config.js</span>, and backend keys in <span class="mono">server/.env</span>.</p>
    </div>
    <div class="panel"><h3>Environment variables checklist</h3>
      ${["MONGODB_URI", "JWT_SECRET", "ADMIN_ID", "ADMIN_PASSWORD", "CURRENCY", "SHIPPING_FEE", "FREE_SHIPPING_OVER", "CORS_ORIGIN", "PORT"]
        .map((k) => `<div class="rowline"><span class="mono">${k}</span><span class="pill processing">server/.env</span></div>`).join("")}
    </div>
  </div>
  <div class="panel"><h3>Danger zone</h3>
    <div class="rowline"><span>Reset local demo data</span><button class="btn btn-sm btn-danger" id="resetDemo">Reset</button></div>
  </div>`;
  $("#resetDemo").onclick = () => { store.del("demo_db"); toast("Demo data reset"); go("dashboard"); };
};

/* ============================ ui utils ============================ */
function table(head, rows) {
  return `<div class="tbl-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${head.length}" class="empty">Nothing here yet.</td></tr>`}</tbody></table></div>`;
}
const pill = (s) => `<span class="pill ${s}">${s}</span>`;
function openModal(html) { $("#adminModalBody").innerHTML = html; $("#adminModal").classList.add("open"); }
function closeModal() { $("#adminModal").classList.remove("open"); }
