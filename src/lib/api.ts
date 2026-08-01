// Basis-URL der Worker-API. Lokal: wrangler dev auf :8787; in Produktion via
// VITE_API_BASE (Build-Zeit) auf die deployte Worker-URL gesetzt.
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8787";
