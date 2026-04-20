import {
  buildAuthHeaders,
  buildJsonHeaders,
} from "../../../config/api";
import { API_BASE_URL } from "../../../config/appConfig";

const AUTH_LOGIN_URL = `${API_BASE_URL}/auth/login`;
const AUTH_LOGIN_WORKSTATION_URL = `${API_BASE_URL}/auth/login-workstation`;
const AUTH_SET_PASSWORD_URL = `${API_BASE_URL}/auth/set-password`;
const AUTH_CHANGE_PASSWORD_URL = `${API_BASE_URL}/auth/change-password`;

async function readJson(response, fallbackMessage) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || `${fallbackMessage} (${response.status})`
    );
  }

  return data;
}

export async function login(payload) {
  const response = await fetch(AUTH_LOGIN_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to sign in");
}

export async function loginWorkstation(payload) {
  const response = await fetch(AUTH_LOGIN_WORKSTATION_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to sign in to workstation");
}

export async function setPassword(payload) {
  const response = await fetch(AUTH_SET_PASSWORD_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to set password");
}

export async function changePassword(payload) {
  const response = await fetch(AUTH_CHANGE_PASSWORD_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to change password");
}