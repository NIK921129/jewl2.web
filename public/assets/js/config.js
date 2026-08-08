/* =========================================================
   NOVA STORE — runtime config
   Change API_BASE_URL to your Render backend url after deploy.
   Keep the trailing "/api".
   ========================================================= */
window.NOVA_CONFIG = {
  // e.g. "https://nova-store-api.onrender.com/api"
  API_BASE_URL: "https://your-service.onrender.com/api",
  CURRENCY: "\u20B9",
  STORE_NAME: "NOVA",
  // When the API is unreachable the site runs on built-in demo data
  ALLOW_DEMO_FALLBACK: true,
};
