import { buildAuthHeaders, buildJsonHeaders } from "../../../config/api";
import { API_BASE_URL } from "../../../config/appConfig";

const CHAT_CONVERSATIONS_URL = `${API_BASE_URL}/chat/conversations`;

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

export async function listConversations() {
  const response = await fetch(CHAT_CONVERSATIONS_URL, {
    headers: buildAuthHeaders(),
  });

  const data = await readJson(response, "Failed to load conversations");
  return Array.isArray(data) ? data : [];
}

export async function createConversation(payload = {}) {
  const response = await fetch(CHAT_CONVERSATIONS_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  return readJson(response, "Failed to create conversation");
}

export async function getConversationMessages(conversationId) {
  const response = await fetch(
    `${CHAT_CONVERSATIONS_URL}/${conversationId}/messages`,
    {
      headers: buildAuthHeaders(),
    }
  );

  return readJson(response, "Failed to load conversation messages");
}

export async function appendConversationMessage(conversationId, payload) {
  const response = await fetch(
    `${CHAT_CONVERSATIONS_URL}/${conversationId}/messages`,
    {
      method: "POST",
      headers: buildJsonHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return readJson(response, "Failed to save conversation message");
}