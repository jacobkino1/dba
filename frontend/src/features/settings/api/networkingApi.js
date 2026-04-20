import {
  NETWORK_SETTINGS_URL,
  buildAuthHeaders,
  buildJsonHeaders,
} from "../../../config/api";

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

export async function getNetworkSettings() {
  const response = await fetch(NETWORK_SETTINGS_URL, {
    headers: buildAuthHeaders(),
  });

  return readJson(response, "Failed to load network settings");
}

export async function saveNetworkSettings(payload) {
  const response = await fetch(NETWORK_SETTINGS_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to save network settings");
}