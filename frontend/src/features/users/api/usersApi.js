import {
  USERS_CREATE_URL,
  USERS_LIST_URL,
  USERS_ME_URL,
  USERS_UPDATE_ACCESS_URL,
  USERS_UPDATE_STATUS_URL,
  USERS_DELETE_URL,
  buildJsonHeaders,
  buildAuthHeaders,
} from "../../../config/api";
import { API_BASE_URL } from "../../../config/appConfig";

const AUTH_RESET_PASSWORD_URL = `${API_BASE_URL}/auth/reset-password`;

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

export async function getCurrentUser() {
  const response = await fetch(USERS_ME_URL, {
    headers: buildAuthHeaders(),
  });

  return readJson(response, "Failed to load current user");
}

export async function listUsers() {
  const response = await fetch(USERS_LIST_URL, {
    headers: buildAuthHeaders(),
  });

  const data = await readJson(response, "Failed to load users");
  return Array.isArray(data) ? data : [];
}

export async function createUser(payload) {
  const response = await fetch(USERS_CREATE_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to create user");
}

export async function updateUserStatus(payload) {
  const response = await fetch(USERS_UPDATE_STATUS_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to update user status");
}

export async function updateUserAccess(payload) {
  const response = await fetch(USERS_UPDATE_ACCESS_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to update user access");
}

export async function resetUserPassword(payload) {
  const response = await fetch(AUTH_RESET_PASSWORD_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to reset password");
}

export async function deleteUser(payload) {
  const response = await fetch(USERS_DELETE_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to delete user");
}