/* =========================================================
   NOVA STORE — runtime config
   Change API_BASE_URL to your Render backend url after deploy.
   Keep the trailing "/api".
   ========================================================= */
window.NOVA_CONFIG = {
  // Vercel proxies this path to the Render API, avoiding browser CORS restrictions.
  API_BASE_URL: "/api",
  // Optional: set this to the Render origin when live Socket.IO notifications are needed.
  SOCKET_URL: "",
  CURRENCY: "\u20B9",
  STORE_NAME: "NOVA",
  // When the API is unreachable the site runs on built-in demo data
  ALLOW_DEMO_FALLBACK: true,
};
