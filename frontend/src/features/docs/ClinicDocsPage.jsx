import { useEffect, useMemo, useRef, useState } from "react";
import UploadDocumentsModal from "./UploadDocumentsModal";
import ManageMenuPortal from "./ManageMenuPortal";
import { buildAuthHeaders, downloadDocumentUrl } from "../../config/api";
import { getCurrentUser } from "../users/api/usersApi";
import {
  archiveDocument,
  deleteDocument,
  listDocuments,
  restoreDocument,
} from "./api/docsApi";
import { listDocumentAuditLogs } from "./api/auditApi";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export default function ClinicDocsPage() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [scopeFilter, setScopeFilter] = useState("All Scopes");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [viewDoc, setViewDoc] = useState(null);
  const [readinessDoc, setReadinessDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [replaceTargetDoc, setReplaceTargetDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "uploadedAt",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [manageMenu, setManageMenu] = useState(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(true);
  const toastTimerRef = useRef(null);

  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");

  const selectedClinicId = currentUser?.selectedClinicId || "";
  const effectivePermissionLevel = String(
    currentUser?.effectivePermissionLevel || ""
  ).toLowerCase();
  const organisationPermissionLevel = String(
    currentUser?.organisationPermissionLevel || ""
  ).toLowerCase();

  const canUpload = ["admin", "manage", "write"].includes(
    effectivePermissionLevel
  );
  const canDownload = ["admin", "manage", "write"].includes(
    effectivePermissionLevel
  );
  const canReplace = ["admin", "manage", "write"].includes(
    effectivePermissionLevel
  );
  const canArchive = ["admin", "manage"].includes(effectivePermissionLevel);
  const canRestore = ["admin", "manage"].includes(effectivePermissionLevel);
  const canDelete = ["admin", "manage"].includes(effectivePermissionLevel);
  const canViewAudit = ["admin", "manage"].includes(effectivePermissionLevel);
  const canManageAny = canReplace || canArchive || canRestore || canDelete;

  const isReadOnlyUser =
    effectivePermissionLevel === "read" &&
    !canUpload &&
    !canReplace &&
    !canArchive &&
    !canRestore &&
    !canDelete &&
    !canViewAudit;

  useEffect(() => {
    loadClinicDocsPage();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const hasProcessingDocs = documents.some(
      (doc) => doc.status === "Processing"
    );
    if (!hasProcessingDocs) return;

    const intervalId = setInterval(() => {
      fetchDocs({ silent: true });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [documents, currentUser]);


  useEffect(() => {
    const validIds = new Set(documents.map((doc) => doc.id));
    setSelectedDocumentIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [documents]);
  
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, scopeFilter, sortConfig, pageSize]);

  function showToast(message, type = "success") {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ message, type });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }

  async function loadClinicDocsPage() {
    setIsLoadingCurrentUser(true);
    setLoadError("");

    try {
      const me = await getCurrentUser();
      setCurrentUser(me);
      await fetchDocs();
    } catch (error) {
      setLoadError(error.message || "Failed to load clinic documents.");
    } finally {
      setIsLoadingCurrentUser(false);
    }
  }

  async function fetchAuditLogs() {
    if (!canViewAudit) {
      setAuditLogs([]);
      setAuditError("You do not have permission to view activity.");
      return;
    }

    setIsAuditLoading(true);
    setAuditError("");

    try {
      const logs = await listDocumentAuditLogs(50);
      setAuditLogs(logs);
    } catch (error) {
      setAuditError(error.message || "Failed to load activity.");
    } finally {
      setIsAuditLoading(false);
    }
  }

  async function refreshAuditLogsIfOpen() {
    if (!isAuditOpen) return;
    await fetchAuditLogs();
  }

  async function fetchDocs(options = {}) {

    const { silent = false, showErrorToast = false } = options;

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setLoadError("");
    }

    try {
      const docs = await listDocuments();

      const mappedDocs = docs
        .map((doc) => ({
          id: doc.documentId,
          name: doc.filename,
          type: formatDocumentType(doc.documentType),
          sourceType: formatSourceType(doc.sourceType),
          scope: doc.isShared ? "Shared" : "Clinic",
          access: formatAccess(doc.roleAccess),
          status: mapBackendStatus(doc.status, doc.indexStatus),
          readiness:
            doc.indexStatus === "pending"
              ? "Pending"
              : doc.readiness || "Pending",
          readinessNotes: doc.readinessNotes || "",
          uploadedAt: doc.uploadedAt,
        }))
        .sort(
          (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
        );

      setDocuments(mappedDocs);
    } catch (error) {
      const message = error.message || "Failed to load documents.";

      if (!silent) {
        setLoadError(message);
      }

      if (showErrorToast) {
        showToast(message, "error");
      }
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const searchValue = searchTerm.trim().toLowerCase();

      const matchesSearch =
        searchValue === "" ||
        doc.name.toLowerCase().includes(searchValue) ||
        doc.type.toLowerCase().includes(searchValue) ||
        doc.scope.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All Statuses"
          ? true
          : statusFilter === "Active"
          ? doc.status !== "Archived"
          : doc.status === statusFilter;

      const matchesScope =
        scopeFilter === "All Scopes" || doc.scope === scopeFilter;

      return matchesSearch && matchesStatus && matchesScope;
    });
  }, [documents, searchTerm, statusFilter, scopeFilter]);

  const sortedDocuments = useMemo(() => {
    const docs = [...filteredDocuments];
    const { key, direction } = sortConfig;

    docs.sort((a, b) => {
      let aValue;
      let bValue;

      if (key === "uploadedAt") {
        aValue = new Date(a.uploadedAt || 0).getTime();
        bValue = new Date(b.uploadedAt || 0).getTime();
      } else if (key === "readiness") {
        aValue = getReadinessSortWeight(
          getReadinessLabel(a.readiness, a.status)
        );
        bValue = getReadinessSortWeight(
          getReadinessLabel(b.readiness, b.status)
        );
      } else if (key === "status") {
        aValue = getStatusSortWeight(a.status);
        bValue = getStatusSortWeight(b.status);
      } else {
        aValue = String(a[key] || "").toLowerCase();
        bValue = String(b[key] || "").toLowerCase();
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });

    return docs;
  }, [filteredDocuments, sortConfig]);

  const selectedDocuments = useMemo(() => {
    const selectedSet = new Set(selectedDocumentIds);
    return sortedDocuments.filter((doc) => selectedSet.has(doc.id));
  }, [sortedDocuments, selectedDocumentIds]);


  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedDocuments.slice(startIndex, startIndex + pageSize);
  }, [sortedDocuments, currentPage, pageSize]);

  const paginatedSelectableDocuments = useMemo(() => {
    return paginatedDocuments.filter((doc) => {
      if (!canDelete) return false;
      return doc.status !== "Processing";
    });
  }, [paginatedDocuments, canDelete]);

  const allVisibleSelected =
    paginatedSelectableDocuments.length > 0 &&
    paginatedSelectableDocuments.every((doc) =>
      selectedDocumentIds.includes(doc.id)
    );

  const hasSelectedDocuments = selectedDocumentIds.length > 0;
  const canConfirmBulkDelete =
  bulkDeleteConfirmText.trim().toLowerCase() === "delete" && !isBulkDeleting;

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const emptyStateMessage = getEmptyStateMessage({
    isLoading,
    isLoadingCurrentUser,
    totalDocuments: documents.length,
    filteredCount: filteredDocuments.length,
    statusFilter,
    searchTerm,
    scopeFilter,
  });

  const totalDocuments = documents.length;
  const activeCount = documents.filter((doc) => doc.status !== "Archived").length;
  const readyCount = documents.filter((doc) => doc.status === "Ready").length;
  const processingCount = documents.filter(
    (doc) => doc.status === "Processing"
  ).length;
  const failedCount = documents.filter((doc) => doc.status === "Failed").length;
  const archivedCount = documents.filter(
    (doc) => doc.status === "Archived"
  ).length;

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    statusFilter !== "Active" ||
    scopeFilter !== "All Scopes";

  function handleView(doc) {
    setManageMenu(null);
    setViewDoc(doc);
  }

  function handleOpenReadiness(doc) {
    setManageMenu(null);
    setReadinessDoc(doc);
  }

  function handleQuickRetry(doc) {
    if (!canReplace) return;

    setManageMenu(null);
    setReplaceTargetDoc(doc);
    setIsUploadOpen(true);
    showToast("Ready to retry failed document.");
  }

  function handleOpenManageMenu(event, doc) {
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();

    setManageMenu((prev) => {
      if (prev?.doc?.id === doc.id) {
        return null;
      }

      return {
        doc,
        anchorRect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
        anchorElement: event.currentTarget,
      };
    });
  }

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "uploadedAt" ? "desc" : "asc",
      };
    });
  }

  function handleSummaryCardClick(nextStatusFilter) {
    setStatusFilter(nextStatusFilter);
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearchTerm("");
    setStatusFilter("Active");
    setScopeFilter("All Scopes");
    setCurrentPage(1);
  }

  function handleStatusBadgeClick(nextStatus) {
    setStatusFilter(nextStatus);
    setCurrentPage(1);
  }

  function handleToggleDocumentSelection(documentId) {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  }

  function handleToggleSelectAllVisible() {
    const visibleIds = paginatedSelectableDocuments.map((doc) => doc.id);

    if (visibleIds.length === 0) return;

    setSelectedDocumentIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.includes(id));

      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      const merged = new Set([...prev, ...visibleIds]);
      return Array.from(merged);
    });
  }

  function handleClearSelectedDocuments() {
    setSelectedDocumentIds([]);
    setBulkDeleteConfirmText("");
  }

  async function handleManageAction(action, doc) {
    setManageMenu(null);

    try {
      if (action === "Archive") {
        if (!canArchive) return;
        await archiveDocument(doc.id);

        await fetchDocs();
        await refreshAuditLogsIfOpen();
        showToast("Document archived.");
        return;
      }

      if (action === "Restore") {
        if (!canRestore) return;
        await restoreDocument(doc.id);

        await fetchDocs();
        await refreshAuditLogsIfOpen();
        showToast("Document restored.");
        return;
      }

      if (action === "Delete") {
        if (!canDelete) return;
        setDeleteDoc(doc);
        return;
      }

      if (action === "Replace") {
        if (!canReplace) return;
        setReplaceTargetDoc(doc);
        setIsUploadOpen(true);
        showToast("Ready to replace document.");
        return;
      }

      console.log(`${action} clicked:`, doc);
    } catch (error) {
      const message =
        error.message || `Failed to ${action.toLowerCase()} document.`;
      setLoadError(message);
      showToast(message, "error");
    }
  }

  async function handleBulkDeleteDocuments() {
    if (selectedDocuments.length === 0 || isBulkDeleting) return;

    setIsBulkDeleting(true);
    setLoadError("");

    try {
      for (const doc of selectedDocuments) {
        await deleteDocument(doc.id);
      }

      setBulkDeleteOpen(false);
      setSelectedDocumentIds([]);
      setBulkDeleteConfirmText("");

      await fetchDocs();
      await refreshAuditLogsIfOpen();

      showToast(
        selectedDocuments.length === 1
          ? "1 document deleted."
          : `${selectedDocuments.length} documents deleted.`
      );
    } catch (error) {
      const message = error.message || "Failed to delete selected documents.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  return (
    <>
      {toast && (
        <div
          style={{
            ...styles.toast,
            ...(toast.type === "error"
              ? styles.toastError
              : styles.toastSuccess),
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={styles.page}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Clinic Docs</h1>
            <p style={styles.subtitle}>
              {isReadOnlyUser
                ? "View the documents Dental Buddy AI can use for this clinic."
                : "Manage the documents Dental Buddy AI can use for this clinic."}
            </p>
          </div>

          <div style={styles.topBarActions}>
            {canViewAudit && (
              <button
                style={styles.secondaryTopButton}
                onClick={async () => {
                  setManageMenu(null);
                  setIsAuditOpen(true);
                  await fetchAuditLogs();
                }}
              >
                View Activity
              </button>
            )}

            {canUpload && (
              <button
                style={styles.uploadButton}
                onClick={() => {
                  setManageMenu(null);
                  setReplaceTargetDoc(null);
                  setIsUploadOpen(true);
                }}
              >
                Upload Documents
              </button>
            )}
          </div>
        </div>

        {isReadOnlyUser && (
          <div style={styles.readOnlyBanner}>
            <div style={styles.readOnlyBannerTitle}>Read-only access</div>
            <div style={styles.readOnlyBannerText}>
              You can view document details and AI readiness, but you cannot
              upload, replace, archive, restore, delete, download, or view
              activity.
            </div>
          </div>
        )}

        <div style={styles.summaryRow}>
          <SummaryCard
            label="Total Documents"
            value={String(totalDocuments)}
            isActive={statusFilter === "All Statuses"}
            onClick={() => handleSummaryCardClick("All Statuses")}
          />
          <SummaryCard
            label="Active"
            value={String(activeCount)}
            isActive={statusFilter === "Active"}
            onClick={() => handleSummaryCardClick("Active")}
          />
          <SummaryCard
            label="Ready"
            value={String(readyCount)}
            isActive={statusFilter === "Ready"}
            onClick={() => handleSummaryCardClick("Ready")}
          />
          <SummaryCard
            label="Processing"
            value={String(processingCount)}
            isActive={statusFilter === "Processing"}
            onClick={() => handleSummaryCardClick("Processing")}
          />
          <SummaryCard
            label="Failed"
            value={String(failedCount)}
            isActive={statusFilter === "Failed"}
            onClick={() => handleSummaryCardClick("Failed")}
          />
          <SummaryCard
            label="Archived"
            value={String(archivedCount)}
            isActive={statusFilter === "Archived"}
            onClick={() => handleSummaryCardClick("Archived")}
          />
        </div>

        <div style={styles.filterRow}>
          <input
            type="text"
            placeholder="Search documents..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            style={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>Active</option>
            <option>All Statuses</option>
            <option>Ready</option>
            <option>Processing</option>
            <option>Failed</option>
            <option>Archived</option>
          </select>

          <select
            style={styles.select}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option>All Scopes</option>
            <option>Clinic</option>
            <option>Shared</option>
          </select>

          {!isReadOnlyUser && (
            <select
              style={styles.select}
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={String(size)}>
                  {size} per page
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              style={styles.clearFiltersButton}
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        <div style={styles.refreshingText}>
          {isRefreshing && !isLoading ? "Refreshing documents…" : "\u00A0"}
        </div>

        {loadError && <div style={styles.errorBox}>{loadError}</div>}

        {canDelete && hasSelectedDocuments && (
          <div style={styles.bulkActionBar}>
            <div style={styles.bulkActionText}>
              <strong>{selectedDocumentIds.length}</strong>{" "}
              {selectedDocumentIds.length === 1 ? "document" : "documents"} selected
            </div>

            <div style={styles.bulkActionButtons}>
              <button
                type="button"
                style={styles.bulkSecondaryButton}
                onClick={handleClearSelectedDocuments}
              >
                Clear selection
              </button>

              <button
                type="button"
                style={styles.bulkDangerButton}
                onClick={() => {
                setManageMenu(null);
                setBulkDeleteConfirmText("");
                setBulkDeleteOpen(true);
              }}
              >
                Delete selected
              </button>
            </div>
          </div>
        )}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.checkboxTh}>
                  {canDelete ? (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleToggleSelectAllVisible}
                      aria-label="Select all visible documents"
                    />
                  ) : null}
                </th>
                <SortableHeader
                  label="Document Name"
                  sortKey="name"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Scope"
                  sortKey="scope"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Uploaded"
                  sortKey="uploadedAt"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="AI Readiness"
                  sortKey="readiness"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {isLoading || isLoadingCurrentUser ? (
                <tr>
                  <td style={styles.emptyStateCell} colSpan={8}>
                    <div style={styles.emptyStateWrap}>
                      <div style={styles.emptyStateIcon}>🦷</div>
                      <div style={styles.emptyStateTitle}>Loading documents</div>
                      <div style={styles.emptyStateText}>{emptyStateMessage}</div>
                    </div>
                  </td>
                </tr>
              ) : paginatedDocuments.length === 0 ? (
                <tr>
                  <td style={styles.emptyStateCell} colSpan={8}>
                    <div style={styles.emptyStateWrap}>
                      <div style={styles.emptyStateIcon}>
                        {statusFilter === "Archived" ? "🗂️" : "📄"}
                      </div>
                      <div style={styles.emptyStateTitle}>
                        {statusFilter === "Archived"
                          ? "No archived documents"
                          : statusFilter === "Active"
                          ? "No active documents"
                          : "No documents to show"}
                      </div>
                      <div style={styles.emptyStateText}>{emptyStateMessage}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    style={styles.tr}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--table-row-hover)";
                      const nameCell = e.currentTarget.querySelector(
                        "[data-doc-name='true']"
                      );
                      if (nameCell) {
                        nameCell.style.color = "var(--text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      const nameCell = e.currentTarget.querySelector(
                        "[data-doc-name='true']"
                      );
                      if (nameCell) {
                        nameCell.style.color = "var(--text-primary)";
                      }
                    }}
                  >
                    <td style={styles.checkboxTd}>
                      {canDelete ? (
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(doc.id)}
                          onChange={() => handleToggleDocumentSelection(doc.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${doc.name}`}
                        />
                      ) : null}
                    </td>
                    <td data-doc-name="true" style={styles.tdStrong}>
                      {doc.name}
                    </td>
                    <td style={styles.td}>{doc.type}</td>
                    <td style={styles.td}>{doc.scope}</td>
                    <td style={styles.td}>{formatUploadedAt(doc.uploadedAt)}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => handleStatusBadgeClick(doc.status)}
                        style={styles.badgeButton}
                        title={`Filter by ${doc.status}`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.opacity = "0.92";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.opacity = "1";
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.outline =
                            "2px solid var(--focus-ring)";
                          e.currentTarget.style.outlineOffset = "3px";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = "none";
                        }}
                      >
                        <Badge kind="status" value={doc.status} />
                      </button>
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => handleOpenReadiness(doc)}
                        style={styles.readinessBadgeButton}
                        title="View AI readiness details"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.opacity = "0.92";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.opacity = "1";
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.outline =
                            "2px solid var(--focus-ring)";
                          e.currentTarget.style.outlineOffset = "3px";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = "none";
                        }}
                      >
                        <Badge
                          kind="readiness"
                          value={getReadinessLabel(doc.readiness, doc.status)}
                        />
                      </button>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => handleView(doc)}
                        >
                          View
                        </button>

                        {doc.status === "Failed" && canReplace && (
                          <button
                            type="button"
                            style={styles.retryActionButton}
                            onClick={() => handleQuickRetry(doc)}
                          >
                            Retry
                          </button>
                        )}

                        {canManageAny && (
                          <div style={styles.manageWrapper}>
                            <button
                              type="button"
                              style={{
                                ...styles.actionButton,
                                ...(manageMenu?.doc?.id === doc.id
                                  ? styles.actionButtonActive
                                  : {}),
                              }}
                              onClick={(e) => handleOpenManageMenu(e, doc)}
                              onMouseEnter={(e) => {
                                if (manageMenu?.doc?.id !== doc.id) {
                                  e.currentTarget.style.transform =
                                    "translateY(-1px)";
                                  e.currentTarget.style.borderColor =
                                    "var(--table-action-hover-border)";
                                  e.currentTarget.style.background =
                                    "var(--table-action-hover-bg)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (manageMenu?.doc?.id !== doc.id) {
                                  e.currentTarget.style.transform =
                                    "translateY(0)";
                                  e.currentTarget.style.borderColor =
                                    "var(--button-border)";
                                  e.currentTarget.style.background =
                                    "var(--button-secondary-bg)";
                                }
                              }}
                            >
                              Manage ▾
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && sortedDocuments.length > 0 && (
          <div style={styles.paginationRow}>
            <div style={styles.paginationInfo}>
              Showing{" "}
              <strong>
                {Math.min((currentPage - 1) * pageSize + 1, sortedDocuments.length)}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(currentPage * pageSize, sortedDocuments.length)}
              </strong>{" "}
              of <strong>{sortedDocuments.length}</strong> results
            </div>

            {!isReadOnlyUser && (
              <div style={styles.paginationControls}>
                <button
                  type="button"
                  style={{
                    ...styles.paginationButton,
                    ...(currentPage === 1
                      ? styles.paginationButtonDisabled
                      : {}),
                  }}
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                >
                  Previous
                </button>

                <div style={styles.pageIndicator}>
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.paginationButton,
                    ...(currentPage === totalPages
                      ? styles.paginationButtonDisabled
                      : {}),
                  }}
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <UploadDocumentsModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setReplaceTargetDoc(null);
        }}
        onUploadComplete={async () => {
          await fetchDocs();
          await refreshAuditLogsIfOpen();
          showToast(
            replaceTargetDoc
              ? "Replacement uploaded and processing started."
              : "Document uploaded and processing started."
          );
        }}
        existingDocuments={documents}
        replaceTargetDoc={replaceTargetDoc}
        currentUser={currentUser}
      />

      <ViewDocumentModal
        document={viewDoc}
        canDownload={canDownload}
        canReplace={canReplace}
        onClose={() => {
          setViewDoc(null);
        }}
        onReplaceDocument={(doc) => {
          if (!canReplace) return;
          setViewDoc(null);
          setReplaceTargetDoc(doc);
          setIsUploadOpen(true);
          showToast("Ready to replace document.");
        }}
      />

      <ReadinessModal
        document={readinessDoc}
        canDownload={canDownload}
        canReplace={canReplace}
        onClose={() => {
          setReadinessDoc(null);
        }}
        onViewDocument={(doc) => {
          setReadinessDoc(null);
          setViewDoc(doc);
        }}
      />

      <DeleteDocumentModal
        document={canDelete ? deleteDoc : null}
        onClose={() => setDeleteDoc(null)}
        onDeleted={async () => {
          await fetchDocs();
          await refreshAuditLogsIfOpen();
        }}
        setLoadError={setLoadError}
        showToast={showToast}
      />

      <AuditHistoryModal
        isOpen={canViewAudit && isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        logs={auditLogs}
        isLoading={isAuditLoading}
        error={auditError}
      />

      {bulkDeleteOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.bulkDeleteModal}>
            <div style={styles.bulkDeleteHeader}>
              <div style={styles.bulkDeleteHeaderContent}>
                <div style={styles.bulkDeleteEyebrow}>Danger zone</div>
                <h2 style={styles.bulkDeleteTitle}>Delete selected documents</h2>
                <p style={styles.bulkDeleteSubtitle}>
                  This will permanently remove the selected documents from Clinic Docs,
                  including their stored records and retrieval data.
                </p>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={() => {
                  if (!isBulkDeleting) {
                    setBulkDeleteOpen(false);
                    setBulkDeleteConfirmText("");
                  }
                }}
                disabled={isBulkDeleting}
                aria-label="Close delete selected documents modal"
              >
                ✕
              </button>
            </div>

            <div style={styles.bulkDeleteBody}>
              <div style={styles.bulkDeleteWarningCard}>
                <div style={styles.bulkDeleteWarningIcon}>!</div>
                <div>
                  <div style={styles.bulkDeleteWarningTitle}>
                    This action cannot be undone
                  </div>
                  <div style={styles.bulkDeleteWarningText}>
                    You are about to permanently delete{' '}
                    <strong>
                      {selectedDocuments.length}{' '}
                      {selectedDocuments.length === 1 ? 'document' : 'documents'}
                    </strong>
                    . Make sure these are the correct files before continuing.
                  </div>
                </div>
              </div>

              <div style={styles.bulkDeleteSection}>
                <div style={styles.bulkDeleteSectionHeader}>
                  <div style={styles.bulkDeleteSectionTitle}>Selected files</div>
                  <div style={styles.bulkDeleteSectionMeta}>
                    {selectedDocuments.length} selected
                  </div>
                </div>

                <div style={styles.bulkDeleteList}>
                  {selectedDocuments.map((doc, index) => (
                    <div key={doc.id} style={styles.bulkDeleteListItem}>
                      <div style={styles.bulkDeleteListTop}>
                        <div style={styles.bulkDeleteFileMetaWrap}>
                          <div style={styles.bulkDeleteFileIndex}>{index + 1}</div>
                          <div style={styles.bulkDeleteFileTextWrap}>
                            <div style={styles.bulkDeleteName}>{doc.name}</div>
                            <div style={styles.bulkDeleteMetaRow}>
                              <span style={styles.bulkDeleteMetaPill}>{doc.type}</span>
                              <span style={styles.bulkDeleteMetaPill}>{doc.scope}</span>
                              <span style={styles.bulkDeleteMetaPill}>
                                Uploaded {formatUploadedAt(doc.uploadedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={styles.bulkDeleteStatusWrap}>
                          <Badge kind="status" value={doc.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.bulkDeleteConfirmCard}>
                <div style={styles.bulkDeleteConfirmTitle}>Confirmation required</div>
                <label htmlFor="bulk-delete-confirm" style={styles.deleteConfirmLabel}>
                  Type <strong>delete</strong> to enable permanent deletion
                </label>
                <input
                  id="bulk-delete-confirm"
                  type="text"
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder="delete"
                  style={{
                    ...styles.deleteConfirmInput,
                    ...(bulkDeleteConfirmText.trim() &&
                    bulkDeleteConfirmText.trim().toLowerCase() !== 'delete'
                      ? styles.deleteConfirmInputInvalid
                      : {}),
                    ...(bulkDeleteConfirmText.trim().toLowerCase() === 'delete'
                      ? styles.deleteConfirmInputValid
                      : {}),
                  }}
                  autoComplete="off"
                  autoFocus
                />
                <div style={styles.bulkDeleteConfirmHint}>
                  This extra step helps prevent accidental deletion.
                </div>
              </div>
            </div>

            <div style={styles.bulkDeleteFooter}>
              <button
                type="button"
                style={styles.bulkDeleteCancelButton}
                onClick={() => {
                  setBulkDeleteOpen(false);
                  setBulkDeleteConfirmText("");
                }}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  ...styles.bulkDeleteConfirmButton,
                  ...(!canConfirmBulkDelete ? styles.deleteButtonDisabled : {}),
                }}
                onClick={handleBulkDeleteDocuments}
                disabled={!canConfirmBulkDelete}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ManageMenuPortal
        menuState={manageMenu}
        canReplace={canReplace}
        canArchive={canArchive}
        canRestore={canRestore}
        canDelete={canDelete}
        onClose={() => setManageMenu(null)}
        onAction={handleManageAction}
      />
    </>
  );
}

function SortableHeader({ label, sortKey, sortConfig, onSort }) {
  const isActive = sortConfig.key === sortKey;
  const arrow = isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕";

  return (
    <th style={styles.th}>
      <button
        type="button"
        style={{
          ...styles.sortButton,
          ...(isActive ? styles.sortButtonActive : {}),
        }}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span style={styles.sortArrow}>{arrow}</span>
      </button>
    </th>
  );
}

function ViewDocumentModal({
  document,
  canDownload,
  canReplace,
  onClose,
  onReplaceDocument,
}) {
  if (!document) return null;

  const isViewOnlyModal = !canDownload && !canReplace;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.viewModal}>
        <div style={styles.viewModalHeader}>
          <div>
            <h2 style={styles.viewModalTitle}>Document Details</h2>
            <p style={styles.viewModalSubtitle}>
              Review this document’s current details.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.viewModalBody}>
          <div style={styles.viewSection}>
            <div style={styles.viewSectionTitle}>Document Details</div>

            <DetailRow label="Document Name" value={document.name} />
            <DetailRow label="Type" value={document.type} />
            <DetailRow label="Scope" value={document.scope} />
            <DetailRow label="Access" value={document.access} />
            <DetailRow label="Source Type" value={document.sourceType} />
            <DetailRow
              label="Uploaded"
              value={formatUploadedAt(document.uploadedAt)}
            />
            <DetailRow label="Status" value={document.status} />
            {isViewOnlyModal && (
              <div style={styles.readOnlyViewNote}>
                This document is view-only for your access level.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            ...styles.viewModalFooter,
            ...(isViewOnlyModal ? styles.viewModalFooterViewOnly : {}),
          }}
        >
          {!isViewOnlyModal && canDownload && (
            <button
              type="button"
              style={styles.primaryButton}
              onClick={async () => {
                try {
                  const response = await fetch(downloadDocumentUrl(document.id), {
                    headers: buildAuthHeaders(),
                  });

                  if (!response.ok) {
                    let data = null;

                    try {
                      data = await response.json();
                    } catch {
                      data = null;
                    }

                    throw new Error(
                      data?.detail || data?.message || "Download failed"
                    );
                  }

                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = window.document.createElement("a");
                  link.href = url;
                  link.download = document.name || "document";
                  window.document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  alert(error.message || "Download failed");
                }
              }}
            >
              Download document
            </button>
          )}

          {!isViewOnlyModal && canReplace && (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => onReplaceDocument(document)}
            >
              Replace document
            </button>
          )}

          <button
            type="button"
            style={isViewOnlyModal ? styles.primaryButton : styles.secondaryButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadinessModal({
  document,
  onClose,
  onViewDocument,
  canDownload = false,
  canReplace = false,
}) {
  if (!document) return null;

  const readinessInfo = getReadinessInfo(document.readiness, document.status);
  const isReadOnlyReadiness = !canDownload && !canReplace;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.readinessModal}>
        <div style={styles.viewModalHeader}>
          <div>
            <h2 style={styles.viewModalTitle}>AI Readiness</h2>
            <p style={styles.viewModalSubtitle}>
              Review how suitable this document is for Dental Buddy AI.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.viewModalBody}>
          <div style={styles.readinessHeroCard}>
            <div style={styles.readinessHeroTop}>
              <div>
                <div style={styles.readinessDocName}>{document.name}</div>
                <p style={styles.readinessSummaryText}>
                  {readinessInfo.summary}
                </p>
              </div>

              <Badge
                kind="readiness"
                value={getReadinessLabel(document.readiness, document.status)}
              />
            </div>
          </div>

          <div style={styles.readinessHelperBox}>
            <div style={styles.readinessHelperTitle}>Next step</div>
            <div style={styles.readinessHelperText}>
              {isReadOnlyReadiness
                ? "If this document needs improvement, contact a user with update access such as a Practice Manager, Manager, or Admin."
                : "To improve this document, download it from Document Details, make your changes, then replace the document."}
            </div>
          </div>

          <div style={styles.readinessCard}>
            <div style={styles.readinessBlock}>
              <div style={styles.readinessBlockTitle}>What was detected</div>
              {renderReadinessNotes(document.readinessNotes)}
            </div>

            <div style={styles.readinessBlock}>
              <div style={styles.readinessBlockTitle}>Recommended action</div>
              <div style={styles.readinessActionText}>
                {readinessInfo.action}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...styles.viewModalFooter,
            ...(isReadOnlyReadiness ? styles.viewModalFooterViewOnly : {}),
          }}
        >
          {!isReadOnlyReadiness && (
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => onViewDocument(document)}
            >
              View document details
            </button>
          )}

          <button
            type="button"
            style={isReadOnlyReadiness ? styles.primaryButton : styles.secondaryButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteDocumentModal({
  document,
  onClose,
  onDeleted,
  setLoadError,
  showToast,
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!document) {
      setConfirmText("");
      setIsDeleting(false);
    }
  }, [document]);

  if (!document) return null;

  const canDelete = confirmText.trim().toLowerCase() === "delete" && !isDeleting;

  async function handleDelete() {
    if (!canDelete) return;

    setIsDeleting(true);

    try {
      await deleteDocument(document.id);

      onClose();
      await onDeleted();
      showToast("Document deleted.");
    } catch (error) {
      const message = error.message || "Failed to delete document.";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.deleteModal}>
        <div style={styles.viewModalHeader}>
          <div>
            <h2 style={styles.viewModalTitle}>Delete Document</h2>
            <p style={styles.viewModalSubtitle}>
              This will permanently remove the document, its stored record, and
              its Qdrant data.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.deleteModalBody}>
          <div style={styles.deleteWarningBox}>
            <div style={styles.deleteWarningTitle}>You are deleting:</div>
            <div style={styles.deleteWarningFile}>{document.name}</div>
            <div style={styles.deleteWarningText}>
              This action cannot be undone.
            </div>
          </div>

          <div style={styles.fieldBlock}>
            <label style={styles.detailLabel}>
              Type <strong>delete</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={styles.deleteInput}
              placeholder="delete"
            />
          </div>
        </div>

        <div style={styles.viewModalFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>

          <button
            type="button"
            style={{
              ...styles.deleteConfirmButton,
              ...(!canDelete ? styles.deleteConfirmButtonDisabled : {}),
            }}
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {isDeleting ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditHistoryModal({ isOpen, onClose, logs, isLoading, error }) {
  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.auditModal}>
        <div style={styles.viewModalHeader}>
          <div>
            <h2 style={styles.viewModalTitle}>Document Activity</h2>
            <p style={styles.viewModalSubtitle}>
              Review recent document changes for this clinic.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.auditModalBody}>
          {isLoading ? (
            <div style={styles.auditEmpty}>Loading activity...</div>
          ) : error ? (
            <div style={styles.errorBox}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={styles.auditEmpty}>No activity found yet.</div>
          ) : (
            <div style={styles.auditList}>
              {logs.map((log) => (
                <div
                  key={log.auditId}
                  style={styles.auditItem}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor =
                      "var(--table-action-hover-border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "var(--border-soft)";
                  }}
                >
                  <div style={styles.auditItemTop}>
                    <div style={getAuditActionStyle(log.action)}>
                      {formatAuditAction(log.action)}
                    </div>
                    <div style={styles.auditTime}>
                      {formatUploadedAt(log.performedAt)}
                    </div>
                  </div>

                  <div style={styles.auditFilename}>
                    {log.filename || "Unknown document"}
                  </div>

                  <div style={styles.auditMeta}>
                    Updated by {log.performedBy || "Unknown user"}
                  </div>

                  {log.action === "replaced" ? (
                    <div style={styles.auditNotes}>
                      Replaced previous version
                    </div>
                  ) : log.notes ? (
                    <div style={styles.auditNotes}>{log.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.viewModalFooter}>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value || "—"}</div>
    </div>
  );
}

function SummaryCard({ label, value, isActive = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.summaryCard,
        ...(isActive ? styles.summaryCardActive : {}),
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = "var(--table-action-hover-border)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "var(--border-strong)";
        }
      }}
    >
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summaryLabel}>{label}</div>
    </button>
  );
}

function Badge({ kind, value }) {
  if (value === "—" || value === "Pending") {
    return <span style={styles.badgeNeutral}>Pending</span>;
  }

  if (kind === "status") {
    if (value === "Ready") return <span style={styles.badgeReady}>Ready</span>;
    if (value === "Processing")
      return <span style={styles.badgeProcessing}>Processing</span>;
    if (value === "Failed") return <span style={styles.badgeFailed}>Failed</span>;
    if (value === "Archived")
      return <span style={styles.badgeArchived}>Archived</span>;
  }

  if (kind === "readiness") {
    if (value === "Ready") {
      return <span style={styles.badgeReadinessGood}>Ready</span>;
    }
    if (value === "Needs review") {
      return <span style={styles.badgeReadinessWarn}>Needs review</span>;
    }
    if (value === "Fix required") {
      return <span style={styles.badgeReadinessPoor}>Fix required</span>;
    }
    if (value === "Processing") {
      return <span style={styles.badgeProcessing}>Processing</span>;
    }
    if (value === "Failed") {
      return <span style={styles.badgeFailed}>Failed</span>;
    }
    if (value === "Archived") {
      return <span style={styles.badgeArchived}>Archived</span>;
    }

    return <span style={styles.badgeNeutral}>{value}</span>;
  }

  return <span style={styles.badgeNeutral}>{value}</span>;
}

function formatDocumentType(value) {
  if (!value) return "Other";
  if (String(value).toLowerCase() === "sop") return "SOP";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatSourceType(value) {
  if (!value) return "File";
  if (value.toLowerCase() === "internal") return "File";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatAccess(value) {
  if (!value) return "Read";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatUploadedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReadinessLabel(readiness, status) {
  if (status === "Processing") return "Processing";
  if (status === "Failed") return "Failed";
  if (status === "Archived") return "Archived";

  switch (readiness) {
    case "Good for DBA":
      return "Ready";
    case "Usable with warnings":
      return "Needs review";
    case "Needs improvement":
      return "Fix required";
    default:
      return "Pending";
  }
}

function getReadinessInfo(readiness, status) {
  if (status === "Processing") {
    return {
      summary:
        "This document is still being processed, so AI readiness is not available yet.",
      action:
        "Wait for processing to complete, then reopen this readiness check to review the result.",
    };
  }

  if (status === "Failed") {
    return {
      summary:
        "This document could not be processed successfully, so Dental Buddy AI cannot rely on it.",
      action:
        "Use Retry or Replace to upload a corrected version of the document.",
    };
  }

  if (status === "Archived") {
    return {
      summary:
        "This document is archived and is not currently used by Dental Buddy AI.",
      action:
        "Restore the document if you want Dental Buddy AI to use it again.",
    };
  }

  switch (readiness) {
    case "Good for DBA":
      return {
        summary:
          "This document is structured well for Dental Buddy AI and should return reliable answers.",
        action:
          "No immediate changes are needed unless you want to improve formatting further.",
      };

    case "Usable with warnings":
      return {
        summary:
          "This document can be used by Dental Buddy AI, but answers may be less reliable than a well-structured SOP.",
        action:
          "Improve headings, break content into clearer sections, and add step-by-step structure where possible.",
      };

    case "Needs improvement":
      return {
        summary:
          "This document may not work well for Dental Buddy AI and could produce weaker or incomplete answers.",
        action:
          "Improve readability, add clearer headings, and structure the content into steps or sections before relying on it.",
      };

    default:
      return {
        summary:
          "AI readiness information is not available for this document yet.",
        action:
          "Try reopening the document later or replace it if the issue continues.",
      };
  }
}

function renderReadinessNotes(value) {
  if (!value) {
    return <div style={styles.readinessEmpty}>No readiness notes available.</div>;
  }

  const notes = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (notes.length === 0) {
    return <div style={styles.readinessEmpty}>No readiness notes available.</div>;
  }

  return (
    <div style={styles.readinessNotesList}>
      {notes.map((note, index) => (
        <div key={index} style={styles.readinessNoteItem}>
          <span style={styles.readinessBullet}>•</span>
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

function getStatusSortWeight(status) {
  switch (status) {
    case "Ready":
      return 1;
    case "Processing":
      return 2;
    case "Failed":
      return 3;
    case "Archived":
      return 4;
    default:
      return 5;
  }
}

function getReadinessSortWeight(readinessLabel) {
  switch (readinessLabel) {
    case "Ready":
      return 1;
    case "Needs review":
      return 2;
    case "Fix required":
      return 3;
    case "Processing":
      return 4;
    case "Failed":
      return 5;
    case "Archived":
      return 6;
    default:
      return 7;
  }
}

function formatAuditAction(value) {
  if (!value) return "Updated";

  switch (value) {
    case "uploaded":
      return "Uploaded";
    case "replaced":
      return "Replaced";
    case "archived":
      return "Archived";
    case "restored":
      return "Restored";
    case "deleted":
      return "Deleted";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

function getAuditActionStyle(action) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
    border: "1px solid",
  };

  switch (action) {
    case "uploaded":
      return {
        ...baseStyle,
        background: "rgba(34,197,94,0.12)",
        color: "#16a34a",
        borderColor: "rgba(34,197,94,0.24)",
      };
    case "replaced":
      return {
        ...baseStyle,
        background: "rgba(59,130,246,0.12)",
        color: "var(--avatar-text)",
        borderColor: "rgba(59,130,246,0.24)",
      };
    case "archived":
      return {
        ...baseStyle,
        background: "rgba(148,163,184,0.12)",
        color: "var(--text-secondary)",
        borderColor: "rgba(148,163,184,0.24)",
      };
    case "restored":
      return {
        ...baseStyle,
        background: "rgba(6,182,212,0.12)",
        color: "#0891b2",
        borderColor: "rgba(6,182,212,0.24)",
      };
    case "deleted":
      return {
        ...baseStyle,
        background: "rgba(239,68,68,0.12)",
        color: "var(--danger-text)",
        borderColor: "rgba(239,68,68,0.24)",
      };
    default:
      return {
        ...baseStyle,
        background: "rgba(148,163,184,0.12)",
        color: "var(--text-secondary)",
        borderColor: "rgba(148,163,184,0.24)",
      };
  }
}

function mapBackendStatus(status, indexStatus) {
  const normalizedStatus = String(status || "").toLowerCase();
  const normalizedIndexStatus = String(indexStatus || "").toLowerCase();

  if (normalizedStatus === "archived") return "Archived";
  if (normalizedIndexStatus === "pending") return "Processing";
  if (normalizedIndexStatus === "failed") return "Failed";
  return "Ready";
}

function getEmptyStateMessage({
  isLoading,
  isLoadingCurrentUser,
  totalDocuments,
  filteredCount,
  statusFilter,
  searchTerm,
  scopeFilter,
}) {
  if (isLoading || isLoadingCurrentUser) {
    return "Loading documents...";
  }

  if (totalDocuments === 0) {
    return "No documents uploaded yet.";
  }

  const hasSearch = searchTerm.trim() !== "";
  const hasScopeFilter = scopeFilter !== "All Scopes";
  const hasCustomFilter =
    hasSearch ||
    hasScopeFilter ||
    (statusFilter !== "Active" && statusFilter !== "All Statuses");

  if (filteredCount > 0) {
    return "";
  }

  if (statusFilter === "Active") {
    return "No active documents found.";
  }

  if (statusFilter === "Archived") {
    return "No archived documents found.";
  }

  if (hasCustomFilter) {
    return "No documents match your filters.";
  }

  return "No documents found.";
}

const styles = {
  page: {
    width: "100%",
  },
  viewModalFooterViewOnly: {
    justifyContent: "center",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "24px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  subtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "15px",
  },
  uploadButton: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  summaryCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "16px",
    padding: "18px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
    transform: "translateY(0)",
    boxShadow: "var(--shadow-soft)",
  },
  summaryCardActive: {
    border: "1px solid var(--table-action-hover-border)",
    boxShadow: "0 0 0 1px rgba(96,165,250,0.18) inset",
  },
  summaryValue: {
    fontSize: "24px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  summaryLabel: {
    marginTop: "6px",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  filterRow: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    minWidth: "260px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  select: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
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
  },
  toast: {
    position: "fixed",
    top: "24px",
    right: "24px",
    zIndex: 2000,
    minWidth: "260px",
    maxWidth: "360px",
    padding: "14px 16px",
    borderRadius: "14px",
    fontSize: "14px",
    fontWeight: "600",
    boxShadow: "var(--shadow-strong)",
    border: "1px solid",
  },
  toastSuccess: {
    background: "rgba(34,197,94,0.12)",
    color: "#16a34a",
    borderColor: "rgba(34,197,94,0.28)",
  },
  toastError: {
    background: "rgba(239,68,68,0.12)",
    color: "var(--danger-text)",
    borderColor: "rgba(248,113,113,0.28)",
  },
  tableWrap: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "var(--shadow-soft)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    fontSize: "12px",
    color: "var(--text-muted)",
    fontWeight: "600",
    padding: "16px",
    borderBottom: "1px solid var(--border-strong)",
    background: "var(--table-header-bg)",
  },
  sortButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
  },
  sortButtonActive: {
    color: "var(--text-secondary)",
  },
  sortArrow: {
    fontSize: "11px",
    opacity: 0.9,
    flexShrink: 0,
  },
  tr: {
    borderBottom: "1px solid var(--border-strong)",
    transition: "background 0.15s ease",
  },
  td: {
    padding: "16px",
    color: "var(--text-secondary)",
    fontSize: "14px",
    verticalAlign: "top",
  },
  tdStrong: {
    padding: "16px",
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "600",
    verticalAlign: "top",
    transition: "color 0.15s ease",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  actionButton: {
    background: "var(--button-secondary-bg)",
    color: "var(--button-secondary-text)",
    border: "1px solid var(--button-border)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    transform: "translateY(0)",
  },
  actionButtonActive: {
    background: "var(--table-action-hover-bg)",
    borderColor: "var(--table-action-hover-border)",
    transform: "translateY(-1px)",
    boxShadow: "0 0 0 1px rgba(96,165,250,0.12) inset",
  },
  retryActionButton: {
    background: "rgba(239, 68, 68, 0.12)",
    color: "var(--danger-text)",
    border: "1px solid rgba(248, 113, 113, 0.25)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  readinessBadgeButton: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    padding: "0",
    border: "none",
    background: "transparent",
    borderRadius: "999px",
    transition: "transform 0.15s ease, opacity 0.15s ease",
  },
  badgeButton: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    padding: "0",
    border: "none",
    background: "transparent",
    borderRadius: "999px",
    transition: "transform 0.15s ease, opacity 0.15s ease",
  },
  manageWrapper: {
    display: "inline-flex",
    alignItems: "center",
  },
  badgeReady: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.14)",
    color: "#16a34a",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeProcessing: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.14)",
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeFailed: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(244,63,94,0.14)",
    color: "var(--danger-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeArchived: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeReadinessGood: {
    display: "inline-block",
    background: "rgba(34,197,94,0.12)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.25)",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeReadinessWarn: {
    display: "inline-block",
    background: "rgba(250,204,21,0.12)",
    color: "#b45309",
    border: "1px solid rgba(250,204,21,0.25)",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeReadinessPoor: {
    display: "inline-block",
    background: "rgba(248,113,113,0.12)",
    color: "var(--danger-text)",
    border: "1px solid rgba(248,113,113,0.25)",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeNeutral: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: "600",
  },
  paginationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginTop: "16px",
    flexWrap: "wrap",
  },
  paginationInfo: {
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  paginationButton: {
    background: "var(--button-secondary-bg)",
    color: "var(--button-secondary-text)",
    border: "1px solid var(--button-border)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    cursor: "pointer",
  },
  paginationButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  pageIndicator: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: "600",
    minWidth: "96px",
    textAlign: "center",
  },
  modalOverlay: {
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
  viewModal: {
    width: "100%",
    maxWidth: "620px",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  readinessModal: {
    width: "100%",
    maxWidth: "640px",
    background: "var(--modal-bg)",
    border: "1px solid rgba(250,204,21,0.18)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  deleteModal: {
    width: "100%",
    maxWidth: "620px",
    background: "var(--modal-bg)",
    border: "1px solid rgba(244,63,94,0.2)",
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
  viewModalBody: {
    padding: "20px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  viewSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  viewSectionTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-primary)",
    marginBottom: "4px",
  },
  readinessHeroCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "18px",
  },
  readinessHeroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  readinessDocName: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  readinessHelperBox: {
    background: "rgba(37, 99, 235, 0.08)",
    border: "1px solid rgba(96,165,250,0.18)",
    borderRadius: "16px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  readinessHelperTitle: {
    color: "var(--avatar-text)",
    fontSize: "13px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  readinessHelperText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  readinessCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  readinessSummaryText: {
    margin: "8px 0 0 0",
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "460px",
  },
  readinessBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  readinessBlockTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--avatar-text)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  readinessNotesList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  readinessNoteItem: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.5,
    display: "flex",
    gap: "6px",
  },
  readinessBullet: {
    color: "var(--avatar-text)",
  },
  readinessActionText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  readinessEmpty: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  deleteModalBody: {
    padding: "22px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  deleteWarningBox: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.18)",
    borderRadius: "16px",
    padding: "14px 16px",
  },
  deleteWarningTitle: {
    color: "var(--danger-text)",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "8px",
  },
  deleteWarningFile: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  deleteWarningText: {
    marginTop: "8px",
    color: "var(--danger-text)",
    fontSize: "13px",
  },
  topBarActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  secondaryTopButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--button-border)",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  auditModal: {
    width: "100%",
    maxWidth: "760px",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  auditModalBody: {
    padding: "20px 28px 24px 28px",
    maxHeight: "60vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  auditList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  auditItem: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "14px 16px",
    transition: "all 0.15s ease",
    cursor: "default",
  },
  auditItemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  auditTime: {
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  auditFilename: {
    marginTop: "8px",
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontWeight: "600",
    wordBreak: "break-word",
  },
  auditMeta: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  auditNotes: {
    marginTop: "8px",
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  auditEmpty: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  fieldBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  refreshingText: {
    color: "var(--text-muted)",
    fontSize: "13px",
    marginBottom: "12px",
  },
  deleteInput: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: "16px",
    padding: "12px 0",
    borderBottom: "1px solid var(--divider)",
  },
  detailLabel: {
    color: "var(--text-muted)",
    fontSize: "13px",
    fontWeight: "600",
  },
  detailValue: {
    color: "var(--text-primary)",
    fontSize: "14px",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  viewModalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "18px 28px 24px 28px",
    borderTop: "1px solid var(--divider)",
  },
  primaryButton: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
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
  deleteConfirmButton: {
    background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(239,68,68,0.18)",
  },
  deleteConfirmButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    boxShadow: "none",
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
  emptyStateCell: {
    padding: "40px 24px",
    textAlign: "center",
    borderBottom: "1px solid var(--border-strong)",
    background: "var(--surface-1)",
  },
  emptyStateWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    minHeight: "180px",
  },
  emptyStateIcon: {
    fontSize: "32px",
    lineHeight: 1,
  },
  emptyStateTitle: {
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: "700",
  },
  emptyStateText: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "420px",
  },
  readOnlyBanner: {
    marginBottom: "24px",
    background: "rgba(59,130,246,0.08)",
    border: "1px solid rgba(96,165,250,0.18)",
    borderRadius: "16px",
    padding: "14px 16px",
  },
  readOnlyBannerTitle: {
    color: "var(--avatar-text)",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  readOnlyBannerText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.55,
  },
  readOnlyViewNote: {
    marginTop: "4px",
    background: "rgba(59,130,246,0.08)",
    border: "1px solid rgba(96,165,250,0.18)",
    borderRadius: "14px",
    padding: "12px 14px",
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  clearFiltersButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--button-border)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  bulkActionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "16px",
    boxShadow: "var(--shadow-soft)",
  },
  bulkActionText: {
    fontSize: "14px",
    color: "var(--text-primary)",
  },
  bulkActionButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  bulkSecondaryButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  bulkDangerButton: {
    background: "rgba(239,68,68,0.10)",
    color: "var(--danger-text)",
    border: "1px solid rgba(239,68,68,0.22)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  checkboxTh: {
    width: "52px",
    textAlign: "center",
    padding: "14px 12px",
    borderBottom: "1px solid var(--border-strong)",
    background: "var(--table-header-bg)",
  },
  checkboxTd: {
    width: "52px",
    textAlign: "center",
    padding: "16px 12px",
    borderBottom: "1px solid var(--border-soft)",
  },
  bulkDeleteList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "320px",
    overflowY: "auto",
    padding: "14px",
  },
  bulkDeleteListItem: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "14px 16px",
  },
  bulkDeleteName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "var(--text-primary)",
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  bulkDeleteModal: {
    width: "100%",
    maxWidth: "780px",
    background: "var(--modal-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "28px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  bulkDeleteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    padding: "26px 28px 20px",
    borderBottom: "1px solid var(--divider)",
    background:
      "linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)",
  },
  bulkDeleteHeaderContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  bulkDeleteEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "var(--danger-text)",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.02em",
  },
  bulkDeleteTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.1,
    fontWeight: "800",
    color: "var(--text-primary)",
  },
  bulkDeleteSubtitle: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--text-muted)",
    maxWidth: "620px",
  },
  bulkDeleteBody: {
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    background: "var(--modal-bg)",
  },
  bulkDeleteWarningCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    border: "1px solid rgba(239,68,68,0.18)",
    background: "rgba(239,68,68,0.07)",
    borderRadius: "18px",
    padding: "16px 18px",
  },
  bulkDeleteWarningIcon: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.20)",
    color: "var(--danger-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "14px",
    flexShrink: 0,
    lineHeight: 1,
  },
  bulkDeleteWarningTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "var(--danger-text)",
    marginBottom: "6px",
  },
  bulkDeleteWarningText: {
    fontSize: "14px",
    lineHeight: 1.55,
    color: "var(--text-secondary)",
  },
  bulkDeleteSection: {
    border: "1px solid var(--border-soft)",
    background: "var(--surface-1)",
    borderRadius: "20px",
    overflow: "hidden",
  },
  bulkDeleteSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    borderBottom: "1px solid var(--divider)",
    background: "var(--table-header-bg)",
    flexWrap: "wrap",
  },
  bulkDeleteSectionTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  bulkDeleteSectionMeta: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-muted)",
  },
  bulkDeleteListTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
  },
  bulkDeleteFileMetaWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    minWidth: 0,
    flex: 1,
  },
  bulkDeleteFileIndex: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  bulkDeleteFileTextWrap: {
    minWidth: 0,
    flex: 1,
  },
  bulkDeleteMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "10px",
  },
  bulkDeleteMetaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-1)",
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1,
  },
  bulkDeleteStatusWrap: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bulkDeleteConfirmCard: {
    border: "1px solid var(--border-soft)",
    background: "var(--surface-1)",
    borderRadius: "20px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  bulkDeleteConfirmTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "var(--text-primary)",
    marginBottom: "2px",
  },
  deleteConfirmBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  deleteConfirmLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-primary)",
  },
  deleteConfirmInput: {
    width: "100%",
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "14px",
    padding: "13px 14px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  deleteConfirmInputInvalid: {
    borderColor: "rgba(239,68,68,0.42)",
    boxShadow: "0 0 0 3px rgba(239,68,68,0.08)",
  },
  deleteConfirmInputValid: {
    borderColor: "rgba(34,197,94,0.38)",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.08)",
  },
  bulkDeleteConfirmHint: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "var(--text-muted)",
  },
  bulkDeleteFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "18px 28px 24px",
    borderTop: "1px solid var(--divider)",
    background: "var(--surface-1)",
    flexWrap: "wrap",
  },
  bulkDeleteCancelButton: {
    minWidth: "120px",
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--button-border)",
    borderRadius: "14px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.18s ease",
  },
  bulkDeleteConfirmButton: {
    minWidth: "170px",
    background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(239,68,68,0.18)",
    transition: "all 0.18s ease",
  },
  deleteButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
    filter: "saturate(0.75)",
  },
};