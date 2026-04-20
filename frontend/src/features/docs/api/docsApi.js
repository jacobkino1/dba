import {
  DOCS_ARCHIVE_URL,
  DOCS_DELETE_URL,
  DOCS_LIST_URL,
  DOCS_REPLACE_URL,
  DOCS_RESTORE_URL,
  DOCS_UPLOAD_URL,
  buildJsonHeaders,
  buildAuthHeaders,
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

export async function listDocuments() {
  const response = await fetch(DOCS_LIST_URL, {
    headers: buildAuthHeaders(),
  });

  const data = await readJson(response, "Failed to load documents");
  return Array.isArray(data.documents) ? data.documents : [];
}

export async function archiveDocument(documentId) {
  const response = await fetch(DOCS_ARCHIVE_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({ documentId }),
  });

  const data = await readJson(response, "Archive failed");

  if (data.status !== "archived") {
    throw new Error(data.message || "Archive did not complete successfully");
  }

  return data;
}

export async function restoreDocument(documentId) {
  const response = await fetch(DOCS_RESTORE_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({ documentId }),
  });

  const data = await readJson(response, "Restore failed");

  if (data.status !== "restored") {
    throw new Error(data.message || "Restore did not complete successfully");
  }

  return data;
}

export async function deleteDocument(documentId) {
  const response = await fetch(DOCS_DELETE_URL, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({ documentId }),
  });

  const data = await readJson(response, "Delete failed");

  if (data.status !== "deleted") {
    throw new Error(data.message || "Delete did not complete successfully");
  }

  return data;
}

export async function uploadDocument(formData) {
  const response = await fetch(DOCS_UPLOAD_URL, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: formData,
  });

  return readJson(response, "Upload failed");
}

export async function replaceDocument(formData) {
  const response = await fetch(DOCS_REPLACE_URL, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: formData,
  });

  const data = await readJson(response, "Replace failed");

  if (data.status !== "replaced") {
    throw new Error(data.message || "Replace did not complete successfully");
  }

  return data;
}