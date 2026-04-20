import { buildAuthHeaders } from "../../../config/api";
import { API_BASE_URL } from "../../../config/appConfig";

const CHAT_INSIGHTS_SUMMARY_URL = `${API_BASE_URL}/chat/insights/summary`;

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

export async function getChatInsightsSummary({ days = 30, limit = 5 } = {}) {
  const params = new URLSearchParams({
    days: String(days),
    limit: String(limit),
  });

  const response = await fetch(
    `${CHAT_INSIGHTS_SUMMARY_URL}?${params.toString()}`,
    {
      headers: buildAuthHeaders(),
    }
  );

  return readJson(response, "Failed to load chat insights");
}