import { useEffect, useMemo, useState } from "react";
import {
  formatPermissionLabel,
  normalizePermissionLevel,
} from "../../config/permissions";
import { replaceDocument, uploadDocument } from "./api/docsApi";

export default function UploadDocumentsModal({
  isOpen,
  onClose,
  onUploadComplete,
  existingDocuments = [],
  replaceTargetDoc = null,
  currentUser = null,
}) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [documentType, setDocumentType] = useState("SOP");
  const [scope, setScope] = useState("Clinic");
  const [access, setAccess] = useState("Read");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [failedItems, setFailedItems] = useState([]);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);
  const [successState, setSuccessState] = useState(null);

  const isReplaceMode = !!replaceTargetDoc;
  const hasRetryFiles = failedItems.length > 0 && files.length > 0;

  const selectedClinicId = currentUser?.selectedClinicId || "";
  const actorOrgPermission = String(
    currentUser?.organisationPermissionLevel || ""
  ).toLowerCase();
  const actorEffectivePermission = String(
    currentUser?.effectivePermissionLevel || ""
  ).toLowerCase();

  const assignablePermissionLevels = useMemo(() => {
    if (actorOrgPermission === "admin") {
      return ["admin", "manage", "write", "read"];
    }

    if (actorEffectivePermission === "manage") {
      return ["manage", "write", "read"];
    }

    if (actorEffectivePermission === "write") {
      return ["write", "read"];
    }

    return [];
  }, [actorEffectivePermission, actorOrgPermission]);

  const canUseSharedScope = actorOrgPermission === "admin";

  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setUploadError("");
      setFailedItems([]);
      setDuplicatePrompt(null);
      setIsDragging(false);
      setIsUploading(false);
      setSuccessState(null);
      setDocumentType("SOP");
      setScope("Clinic");
      setAccess(
        formatPermissionLabel(
          assignablePermissionLevels[assignablePermissionLevels.length - 1] ||
            "read"
        )
      );
    }
  }, [isOpen, assignablePermissionLevels]);

  useEffect(() => {
    if (replaceTargetDoc) {
      setDocumentType(normalizeDocumentType(replaceTargetDoc.type));
      setScope(normalizeScope(replaceTargetDoc.scope));
      setAccess(normalizeAccess(replaceTargetDoc.access));
    }
  }, [replaceTargetDoc]);

  useEffect(() => {
    if (isReplaceMode) return;

    const normalizedCurrentAccess = normalizePermissionLevel(access);
    const hasAccessOption =
      assignablePermissionLevels.includes(normalizedCurrentAccess);

    if (!hasAccessOption) {
      const fallbackLevel =
        assignablePermissionLevels[assignablePermissionLevels.length - 1] ||
        "read";
      setAccess(formatPermissionLabel(fallbackLevel));
    }

    if (scope === "Shared" && !canUseSharedScope) {
      setScope("Clinic");
    }
  }, [
    access,
    assignablePermissionLevels,
    canUseSharedScope,
    isReplaceMode,
    scope,
  ]);

  function addFiles(fileList) {
    const incomingFiles = Array.from(fileList || []);
    if (incomingFiles.length === 0) return;

    setFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );

      const uniqueIncoming = incomingFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });

      const merged = [...prev, ...uniqueIncoming];

      if (isReplaceMode) {
        return merged.slice(0, 1);
      }

      return merged;
    });
  }

  function handleFileChange(event) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeFile(indexToRemove) {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  function clearFiles() {
    setFiles([]);
    setUploadError("");
    setFailedItems([]);
  }

  function showSuccessAndClose(message) {
    setSuccessState(message);

    setTimeout(() => {
      onClose();
    }, 700);
  }

  const duplicateMatches = useMemo(() => {
    if (isReplaceMode) return [];

    const normalizedNames = new Set(files.map((f) => f.name.toLowerCase()));

    return existingDocuments.filter((doc) => {
      const sameScope = doc.scope === scope;
      const sameName = normalizedNames.has(doc.name.toLowerCase());
      const activeLike = doc.status !== "Archived";
      return sameScope && sameName && activeLike;
    });
  }, [files, existingDocuments, scope, isReplaceMode]);

  if (!isOpen) return null;

  async function uploadSingleFile(file) {
    const roleAccess = normalizePermissionLevel(access) || "read";
    const documentTypeValue = documentType.toLowerCase();
    const isShared = scope === "Shared";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clinicId", selectedClinicId);
    formData.append("documentType", documentTypeValue);
    formData.append("roleAccess", roleAccess);
    formData.append("sourceType", "internal");
    formData.append("sourceUrl", "");
    formData.append("isShared", String(isShared));

    return uploadDocument(formData);
  }

  async function replaceSingleFile(file, existingDoc) {
    const formData = new FormData();
    formData.append("oldDocumentId", existingDoc.id);
    formData.append("file", file);

    return replaceDocument(formData);
  }

  async function uploadFilesNormally() {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    setUploadError("");
    setFailedItems([]);

    let uploadedCount = 0;
    const nextFailedItems = [];
    const successfulKeys = new Set();

    try {
      for (const file of files) {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;

        try {
          await uploadSingleFile(file);
          uploadedCount += 1;
          successfulKeys.add(fileKey);
        } catch (error) {
          nextFailedItems.push({
            name: file.name,
            key: fileKey,
            message: error.message || "Upload failed.",
          });
        }
      }

      if (nextFailedItems.length > 0) {
        setUploadError("Some files could not be processed.");
        setFailedItems(nextFailedItems);
        setFiles((prev) =>
          prev.filter((file) => {
            const key = `${file.name}-${file.size}-${file.lastModified}`;
            return !successfulKeys.has(key);
          })
        );
      } else {
        setUploadError("");
        setFailedItems([]);
      }

      if (uploadedCount > 0 && typeof onUploadComplete === "function") {
        await onUploadComplete();
      }

      if (uploadedCount > 0 && nextFailedItems.length === 0) {
        setFiles([]);
        showSuccessAndClose(
          uploadedCount === 1
            ? "Document uploaded and processing started."
            : "Documents uploaded and processing started."
        );
      }
    } catch (error) {
      setUploadError(error.message || "Something went wrong during upload.");
      setFailedItems([]);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleReplaceExisting() {
    if (!duplicatePrompt || isUploading) return;

    setIsUploading(true);
    setUploadError("");
    setFailedItems([]);

    let replacedCount = 0;
    const nextFailedItems = [];
    const successfulKeys = new Set();

    try {
      for (const file of files) {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;

        const existingDoc = existingDocuments.find(
          (doc) =>
            doc.name.toLowerCase() === file.name.toLowerCase() &&
            doc.scope === scope &&
            doc.status !== "Archived"
        );

        if (!existingDoc) {
          try {
            await uploadSingleFile(file);
            replacedCount += 1;
            successfulKeys.add(fileKey);
          } catch (error) {
            nextFailedItems.push({
              name: file.name,
              key: fileKey,
              message: error.message || "Upload failed.",
            });
          }
          continue;
        }

        try {
          await replaceSingleFile(file, existingDoc);
          replacedCount += 1;
          successfulKeys.add(fileKey);
        } catch (error) {
          nextFailedItems.push({
            name: file.name,
            key: fileKey,
            message: error.message || "Replace failed.",
          });
        }
      }

      setDuplicatePrompt(null);

      if (nextFailedItems.length > 0) {
        setUploadError("Some files could not be processed.");
        setFailedItems(nextFailedItems);
        setFiles((prev) =>
          prev.filter((file) => {
            const key = `${file.name}-${file.size}-${file.lastModified}`;
            return !successfulKeys.has(key);
          })
        );
      } else {
        setUploadError("");
        setFailedItems([]);
      }

      if (replacedCount > 0 && typeof onUploadComplete === "function") {
        await onUploadComplete();
      }

      if (replacedCount > 0 && nextFailedItems.length === 0) {
        setFiles([]);
        showSuccessAndClose(
          replacedCount === 1
            ? "Document replacement started successfully."
            : "Document replacements started successfully."
        );
      }
    } catch (error) {
      setUploadError(error.message || "Something went wrong during replace.");
      setFailedItems([]);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDirectReplace() {
    if (!replaceTargetDoc || files.length === 0 || isUploading) return;

    setIsUploading(true);
    setUploadError("");
    setFailedItems([]);

    const file = files[0];

    try {
      await replaceSingleFile(file, replaceTargetDoc);

      if (typeof onUploadComplete === "function") {
        await onUploadComplete();
      }

      setFiles([]);
      showSuccessAndClose("Document replacement started successfully.");
    } catch (error) {
      setUploadError(error.message || "Something went wrong during replace.");
      setFailedItems([
        {
          name: file.name,
          key: `${file.name}-${file.size}-${file.lastModified}`,
          message: error.message || "Replace failed.",
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUploadAndProcess() {
    if (files.length === 0 || isUploading) return;

    setUploadError("");

    if (isReplaceMode) {
      await handleDirectReplace();
      return;
    }

    if (duplicateMatches.length > 0) {
      setDuplicatePrompt({
        matches: duplicateMatches,
      });
      return;
    }

    await uploadFilesNormally();
  }

  return (
    <>
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.header}>
            <div>
              <h2 style={styles.title}>
                {isReplaceMode ? "Replace Document" : "Upload Documents"}
              </h2>
              <p style={styles.subtitle}>
                {isReplaceMode
                  ? "Choose a replacement file for the selected document."
                  : hasRetryFiles
                  ? "Some files failed earlier. Review them below and retry when ready."
                  : "Add one or more files and apply the same metadata to the batch."}
              </p>
            </div>

            <button type="button" style={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="dba-upload-modal-body" style={styles.body}>
            {isReplaceMode && (
              <div style={styles.replaceInfoCard}>
                <div style={styles.replaceInfoTitle}>Replacing</div>
                <div style={styles.replaceInfoName}>{replaceTargetDoc.name}</div>
                <div style={styles.replaceInfoMeta}>
                  Scope: {replaceTargetDoc.scope} • Access:{" "}
                  {replaceTargetDoc.access}
                </div>
              </div>
            )}

            <div
              style={{
                ...styles.dropZone,
                ...(isDragging ? styles.dropZoneActive : {}),
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div style={styles.dropZoneIcon}>🦷</div>
              <div style={styles.dropZoneTitle}>
                {isReplaceMode
                  ? "Drag and drop the replacement file here"
                  : "Drag and drop files here"}
              </div>
              <div style={styles.dropZoneSubtitle}>
                {isReplaceMode
                  ? "Drop one PDF, DOCX, or TXT file to replace the selected document."
                  : "Drop PDF, DOCX, or TXT files to add them to this upload batch."}
              </div>

              <label htmlFor="file-upload-dropzone" style={styles.dropZoneButton}>
                Browse files
              </label>

              <input
                id="file-upload-dropzone"
                type="file"
                multiple={!isReplaceMode}
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                style={styles.hiddenInput}
              />
            </div>

            {hasRetryFiles && (
              <div style={styles.retryInfoBox}>
                <div style={styles.retryInfoTitle}>Some files need attention</div>
                <div style={styles.retryInfoText}>
                  Only the files that failed are still listed below. You can
                  retry them now, remove them, or add new files.
                </div>
              </div>
            )}

            <div style={styles.selectedFilesCard}>
              <div style={styles.selectedFilesHeader}>
                <div>
                  <div style={styles.selectedFilesTitle}>Selected Files</div>
                  <div style={styles.selectedFilesSubtitle}>
                    {files.length === 0
                      ? "No files added yet"
                      : hasRetryFiles
                      ? `${files.length} failed file${
                          files.length > 1 ? "s" : ""
                        } ready to retry`
                      : `${files.length} file${
                          files.length > 1 ? "s" : ""
                        } ready for ${isReplaceMode ? "replace" : "upload"}`}
                  </div>
                </div>

                {files.length > 0 && (
                  <button
                    type="button"
                    style={styles.clearButton}
                    onClick={clearFiles}
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div style={styles.fileList}>
                {files.length === 0 ? (
                  <div style={styles.emptyFiles}>
                    Add files using the browse button above or drag and drop them
                    here.
                  </div>
                ) : (
                  files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      style={styles.fileItem}
                    >
                      <div style={styles.fileItemLeft}>
                        <div style={styles.fileBadge}>
                          {getFileExtension(file.name)}
                        </div>

                        <div style={styles.fileMeta}>
                          <div style={styles.fileName}>{file.name}</div>
                          <div style={styles.fileInfo}>
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        style={styles.removeFileButton}
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Document Type</label>
                <select
                  style={styles.select}
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  disabled={isUploading || isReplaceMode}
                >
                  <option value="SOP">SOP</option>
                  <option value="Policy">Policy</option>
                  <option value="Procedure">Procedure</option>
                  <option value="Guideline">Guideline</option>
                  <option value="Form">Form</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Scope</label>
                <select
                  style={styles.select}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  disabled={isUploading || isReplaceMode}
                >
                  <option value="Clinic">Clinic</option>
                  {canUseSharedScope && <option value="Shared">Shared</option>}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Access</label>
                <select
                  style={styles.select}
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  disabled={isUploading || isReplaceMode}
                >
                  {assignablePermissionLevels.map((level) => (
                    <option key={level} value={formatPermissionLabel(level)}>
                      {formatPermissionLabel(level)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {successState && (
              <div style={styles.successBox}>
                <div style={styles.successTitle}>Success</div>
                <div style={styles.successText}>{successState}</div>
              </div>
            )}

            {uploadError && (
              <div style={styles.errorBox}>
                <div style={styles.errorTitle}>{uploadError}</div>

                {failedItems.length > 0 && (
                  <div style={styles.errorList}>
                    {failedItems.map((item) => (
                      <div
                        key={`${item.name}-${item.key}`}
                        style={styles.errorListItem}
                      >
                        <strong>{item.name}</strong>: {item.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.footer}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={onClose}
              disabled={isUploading || !!successState}
            >
              Cancel
            </button>

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(files.length === 0 || isUploading || !!successState
                  ? styles.primaryButtonDisabled
                  : {}),
              }}
              disabled={files.length === 0 || isUploading || !!successState}
              onClick={handleUploadAndProcess}
            >
              {isUploading
                ? isReplaceMode
                  ? "Replacing..."
                  : "Uploading..."
                : hasRetryFiles
                ? isReplaceMode
                  ? "Retry replace and process"
                  : "Retry upload and process"
                : isReplaceMode
                ? "Replace and Process"
                : "Upload and Process"}
            </button>
          </div>
        </div>
      </div>

      {!isReplaceMode && (
        <DuplicatePromptModal
          duplicatePrompt={duplicatePrompt}
          scope={scope}
          onCancel={() => setDuplicatePrompt(null)}
          onKeepBoth={async () => {
            setDuplicatePrompt(null);
            await uploadFilesNormally();
          }}
          onReplace={handleReplaceExisting}
          isUploading={isUploading}
        />
      )}
    </>
  );
}

function DuplicatePromptModal({
  duplicatePrompt,
  scope,
  onCancel,
  onKeepBoth,
  onReplace,
  isUploading,
}) {
  if (!duplicatePrompt) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.duplicateModal}>
        <div style={styles.viewModalHeader}>
          <div>
            <h2 style={styles.viewModalTitle}>Document already exists</h2>
            <p style={styles.viewModalSubtitle}>
              A document with the same name already exists in the {scope} scope.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div style={styles.duplicateModalBody}>
          {duplicatePrompt.matches.map((doc) => (
            <div key={doc.id} style={styles.duplicateCard}>
              <div style={styles.duplicateName}>{doc.name}</div>
              <div style={styles.duplicateMeta}>
                Scope: {doc.scope} • Status: {doc.status}
              </div>
            </div>
          ))}

          <div style={styles.duplicateHelp}>
            Replacing will archive the existing active document and process the
            new file as the latest version.
          </div>
        </div>

        <div style={styles.viewModalFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </button>

          <button
            type="button"
            style={styles.actionButton}
            onClick={onKeepBoth}
            disabled={isUploading}
          >
            Keep both
          </button>

          <button
            type="button"
            style={{
              ...styles.primaryButton,
              ...(isUploading ? styles.primaryButtonDisabled : {}),
            }}
            onClick={onReplace}
            disabled={isUploading}
          >
            {isUploading ? "Replacing..." : "Replace existing"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeDocumentType(value) {
  if (!value) return "SOP";

  const normalized = String(value).trim().toLowerCase();

  if (normalized === "sop") return "SOP";
  if (normalized === "policy") return "Policy";
  if (normalized === "procedure") return "Procedure";
  if (normalized === "guideline") return "Guideline";
  if (normalized === "form") return "Form";
  return "Other";
}

function normalizeScope(value) {
  if (!value) return "Clinic";
  return String(value).trim().toLowerCase() === "shared"
    ? "Shared"
    : "Clinic";
}

function normalizeAccess(value) {
  const normalized = normalizePermissionLevel(value);

  switch (normalized) {
    case "admin":
      return "Admin";
    case "manage":
      return "Manage";
    case "write":
      return "Write";
    case "read":
      return "Read";
    default:
      return "Read";
  }
}

function getFileExtension(filename) {
  const parts = filename.split(".");
  if (parts.length < 2) return "FILE";
  return parts[parts.length - 1].toUpperCase();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "var(--modal-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1000,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  modal: {
    width: "100%",
    maxWidth: "860px",
    maxHeight: "calc(100vh - 48px)",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "26px 28px 20px 28px",
    borderBottom: "1px solid var(--divider)",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  subtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  body: {
    padding: "24px 28px 28px 28px",
    overflowY: "auto",
    minHeight: 0,
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(96,165,250,0.45) transparent",
  },
  hiddenInput: {
    display: "none",
  },
  replaceInfoCard: {
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(96,165,250,0.18)",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "18px",
  },
  replaceInfoTitle: {
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "8px",
  },
  replaceInfoName: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
  },
  replaceInfoMeta: {
    marginTop: "6px",
    color: "var(--text-secondary)",
    fontSize: "13px",
  },
  dropZone: {
    marginTop: "6px",
    marginBottom: "20px",
    border: "1px dashed rgba(96,165,250,0.28)",
    borderRadius: "20px",
    background:
      "radial-gradient(circle at top, rgba(37,99,235,0.10) 0%, var(--surface-1) 42%, var(--app-bg) 100%)",
    minHeight: "170px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "22px",
    boxSizing: "border-box",
    transition: "all 0.18s ease",
  },
  dropZoneActive: {
    border: "1px dashed var(--table-action-hover-border)",
    boxShadow: "0 0 28px rgba(37,99,235,0.18)",
    transform: "translateY(-1px)",
  },
  dropZoneIcon: {
    fontSize: "28px",
    marginBottom: "10px",
  },
  dropZoneTitle: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  dropZoneSubtitle: {
    color: "var(--text-muted)",
    fontSize: "13px",
    maxWidth: "460px",
    lineHeight: 1.45,
    marginBottom: "14px",
  },
  dropZoneButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "1px solid rgba(96,165,250,0.35)",
    borderRadius: "14px",
    padding: "10px 15px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  retryInfoBox: {
    background: "rgba(59, 130, 246, 0.08)",
    border: "1px solid rgba(96,165,250,0.18)",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "18px",
  },
  retryInfoTitle: {
    color: "var(--avatar-text)",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  retryInfoText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.55,
  },
  selectedFilesCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "22px",
  },
  selectedFilesHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    marginBottom: "14px",
  },
  selectedFilesTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  selectedFilesSubtitle: {
    marginTop: "4px",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  clearButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "220px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  emptyFiles: {
    color: "var(--text-muted)",
    fontSize: "14px",
    padding: "10px 0 4px 0",
  },
  fileItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
  },
  fileItemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  fileBadge: {
    minWidth: "52px",
    height: "36px",
    borderRadius: "10px",
    background: "var(--icon-bubble-bg)",
    color: "var(--avatar-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.04em",
    padding: "0 10px",
    boxSizing: "border-box",
  },
  fileMeta: {
    minWidth: 0,
  },
  fileName: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "420px",
  },
  fileInfo: {
    color: "var(--text-muted)",
    fontSize: "12px",
    marginTop: "4px",
  },
  removeFileButton: {
    background: "transparent",
    color: "var(--danger-text)",
    border: "1px solid rgba(244,63,94,0.25)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-secondary)",
  },
  select: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  errorBox: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "var(--danger-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    marginBottom: "16px",
    lineHeight: 1.5,
  },
  errorTitle: {
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "8px",
  },
  errorList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  errorListItem: {
    fontSize: "13px",
    lineHeight: 1.5,
  },
  successBox: {
    background: "rgba(6, 95, 70, 0.18)",
    border: "1px solid rgba(52, 211, 153, 0.24)",
    color: "#065f46",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  successTitle: {
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  successText: {
    fontSize: "13px",
    lineHeight: 1.5,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "18px 28px 26px 28px",
    borderTop: "1px solid var(--divider)",
  },
  secondaryButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  primaryButton: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  primaryButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "var(--modal-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1100,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  duplicateModal: {
    width: "100%",
    maxWidth: "620px",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  viewModalHeader: {
    padding: "24px 28px 18px 28px",
    borderBottom: "1px solid var(--divider)",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  viewModalTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  viewModalSubtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  duplicateModalBody: {
    padding: "22px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  duplicateCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "12px 14px",
  },
  duplicateName: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  duplicateMeta: {
    marginTop: "6px",
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  duplicateHelp: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  actionButton: {
    background: "var(--button-secondary-bg)",
    color: "var(--button-secondary-text)",
    border: "1px solid var(--button-border)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    cursor: "pointer",
  },
  viewModalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "18px 28px 24px 28px",
    borderTop: "1px solid var(--divider)",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "10px",
  },
};