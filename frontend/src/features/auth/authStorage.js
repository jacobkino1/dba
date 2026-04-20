const ACCESS_TOKEN_KEY = "dbaAccessToken";
const SELECTED_CLINIC_KEY = "dbaSelectedClinicId";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function setAccessToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getSelectedClinicId() {
  return localStorage.getItem(SELECTED_CLINIC_KEY) || "";
}

export function setSelectedClinicId(clinicId) {
  if (!clinicId) {
    localStorage.removeItem(SELECTED_CLINIC_KEY);
    return;
  }

  localStorage.setItem(SELECTED_CLINIC_KEY, clinicId);
}

export function clearSelectedClinicId() {
  localStorage.removeItem(SELECTED_CLINIC_KEY);
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(SELECTED_CLINIC_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}