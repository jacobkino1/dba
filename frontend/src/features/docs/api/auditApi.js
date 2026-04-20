import { DOCS_AUDIT_LIST_URL, buildAuthHeaders } from "../../../config/api";

export async function listDocumentAuditLogs(limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  const response = await fetch(`${DOCS_AUDIT_LIST_URL}?${params.toString()}`, {
    headers: buildAuthHeaders(),
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Failed to load audit logs (${response.status})`);
  }

  return Array.isArray(data?.auditLogs) ? data.auditLogs : [];
}