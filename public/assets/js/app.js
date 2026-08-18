/* =========================================================
   NOVA STORE — storefront logic
   ========================================================= */
let PRODUCTS = [], CATS = [], STATE = { cat: "all", q: "", sort: "new", price: "" };
let CART = store.get("cart", []), WISH = store.get("wish", []), COUPON = null;
STATE.page = 1;
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
  connectSocket();
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
  $("#search").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { STATE.q = e.target.value.trim(); STATE.page = 1; loadProducts(); }, 300); };
  $("#sort").onchange = (e) => { STATE.sort = e.target.value; STATE.page = 1; loadProducts(); };
  $("#priceRange").onchange = (e) => { STATE.price = e.target.value; STATE.page = 1; loadProducts(); };

  // auth modal tabs
  $$("#authModal .tabs button").forEach((b) => (b.onclick = () => openAuth(b.dataset.tab, AFTER_AUTH_CHECKOUT)));
  $("#authForm").onsubmit = submitAuth;
  $("#forgotPwLink").onclick = (e) => { e.preventDefault(); openForgotPw(); };
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

function connectSocket() {
  if (!auth.token()) return;
  const socket = io(API.replace("/api", ""), { auth: { token: auth.token() } });
  socket.on("connect", () => console.log("Live socket connected to store."));
  socket.on("order_update", (order) => {
    toast(`Order ${order.orderNo} status updated to: ${order.status}`);
    // If account modal is open, refresh it to show the new status
    if ($("#accountModal").classList.contains("open")) {
      // A small delay to ensure user sees the toast first
      setTimeout(openAccount, 1000);
    }
  });
}

/* --------------------------- catalogue --------------------------- */
async function loadProducts() {
  $("#grid").innerHTML = new Array(8).fill('<div class="skeleton"></div>').join("");
  $("#pagination").innerHTML = "";
  const p = new URLSearchParams({ q: STATE.q, category: STATE.cat, sort: STATE.sort, page: STATE.page });
  if (STATE.price) { const [a, b] = STATE.price.split("-"); p.set("min", a); p.set("max", b); }
  try {
    const data = await api("/products?" + p);
    PRODUCTS = data.items; CATS = data.categories || [];
    $("#statProducts").textContent = data.total + "+";
    $("#resultCount").textContent = `Showing ${PRODUCTS.length} of ${data.total} products`;
    $("#apiState").textContent = isDemo() ? "Demo mode — connect your API in assets/js/config.js" : "Live API connected";
    renderCats(); renderGrid(); renderDeals(); renderPagination(data);
  } catch (e) {
    $("#grid").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function renderCats() {
  $("#cats").innerHTML = ["all", ...CATS].map((c) =>
    `<button class="chip ${STATE.cat === c ? "active" : ""}" data-cat="${esc(c)}">${c === "all" ? "All" : esc(c)}</button>`).join("");
  $$("#cats .chip").forEach((b) => (b.onclick = () => { STATE.cat = b.dataset.cat; STATE.page = 1; loadProducts(); }));
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
      <button class="btn btn-sm quick-view" data-view="${p._id}">Quick view</button>
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

function renderPagination({ page, totalPages }) {
  if (totalPages <= 1) return;
  let html = `<button data-p="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹ Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === page) html += `<button class="active" data-p="${i}">${i}</button>`;
    else if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      html += `<button data-p="${i}">${i}</button>`;
    } else if (i === page - 2 || i === page + 2) {
      html += `<span>...</span>`;
    }
  }
  html += `<button data-p="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Next ›</button>`;
  $("#pagination").innerHTML = html;
  $$("#pagination button[data-p]").forEach(b => b.onclick = () => { STATE.page = +b.dataset.p; loadProducts(); scrollTo({ top: $("#shop").offsetTop - 80, behavior: "smooth" }); });
}
function wireCards(root) {
  $$("[data-add]", root).forEach((b) => (b.onclick = () => addToCart(b.dataset.add)));
  $$("[data-view]", root).forEach((b) => (b.onclick = () => openProduct(b.dataset.view)));
  $$("[data-wish]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleWish(b.dataset.wish); }));
}

function wireImageZoom(gallery) {
  const mainImg = gallery.querySelector('#mainImg');
  if (!mainImg) return;
  gallery.onmousemove = (e) => {
    const rect = mainImg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    mainImg.style.transformOrigin = `${xPercent}% ${yPercent}%`;
  };
  gallery.onmouseenter = () => mainImg.style.transform = 'scale(2)';
  gallery.onmouseleave = () => mainImg.style.transform = 'scale(1)';
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
    const { product: p, reviews } = await api(`/products/${id}`);
    $("#prodBody").innerHTML = `
      <div class="modal-head"><div><h3>${esc(p.title)}</h3><p>${esc(p.category)} · ${esc(p.brand || "NOVA")}</p></div>
        <button class="icon-btn" data-close>✕</button></div>
      <div class="detail"> 
        <div class="gallery zoom-gallery">
          <img id="mainImg" src="${esc(p.image)}" alt="${esc(p.title)}" />
          <div class="thumbs">
            ${[p.image, ...(p.gallery || [])].map(img => 
              `<img src="${esc(img)}" class="${img === p.image ? 'active' : ''}" />`
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
    // Wire up thumbnails safely
    $$("#prodBody .thumbs img").forEach(thumb => {
      thumb.onclick = () => {
        $("#mainImg").src = thumb.src;
        $$("#prodBody .thumbs img").forEach(i => i.classList.remove("active"));
        thumb.classList.add("active");
      };
    });
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
    connectSocket(); // Connect to socket after login
    e.target.reset(); closeAll();
    if (data.user.role === "admin") { location.href = "/admin.html"; return; }
    if (AFTER_AUTH_CHECKOUT) openCheckout();
  } catch (err) { toast(err.message, "err"); }
  finally { btn.disabled = false; btn.textContent = tab === "signup" ? "Create account" : "Login"; }
}

async function submitProfile(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  btn.disabled = true; btn.textContent = "Saving...";
  const f = new FormData(e.target);
  const body = { name: f.get("name"), phone: f.get("phone"), address: f.get("address") };
  try {
    const { user } = await api("/auth/me", { method: "PUT", body });
    auth.save(auth.token(), user); // Update stored user
    toast("Profile updated!");
  } catch (err) { toast(err.message, "err"); }
  finally { btn.disabled = false; btn.textContent = "Save changes"; }
}

function openForgotPw() {
  openModal(`
    <div class="modal-head"><h3>Reset password</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <p style="font-size:14px;color:var(--muted);margin-bottom:14px">Enter your email and we'll send you a link to reset your password.</p>
    <form id="forgotPwForm">
      <label class="field"><span>Email</span><input class="input" name="email" type="email" required /></label>
      <button class="btn btn-primary btn-block">Send reset link</button>
    </form>`);
  $("#forgotPwForm").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); try { await api("/auth/forgot-password", { method: "POST", body: { email: f.get("email") } }); toast("Password reset link sent! Check your console."); closeModal(); } catch (err) { toast(err.message, "err"); } };
}

function openResetPw(token) {
  openModal(`
    <div class="modal-head"><h3>Choose a new password</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <form id="resetPwForm">
      <label class="field"><span>New Password</span><input class="input" name="password" type="password" required minlength="6" /></label>
      <button class="btn btn-primary btn-block">Set new password</button>
    </form>`);
  $("#resetPwForm").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); try { await api("/auth/reset-password", { method: "POST", body: { token, password: f.get("password") } }); toast("Password updated! You can now login."); closeModal(); openAuth("login"); } catch (err) { toast(err.message, "err"); } };
}

/* --------------------------- account --------------------------- */
async function openAccount() {
  open$("#accountModal");
  const u = auth.user() || {};
  $("#accountBody").innerHTML = '<div class="empty">Loading your orders…</div>';
  let orders = [];
  try { orders = await api("/orders/mine"); } catch { }
  $("#accountBody").innerHTML = `
    <div class="modal-head"><div><h3>My Account</h3><p>Hi${u.name ? ", " + esc(u.name.split(" ")[0]) : ""} 👋 · ${esc(u.email)}</p></div>
      <button class="icon-btn" data-close>✕</button></div>
    <div class="grid2" style="align-items:flex-start">
      <div class="panel" style="margin:0">
        <h4>My Orders</h4>
        <div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>${orders.length ? orders.map((o) => `<tr>
          <td class="mono">${esc(o.orderNo)}</td><td>${dt(o.createdAt)}</td><td>${money(o.total)}</td>
          <td><span class="pill ${o.status}">${o.status}</span></td>
          <td><button class="btn btn-sm btn-ghost" data-view-order="${o._id}">Details</button></td></tr>`).join("")
          : '<tr><td colspan="5" class="empty">No orders yet.</td></tr>'}</tbody></table></div>
      </div>
      <div class="panel" style="margin:0">
        <h4>My Profile</h4>
        <form id="profileForm">
          <label class="field"><span>Full Name</span><input class="input" name="name" value="${esc(u.name || "")}"></label>
          <label class="field"><span>Phone</span><input class="input" name="phone" value="${esc(u.phone || "")}"></label>
          <label class="field"><span>Saved Address</span><textarea class="input" name="address" rows="3">${esc(u.address || "")}</textarea></label>
          <button class="btn btn-primary btn-sm">Save changes</button>
        </form>
        <div style="display:flex;gap:10px;margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
          <button class="btn btn-ghost btn-sm" id="logoutBtn">Log out</button>
          ${u.role === "admin" ? '<a class="btn btn-primary btn-sm" href="/admin.html">Admin Panel</a>' : ""}
        </div>
      </div>
    </div>
    `;
  $("#logoutBtn").onclick = () => { auth.clear(); closeAll(); toast("Logged out"); location.reload(); };
  $("#profileForm").onsubmit = submitProfile;
  $$("#accountBody [data-close]").forEach((b) => (b.onclick = closeAll));
  $$("#accountBody [data-view-order]").forEach((b) => (b.onclick = () => {
    const order = orders.find(o => o._id === b.dataset.viewOrder);
    openOrderDetail(order);
  }));
}

function openOrderDetail(order) {
  open$("#accountModal");
  $("#accountBody").innerHTML = `
    <div class="modal-head"><div><h3>Order ${esc(order.orderNo)}</h3><p>${dt(order.createdAt)} · ${money(order.total)}</p></div>
      <button class="icon-btn" data-close>✕</button></div>
    <button class="btn btn-sm btn-ghost" id="backToAccount" style="margin-bottom:18px">← Back to My Account</button>
    <div class="grid2" style="align-items:flex-start">
      <div class="panel" style="margin:0"><h4>Items</h4>
        ${order.items.map(item => `<div class="cart-item">
          <img src="${esc(item.image)}" alt="">
          <div><b style="font-size:14px">${esc(item.title)}</b><div style="color:var(--muted);font-size:13px">${money(item.price)} × ${item.qty}</div></div>
          ${order.status === 'delivered' ? `<button class="btn btn-sm btn-primary" data-review="${item.productId}">Write review</button>` : ''}
        </div>`).join("")}
      </div>
      <div class="panel" style="margin:0">
        <h4>Shipping & Tracking</h4>
        <p style="font-size:13px; color:var(--muted); line-height:1.6;">${Object.entries(order.shippingAddress || {}).map(([k, v]) => `<b>${k}:</b> ${esc(v)}`).join("<br>") || "Address not provided."}</p>
        ${order.tracking ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)"><b>Tracking:</b> <span class="mono">${esc(order.tracking)}</span></div>` : ''}
        ${["pending", "paid", "processing"].includes(order.status) ? `<button class="btn btn-sm btn-danger" style="margin-top:14px" data-cancel="${order._id}">Cancel Order</button>` : ""}
      </div>
    </div>`;
  $("#backToAccount").onclick = openAccount;
  $$("#accountBody [data-close]").forEach((b) => (b.onclick = closeAll));
  $$("#accountBody [data-review]").forEach(b => b.onclick = () => openReviewForm(b.dataset.review));
  $$("#accountBody [data-cancel]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try { await api(`/orders/${b.dataset.cancel}/cancel`, { method: "POST" }); toast("Order cancelled"); openAccount(); }
    catch (e) { toast(e.message, "err"); }
  }));
}

/* --------------------------- checkout --------------------------- */
async function openCheckout() {
  if (!CART.length) return toast("Your bag is empty", "err");
  const u = auth.user();
  closeAll(); open$("#checkoutModal");
  const t = cartTotals();
  const body = $("#checkoutBody");
  body.innerHTML = `<div class="empty">Creating your order...</div>`;
  $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = closeAll));
  try {
    const order = await api("/orders", { method: "POST", body: { items: CART.map((c) => ({ productId: c.productId, qty: c.qty })), coupon: COUPON?.code || "" } });
    const checkoutStep = (step) => {
      if (step === 1) { // Address
        body.innerHTML = `<div class="modal-head"><div><h3>Step 1: Shipping Address</h3><p>Order ${esc(order.orderNo)}</p></div><button class="icon-btn" data-close>✕</button></div>
          <form id="addrForm">
            <label class="field"><span>Full Name</span><input class="input" name="name" required value="${esc(u.name || "")}"></label>
            <label class="field"><span>Phone</span><input class="input" name="phone" required value="${esc(u.phone || "")}"></label>
            <label class="field"><span>Full Address</span><textarea class="input" name="address" rows="3" required>${esc(u.address || "")}</textarea></label>
            <button class="btn btn-primary btn-block">Continue to Payment</button>
          </form>`;
        $("#addrForm").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); const shippingAddress = { name: f.get("name"), phone: f.get("phone"), address: f.get("address") }; await api(`/orders/${order._id}`, { method: "PUT", body: { shippingAddress } }); checkoutStep(2); };
      } else if (step === 2) { // Payment
        const upiId = CFG.UPI_ID || (await api("/settings/upi"));
        if (!upiId) throw new Error("UPI payment is not configured by the store owner.");
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=${upiId}&pn=NOVA%20Store&am=${order.total}&tn=Order%20${order.orderNo}`;
        body.innerHTML = `<div class="modal-head"><div><h3>Step 2: Complete Payment</h3><p>Order ${esc(order.orderNo)} · ${money(order.total)}</p></div><button class="icon-btn" data-close>✕</button></div>
          <div style="text-align:center">
            <p style="font-size:14px;color:var(--muted);margin-bottom:12px">Scan the QR code with any UPI app.</p>
            <img src="${qrUrl}" alt="UPI QR Code" style="border-radius:8px; background:white; padding:10px;" />
            <p style="font-size:13px;color:var(--muted);margin-top:8px">or pay to <b class="mono">${esc(upiId)}</b></p>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:18px" onclick="checkoutStep(3)">I have paid, next</button>`;
      } else if (step === 3) { // Screenshot
        body.innerHTML = `<div class="modal-head"><div><h3>Step 3: Confirm Order</h3><p>Upload payment proof</p></div><button class="icon-btn" data-close>✕</button></div>
          <form id="ssForm"><p style="font-size:14px;margin-bottom:12px">After paying, upload the confirmation screenshot to complete your order.</p>
            <label class="field"><span>Payment screenshot *</span><input class="input" name="screenshot" type="file" accept="image/*" required /></label>
            <button class="btn btn-primary btn-block">Confirm and Place Order</button></form>`;
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
      }
      $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = closeAll));
    };
    checkoutStep(1);
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}<br><br><button class="btn btn-ghost" data-close>Close</button></div>`;
    $$("#checkoutBody [data-close]").forEach((b) => (b.onclick = closeAll));
  }
}

/* --------------------------- modal utils --------------------------- */
function open$(sel) { closeAll(); $(sel).classList.add("open"); }
function openModal(html) { $("#genericModalBody").innerHTML = html; open$("#genericModal"); }
function closeModal() { $("#genericModal").classList.remove("open"); }
function closeAll() {
  closeModal();
  $$(".modal").forEach((m) => m.classList.remove("open"));
  $("#cartDrawer").classList.remove("open");
  $("#overlay").classList.remove("open");
}
