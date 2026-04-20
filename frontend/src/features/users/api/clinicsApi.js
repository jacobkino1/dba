import { CLINICS_LIST_URL, buildAuthHeaders } from "../../../config/api";

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

export async function listClinics() {
  const response = await fetch(CLINICS_LIST_URL, {
    headers: buildAuthHeaders(),
  });

  const data = await readJson(response, "Failed to load clinics");
  return Array.isArray(data?.clinics) ? data.clinics : [];
}