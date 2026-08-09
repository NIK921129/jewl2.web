/* =========================================================
   NOVA STORE — storefront logic
   ========================================================= */
let PRODUCTS = [], CATS = [], STATE = { cat: "all", q: "", sort: "new", price: "" };
let CART = store.get("cart", []), WISH = store.get("wish", []), COUPON = null;

/* --------------------------- boot --------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#year").textContent = new Date().getFullYear();
  document.documentElement.dataset.theme = store.get("theme", "dark");
  $("#marquee").innerHTML = new Array(2).fill('<span>Free shipping over ₹999</span><span>7-day returns</span><span>24h dispatch</span><span>Secure checkout</span><span>Verified reviews</span><span>Coupon WELCOME10</span>').join("");
  bindUI();
  loadProducts();
  loadStorefront();
  loadChatWidget();
  renderCart();
  renderWish();
  dealTimer();
});

function bindUI() {
  $("#themeBtn").onclick = () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; store.set("theme", t);
  };
  $("#cartBtn").onclick = () => openCart("cart");
  $("#wishBtn").onclick = () => openCart("wish");
  $("#accountBtn").onclick = () => (auth.token() ? openAccount() : openAuth("login"));
  $("#footLogin").onclick = (e) => { e.preventDefault(); auth.token() ? openAccount() : openAuth("login"); };
  $("#footOrders").onclick = (e) => { e.preventDefault(); auth.token() ? openAccount() : openAuth("login"); };
  $("#overlay").onclick = closeAll;
  $$("[data-close]").forEach((b) => (b.onclick = closeAll));
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());

  let t;
  $("#search").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { STATE.q = e.target.value.trim(); loadProducts(); }, 300); };
  $("#sort").onchange = (e) => { STATE.sort = e.target.value; loadProducts(); };
  $("#priceRange").onchange = (e) => { STATE.price = e.target.value; loadProducts(); };

  // auth modal tabs
  $$("#authModal .tabs button").forEach((b) => (b.onclick = () => openAuth(b.dataset.tab, AFTER_AUTH_CHECKOUT)));
  $("#authForm").onsubmit = submitAuth;
  $("#newsForm").onsubmit = (e) => { e.preventDefault(); e.target.reset(); toast("Subscribed! Use code WELCOME10 🎉"); };
  $("#contactForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await api("/contact", { method: "POST", body: { email: f.get("email"), message: f.get("message") } }); e.target.reset(); toast("Message sent — we'll reply soon."); }
    catch (err) { toast(err.message, "err"); }
  };
  window.addEventListener("scroll", () => $("#backTop").classList.toggle("show", scrollY > 700));
  $("#backTop").onclick = () => scrollTo({ top: 0, behavior: "smooth" });
}

async function loadStorefront() {
  try {
    const s = await api("/settings/storefront");
    if (s.pill) $(".hero .pill").textContent = s.pill;
    if (s.headline) $(".hero h1").innerHTML = s.headline;
    if (s.subheadline) $(".hero p").textContent = s.subheadline;
    if (s.image) $(".hero-art img").src = s.image;
    if (s.cta1_text) $(".hero-cta a:first-child").textContent = s.cta1_text;
    if (s.cta1_link) $(".hero-cta a:first-child").href = s.cta1_link;
    if (s.cta2_text) $(".hero-cta a:last-child").textContent = s.cta2_text;
    if (s.cta2_link) $(".hero-cta a:last-child").href = s.cta2_link;
  } catch (e) {
    console.warn("Could not load storefront settings:", e.message);
  }
}

async function loadChatWidget() {
  try {
    const s = await api("/settings/chat_widget"); // A new, simple public endpoint
    if (!s.propertyId || !s.widgetId) return;
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_API.onLoad = () => {
      const u = auth.user();
      if (u) window.Tawk_API.setAttributes({ name: u.name, email: u.email });
    };
    const script = document.createElement("script");
    script.src = `https://embed.tawk.to/${s.propertyId}/${s.widgetId}`;
    script.async = true;
    document.head.appendChild(script);
  } catch (e) { console.warn("Could not load chat widget:", e.message); }
}

/* --------------------------- catalogue --------------------------- */
async function loadProducts() {
  $("#grid").innerHTML = new Array(8).fill('<div class="skeleton"></div>').join("");
  const p = new URLSearchParams({ q: STATE.q, category: STATE.cat, sort: STATE.sort });
  if (STATE.price) { const [a, b] = STATE.price.split("-"); p.set("min", a); p.set("max", b); }
  try {
    const data = await api("/products?" + p);
    PRODUCTS = data.items; CATS = data.categories || [];
    $("#statProducts").textContent = data.total + "+";
    $("#resultCount").textContent = `${data.total} product${data.total === 1 ? "" : "s"} available`;
    $("#apiState").textContent = isDemo() ? "Demo mode — connect your API in assets/js/config.js" : "Live API connected";
    renderCats(); renderGrid(); renderDeals();
  } catch (e) {
    $("#grid").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function renderCats() {
  $("#cats").innerHTML = ["all", ...CATS].map((c) =>
    `<button class="chip ${STATE.cat === c ? "active" : ""}" data-cat="${esc(c)}">${c === "all" ? "All" : esc(c)}</button>`).join("");
  $$("#cats .chip").forEach((b) => (b.onclick = () => { STATE.cat = b.dataset.cat; loadProducts(); }));
}

const cardHtml = (p) => {
  const off = p.compareAtPrice > p.price ? Math.round(100 - (p.price / p.compareAtPrice) * 100) : 0;
  const out = p.stock <= 0;
  return `<article class="card">
    <div class="card-img" data-view="${p._id}">
      <img loading="lazy" src="${esc(p.image)}" alt="${esc(p.title)}" />
      <div class="card-tags">
        ${p.featured ? '<span class="tag">Featured</span>' : ""}
        ${off ? `<span class="tag sale">-${off}%</span>` : ""}
        ${out ? '<span class="tag out">Sold out</span>' : ""}
      </div>
      <button class="wish ${WISH.includes(p._id) ? "on" : ""}" data-wish="${p._id}">♥</button>
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(p.category)}</span>
      <span class="card-title">${esc(p.title)}</span>
      <span class="stars">${stars(p.rating)} <span style="color:var(--muted)">${p.rating || 0}</span></span>
      <div class="price-row"><span class="price">${money(p.price)}</span>${off ? `<span class="strike">${money(p.compareAtPrice)}</span>` : ""}</div>
    </div>
    <div class="card-actions">
      <button class="btn btn-primary btn-sm" style="flex:1" data-add="${p._id}" ${out ? "disabled" : ""}>${out ? "Sold out" : "Add to bag"}</button>
      <button class="btn btn-ghost btn-sm" data-view="${p._id}">View</button>
    </div>
  </article>`;
};

function renderGrid() {
  const g = $("#grid");
  g.innerHTML = PRODUCTS.length ? PRODUCTS.map(cardHtml).join("") : '<div class="empty">No products match your filters.</div>';
  wireCards(g);
}
function renderDeals() {
  const deals = PRODUCTS.filter((p) => p.compareAtPrice > p.price).slice(0, 4);
  const g = $("#dealsGrid");
  g.innerHTML = deals.length ? deals.map(cardHtml).join("") : '<div class="empty">No active deals right now.</div>';
  wireCards(g);
}
function wireCards(root) {
  $$("[data-add]", root).forEach((b) => (b.onclick = () => addToCart(b.dataset.add)));
  $$("[data-view]", root).forEach((b) => (b.onclick = () => openProduct(b.dataset.view)));
  $$("[data-wish]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleWish(b.dataset.wish); }));
}

function dealTimer() {
  setInterval(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    $("#dealTimer").textContent = `Ends in ${String((s / 3600) | 0).padStart(2, "0")}:${String(((s / 60) | 0) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, 1000);
}

/* --------------------------- product detail --------------------------- */
async function openProduct(id) {
  open$("#prodModal");
  $("#prodBody").innerHTML = '<div class="empty">Loading…</div>';
  try {
    const { product: p, reviews } = await api("/products/" + id);
    $("#prodBody").innerHTML = `
      <div class="modal-head"><div><h3>${esc(p.title)}</h3><p>${esc(p.category)} · ${esc(p.brand || "NOVA")}</p></div>
      <button class="icon-btn" data-close>✕</button></div>
      <div class="detail"> 
        <div class="gallery">
          <img id="mainImg" src="${esc(p.image)}" alt="${esc(p.title)}" />
          <div class="thumbs">
            ${[p.image, ...(p.gallery || [])].map(img => 
              `<img src="${esc(img)}" class="${img === p.image ? 'active' : ''}" onclick="document.getElementById('mainImg').src=this.src; $$('.thumbs img').forEach(i=>i.classList.remove('active')); this.classList.add('active');" />`
            ).join("")}
          </div>
        </div>
        <div class="info">
          <div class="stars">${stars(p.rating)} <span style="color:var(--muted)">${p.rating} · ${p.reviewsCount || reviews.length} reviews</span></div>
          <div class="price-row" style="margin:12px 0">
            <span class="price" style="font-size:26px">${money(p.price)}</span>
            ${p.compareAtPrice > p.price ? `<span class="strike">${money(p.compareAtPrice)}</span>` : ""}
          </div>
          <p style="color:var(--muted);font-size:14px">${esc(p.description)}</p>
          <p style="margin:14px 0;font-size:13px">${p.stock > 0 ? `<span class="pill paid">In stock — ${p.stock} left</span>` : '<span class="pill cancelled">Sold out</span>'}</p>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" data-add="${p._id}" ${p.stock <= 0 ? "disabled" : ""}>Add to bag</button>
            <button class="btn btn-ghost" data-wish="${p._id}">${WISH.includes(p._id) ? "♥ Saved" : "♡ Wishlist"}</button>
          </div>
          <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:14px">
            <b style="font-size:14px">Reviews</b>
            ${reviews.length ? reviews.map((r) => `<div style="margin-top:10px"><span class="stars">${stars(r.rating)}</span> <b style="font-size:13px">${esc(r.name || r.email || "Buyer")}</b><p style="color:var(--muted);font-size:13px">${esc(r.comment)}</p></div>`).join("") : '<p style="color:var(--muted);font-size:13px;margin-top:8px">No reviews yet.</p>'}
          </div>
        </div>
      </div>`;
    wireCards($("#prodBody"));
    $$("#prodBody [data-close]").forEach((b) => (b.onclick = closeAll));
  } catch (e) { $("#prodBody").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* --------------------------- cart + wishlist --------------------------- */
function findP(id) { return PRODUCTS.find((p) => p._id === id); }
function addToCart(id, qty = 1) {
  const line = CART.find((c) => c.productId === id);
  const p = findP(id);
  if (line) line.qty += qty;
  else CART.push({ productId: id, qty, title: p?.title, price: p?.price, image: p?.image });
  persistCart(); toast("Added to your bag"); openCart("cart");
}
function persistCart() { store.set("cart", CART); renderCart(); }
function toggleWish(id) {
  WISH = WISH.includes(id) ? WISH.filter((x) => x !== id) : [...WISH, id];
  store.set("wish", WISH); renderWish(); renderGrid(); renderDeals();
  toast(WISH.includes(id) ? "Saved to wishlist" : "Removed from wishlist");
}
function renderWish() {
  const c = $("#wishCount"); c.textContent = WISH.length; c.classList.toggle("hide", !WISH.length);
}
const cartTotals = () => {
  const subtotal = CART.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const discount = COUPON ? COUPON.discount : 0;
  const shipping = subtotal - discount >= 999 || subtotal === 0 ? 0 : 49;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
};
function renderCart() {
  const c = $("#cartCount");
  const n = CART.reduce((s, i) => s + i.qty, 0);
  c.textContent = n; c.classList.toggle("hide", !n);
  if (!$("#cartDrawer").classList.contains("open")) return;
  drawCart($("#drawerTitle").textContent === "Wishlist" ? "wish" : "cart");
}
function openCart(mode) {
  $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("open");
  drawCart(mode);
}
function drawCart(mode) {
  $("#drawerTitle").textContent = mode === "wish" ? "Wishlist" : "Your bag";
  const body = $("#cartBody"), foot = $("#cartFoot");
  if (mode === "wish") {
    const items = PRODUCTS.filter((p) => WISH.includes(p._id));
    body.innerHTML = items.length ? items.map((p) => `<div class="cart-item">
      <img src="${esc(p.image)}" alt=""><div><b style="font-size:14px">${esc(p.title)}</b><div style="color:var(--muted);font-size:13px">${money(p.price)}</div>
      <div class="qty"><button class="btn btn-sm btn-primary" data-add="${p._id}">Add to bag</button></div></div>
      <button class="icon-btn" data-wish="${p._id}">✕</button></div>`).join("") : '<div class="empty">Your wishlist is empty.</div>';
    foot.innerHTML = '<button class="btn btn-ghost btn-block" data-close>Continue shopping</button>';
    wireCards(body);
  } else {
    body.innerHTML = CART.length ? CART.map((i) => `<div class="cart-item">
      <img src="${esc(i.image)}" alt=""><div><b style="font-size:14px">${esc(i.title)}</b>
      <div style="color:var(--muted);font-size:13px">${money(i.price)}</div>
      <div class="qty"><button data-dec="${i.productId}">−</button><span>${i.qty}</span><button data-inc="${i.productId}">+</button></div></div>
      <div style="text-align:right"><b>${money(i.price * i.qty)}</b><br><button class="btn btn-sm btn-ghost" style="margin-top:6px" data-rm="${i.productId}">Remove</button></div></div>`).join("")
      : '<div class="empty">Your bag is empty.<br><br><button class="btn btn-ghost btn-sm" data-close>Browse products</button></div>';
    const t = cartTotals();
    foot.innerHTML = CART.length ? `
      <div style="display:flex;gap:8px;margin-bottom:12px"><input class="input" id="couponIn" placeholder="Coupon code" value="${COUPON ? esc(COUPON.code) : ""}"><button class="btn btn-ghost" id="applyCoupon">Apply</button></div>
      <div class="sumline"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      ${t.discount ? `<div class="sumline"><span>Discount</span><span style="color:var(--brand)">−${money(t.discount)}</span></div>` : ""}
      <div class="sumline"><span>Shipping</span><span>${t.shipping ? money(t.shipping) : "Free"}</span></div>
      <div class="sumline total"><span>Total</span><span>${money(t.total)}</span></div>
      <button class="btn btn-primary btn-block" id="checkoutBtn">Checkout</button>` : "";
  }
  $$("[data-close]", $("#cartDrawer")).forEach((b) => (b.onclick = closeAll));
  $$("[data-inc]", body).forEach((b) => (b.onclick = () => { CART.find((c) => c.productId === b.dataset.inc).qty++; persistCart(); }));
  $$("[data-dec]", body).forEach((b) => (b.onclick = () => {
    const l = CART.find((c) => c.productId === b.dataset.dec);
    l.qty--; if (l.qty <= 0) CART = CART.filter((c) => c !== l); persistCart();
  }));
  $$("[data-rm]", body).forEach((b) => (b.onclick = () => { CART = CART.filter((c) => c.productId !== b.dataset.rm); persistCart(); }));
  const ap = $("#applyCoupon");
  if (ap) ap.onclick = async () => {
    const code = $("#couponIn").value.trim();
    if (!code) { COUPON = null; return drawCart("cart"); }
    try { COUPON = await api("/coupons/validate", { method: "POST", body: { code, subtotal: cartTotals().subtotal } }); toast("Coupon applied 🎉"); }
    catch (e) { COUPON = null; toast(e.message, "err"); }
    drawCart("cart");
  };
  const cb = $("#checkoutBtn");
  if (cb) cb.onclick = () => (auth.token() ? openCheckout() : openAuth("login", true));
}

/* --------------------------- auth --------------------------- */
let AFTER_AUTH_CHECKOUT = false;
function openAuth(tab = "login", forCheckout = false) {
  AFTER_AUTH_CHECKOUT = forCheckout;
  open$("#authModal");
  $$("#authModal .tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#nameField").style.display = tab === "signup" ? "block" : "none";
  $("#authTitle").textContent = tab === "signup" ? "Create your account" : forCheckout ? "Login to place your order" : "Welcome back";
  $("#authSub").textContent = forCheckout ? "We only ask for an account when you buy." : "Login with your email, or sign up in seconds.";
  $("#authSubmit").textContent = tab === "signup" ? "Create account" : "Login";
  $("#authForm").dataset.tab = tab;
}
async function submitAuth(e) {
  e.preventDefault();
  const tab = e.target.dataset.tab || "login";
  const f = new FormData(e.target);
  const btn = $("#authSubmit"); btn.disabled = true; btn.textContent = "Please wait…";
  try {
    const body = { email: f.get("email").trim(), password: f.get("password") };
    if (tab === "signup") body.name = f.get("name");
    const data = await api("/auth/" + tab, { method: "POST", body });
    auth.save(data.token, data.user);
    toast(`Welcome${data.user.name ? ", " + data.user.name.split(" ")[0] : ""}!`);
    e.target.reset(); closeAll();
    if (data.user.role === "admin") { location.href = "/admin.html"; return; }
    if (AFTER_AUTH_CHECKOUT) openCheckout();
  } catch (err) { toast(err.message, "err"); }
  finally { btn.disabled = false; btn.textContent = tab === "signup" ? "Create account" : "Login"; }
}

/* --------------------------- account --------------------------- */
async function openAccount() {
  open$("#accountModal");
  const u = auth.user() || {};
  $("#accountBody").innerHTML = '<div class="empty">Loading your orders…</div>';
  let orders = [];
  try { orders = await api("/orders/mine"); } catch { }
  $("#accountBody").innerHTML = `
    <div class="modal-head"><div><h3>Hi${u.name ? ", " + esc(u.name.split(" ")[0]) : ""} 👋</h3><p>${esc(u.email)}</p></div>
      <button class="icon-btn" data-close>✕</button></div>
    <div class="stats" style="margin-bottom:18px">
      <div class="stat"><span>Orders</span><b>${orders.length}</b></div>
      <div class="stat"><span>Spent</span><b>${money(orders.reduce((s, o) => s + o.total, 0))}</b></div>
      <div class="stat"><span>Wishlist</span><b>${WISH.length}</b></div>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${orders.length ? orders.map((o) => `<tr>
      <td class="mono">${esc(o.orderNo)}</td><td>${dt(o.createdAt)}</td><td>${o.items.length}</td><td>${money(o.total)}</td>
      <td><span class="pill ${o.status}">${o.status}</span></td>
      <td>${["pending", "paid", "processing"].includes(o.status) ? `<button class="btn btn-sm btn-danger" data-cancel="${o._id}">Cancel</button>` : ""}</td></tr>`).join("")
      : '<tr><td colspan="6" class="empty">No orders yet.</td></tr>'}</tbody></table></div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-ghost" id="logoutBtn">Log out</button>
      ${u.role === "admin" ? '<a class="btn btn-primary" href="/admin.html">Open admin panel</a>' : ""}
    </div>`;
  $("#logoutBtn").onclick = () => { auth.clear(); closeAll(); toast("Logged out"); };
  $$("#accountBody [data-close]").forEach((b) => (b.onclick = closeAll));
  $$("#accountBody [data-cancel]").forEach((b) => (b.onclick = async () => {
    try { await api(`/orders/${b.dataset.cancel}/cancel`, { method: "POST" }); toast("Order cancelled"); openAccount(); }
    catch (e) { toast(e.message, "err"); }
  }));
}

/* --------------------------- checkout --------------------------- */
async function openCheckout() {
  if (!CART.length) return toast("Your bag is empty", "err");
  closeAll(); open$("#checkoutModal");
  const t = cartTotals();
  const body = $("#checkoutBody");
  body.innerHTML = `<div class="empty">Creating your order...</div>`;
  $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = closeAll));
  try {
    const order = await api("/orders", { method: "POST", body: { items: CART.map((c) => ({ productId: c.productId, qty: c.qty })), coupon: COUPON?.code || "" } });
    const upiId = await api("/settings/upi");
    if (!upiId) throw new Error("UPI payment is not configured by the store owner.");
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=${upiId}&pn=NOVA%20Store&am=${order.total}&tn=Order%20${order.orderNo}`;
    body.innerHTML = `
      <div class="modal-head"><div><h3>Complete your payment</h3><p>Order ${esc(order.orderNo)} · ${money(order.total)}</p></div><button class="icon-btn" data-close>✕</button></div>
      <div style="text-align:center">
        <p style="font-size:14px;color:var(--muted);margin-bottom:12px">Scan the QR code with any UPI app.</p>
        <img src="${qrUrl}" alt="UPI QR Code" style="border-radius:8px; background:white; padding:10px;" />
        <p style="font-size:13px;color:var(--muted);margin-top:8px">or pay to <b class="mono">${esc(upiId)}</b></p>
      </div>
      <form id="ssForm" style="margin-top:18px;border-top:1px solid var(--line);padding-top:18px">
        <p style="font-size:14px;margin-bottom:12px">After paying, upload the confirmation screenshot to complete your order.</p>
        <label class="field"><span>Payment screenshot *</span><input class="input" name="screenshot" type="file" accept="image/*" required /></label>
        <button class="btn btn-primary btn-block">Confirm payment</button>
      </form>`;
    $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = closeAll));
    $("#ssForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (!f.get("screenshot").size) return toast("Please upload a screenshot", "err");
      const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Uploading...";
      try {
        await api(`/orders/${order._id}/screenshot`, { method: "POST", body: f });
        CART = []; COUPON = null; persistCart();
        body.innerHTML = `<div class="empty"><div style="font-size:44px">✅</div><h3>Order placed!</h3>
          <p style="margin:8px 0 4px">Order <b class="mono">${esc(order.orderNo)}</b> · ${money(order.total)}</p>
          <p>We've received your payment proof and will verify it shortly. You'll get an email once it's approved.</p>
          <button class="btn btn-primary" style="margin-top:16px" data-close>Done</button></div>`;
        $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = () => { closeAll(); loadProducts(); }));
      } catch (err) { toast(err.message, "err"); btn.disabled = false; btn.textContent = "Confirm payment"; }
    };
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}<br><br><button class="btn btn-ghost" data-close>Close</button></div>`;
    $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = closeAll));
  }
}

/* --------------------------- modal utils --------------------------- */
function open$(sel) { closeAll(); $(sel).classList.add("open"); }
function closeAll() {
  $$(".modal").forEach((m) => m.classList.remove("open"));
  $("#cartDrawer").classList.remove("open");
  $("#overlay").classList.remove("open");
}
