const API_BASE =
  (typeof window !== "undefined" && window.EDGE_SECURITY_API_BASE) ||
  window.location.origin;

export default { API_BASE };