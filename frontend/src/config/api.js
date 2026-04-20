import { API_BASE_URL } from "./appConfig";

export const DOCS_UPLOAD_URL = `${API_BASE_URL}/docs/upload`;
export const DOCS_REPLACE_URL = `${API_BASE_URL}/docs/replace`;
export const DOCS_ARCHIVE_URL = `${API_BASE_URL}/docs/archive`;
export const DOCS_RESTORE_URL = `${API_BASE_URL}/docs/restore`;
export const DOCS_DELETE_URL = `${API_BASE_URL}/docs/delete`;
export const DOCS_LIST_URL = `${API_BASE_URL}/docs/list`;
export const DOCS_AUDIT_LIST_URL = `${API_BASE_URL}/docs/audit/list`;
export const CLINICS_LIST_URL = `${API_BASE_URL}/clinics/list`;

export const USERS_ME_URL = `${API_BASE_URL}/users/me`;
export const USERS_LIST_URL = `${API_BASE_URL}/users/list`;
export const USERS_CREATE_URL = `${API_BASE_URL}/users/create`;
export const USERS_UPDATE_ACCESS_URL = `${API_BASE_URL}/users/update-access`;
export const USERS_UPDATE_STATUS_URL = `${API_BASE_URL}/users/update-status`;
export const USERS_DELETE_URL = `${API_BASE_URL}/users/delete`;

export const AUTH_LOGIN_URL = `${API_BASE_URL}/auth/login`;
export const ASK_URL = `${API_BASE_URL}/ask`;

export const NETWORK_SETTINGS_URL = `${API_BASE_URL}/network/settings`;

export function downloadDocumentUrl(documentId) {
  return `${API_BASE_URL}/docs/download/${documentId}`;
}

function getAccessToken() {
  return localStorage.getItem("dbaAccessToken") || "";
}

function getSelectedClinicId() {
  return localStorage.getItem("dbaSelectedClinicId") || "";
}

export function buildAuthHeaders(extraHeaders = {}) {
  const token = getAccessToken();

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "X-Selected-Clinic-Id": getSelectedClinicId(),
    ...extraHeaders,
  };
}

export function buildJsonHeaders(extraHeaders = {}) {
  return buildAuthHeaders({
    "Content-Type": "application/json",
    ...extraHeaders,
  });
}