import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export default function HistoryPage({
  selectedClinicName,
  conversations = [],
  activeConversationId = "",
  isLoading = false,
  onOpenConversation,
  onNewChat,
  onDeleteConversation,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, pageSize]);

  const summary = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let recentCount = 0;
    let olderCount = 0;

    for (const conversation of conversations) {
      const updatedAt = new Date(conversation.updatedAt || 0);
      if (Number.isNaN(updatedAt.getTime())) continue;

      if (updatedAt >= sevenDaysAgo) {
        recentCount += 1;
      } else {
        olderCount += 1;
      }
    }

    return {
      total: conversations.length,
      recent: recentCount,
      older: olderCount,
      last30Days: conversations.filter((conversation) => {
        const updatedAt = new Date(conversation.updatedAt || 0);
        return (
          !Number.isNaN(updatedAt.getTime()) && updatedAt >= thirtyDaysAgo
        );
      }).length,
    };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    let filtered = conversations.filter((conversation) => {
      if (!searchValue) return true;

      const title = String(conversation.title || "New chat").toLowerCase();
      const preview = String(
        conversation.preview ||
          conversation.lastMessage ||
          conversation.lastUserMessage ||
          ""
      ).toLowerCase();

      return (
        title.includes(searchValue) ||
        preview.includes(searchValue) ||
        String(conversation.messageCount || 0).includes(searchValue)
      );
    });

    filtered.sort((a, b) => {
      const aUpdated = new Date(a.updatedAt || 0).getTime();
      const bUpdated = new Date(b.updatedAt || 0).getTime();

      if (sortBy === "recent") {
        return bUpdated - aUpdated;
      }

      if (sortBy === "oldest") {
        return aUpdated - bUpdated;
      }

      if (sortBy === "title-az") {
        return String(a.title || "New chat").localeCompare(
          String(b.title || "New chat")
        );
      }

      if (sortBy === "title-za") {
        return String(b.title || "New chat").localeCompare(
          String(a.title || "New chat")
        );
      }

      if (sortBy === "messages-high") {
        return (b.messageCount || 0) - (a.messageCount || 0);
      }

      if (sortBy === "messages-low") {
        return (a.messageCount || 0) - (b.messageCount || 0);
      }

      return bUpdated - aUpdated;
    });

    return filtered;
  }, [conversations, searchTerm, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredConversations.length / pageSize)
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedConversations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredConversations.slice(startIndex, startIndex + pageSize);
  }, [filteredConversations, currentPage, pageSize]);

  const hasActiveFilters = searchTerm.trim() !== "" || sortBy !== "recent";

  function handleClearFilters() {
    setSearchTerm("");
    setSortBy("recent");
    setCurrentPage(1);
  }

  async function handleDeleteConversation() {
    if (!deleteTarget || typeof onDeleteConversation !== "function") {
      setDeleteTarget(null);
      return;
    }

    try {
      await onDeleteConversation(deleteTarget.conversationId);
    } finally {
      setDeleteTarget(null);
    }
  }

  const showingFrom =
    filteredConversations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(
    currentPage * pageSize,
    filteredConversations.length
  );

  return (
    <>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>History</h1>
            <p style={styles.subtitle}>
              {selectedClinicName
                ? `Saved chats for ${selectedClinicName}.`
                : "Saved chats for the selected clinic."}
            </p>
          </div>

          <button type="button" style={styles.primaryButton} onClick={onNewChat}>
            New chat
          </button>
        </div>

        <div style={styles.summaryRow}>
          <SummaryCard label="Total Chats" value={String(summary.total)} />
          <SummaryCard label="Recent" value={String(summary.recent)} />
          <SummaryCard label="Older" value={String(summary.older)} />
          <SummaryCard label="Last 30 Days" value={String(summary.last30Days)} />
        </div>

        <div style={styles.filterRow}>
          <input
            type="text"
            placeholder="Search chats..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            style={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="recent">Last updated</option>
            <option value="oldest">Oldest first</option>
            <option value="title-az">Title A–Z</option>
            <option value="title-za">Title Z–A</option>
            <option value="messages-high">Most messages</option>
            <option value="messages-low">Fewest messages</option>
          </select>

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

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderTitle}>Saved conversations</div>
            <div style={styles.cardHeaderMeta}>
              {filteredConversations.length === 0
                ? "No results"
                : `Showing ${showingFrom}-${showingTo} of ${filteredConversations.length}`}
            </div>
          </div>

          {isLoading ? (
            <div style={styles.emptyState}>Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div style={styles.emptyStateWrap}>
              <div style={styles.emptyStateTitle}>No saved chats found</div>
              <div style={styles.emptyStateText}>
                {conversations.length === 0
                  ? "Start a new conversation and it will appear here."
                  : "Try adjusting your search or filters."}
              </div>

              {conversations.length === 0 && (
                <button
                  type="button"
                  style={styles.emptyStateButton}
                  onClick={onNewChat}
                >
                  Start new chat
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={styles.list}>
                {paginatedConversations.map((conversation, index) => {
                  const isActive =
                    conversation.conversationId === activeConversationId;

                  const preview =
                    conversation.preview ||
                    conversation.lastMessage ||
                    conversation.lastUserMessage ||
                    "Open this conversation to continue where you left off.";

                  const isLastRow =
                    index === paginatedConversations.length - 1;

                  return (
                    <div
                      key={conversation.conversationId}
                      style={{
                        ...styles.itemRow,
                        ...(isActive ? styles.itemRowActive : {}),
                        ...(isLastRow ? styles.itemRowLast : {}),
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onOpenConversation?.(conversation.conversationId)
                        }
                        style={styles.itemButton}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background =
                              "var(--table-row-hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <div style={styles.itemTop}>
                          <div style={styles.itemTitleWrap}>
                            <div style={styles.itemTitle}>
                              {conversation.title || "New chat"}
                            </div>
                            {isActive && (
                              <span style={styles.activeBadge}>Open</span>
                            )}
                          </div>

                          <div style={styles.itemTime}>
                            {formatDateTime(conversation.updatedAt)}
                          </div>
                        </div>

                        <div style={styles.itemPreview}>{preview}</div>

                        <div style={styles.itemMetaRow}>
                          <span style={styles.metaPill}>
                            {conversation.messageCount || 0} message
                            {(conversation.messageCount || 0) === 1 ? "" : "s"}
                          </span>

                          <span style={styles.metaPill}>
                            {formatRelativeTime(conversation.updatedAt)}
                          </span>
                        </div>
                      </button>

                      <div style={styles.itemActions}>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() =>
                            onOpenConversation?.(conversation.conversationId)
                          }
                        >
                          Open
                        </button>

                        {typeof onDeleteConversation === "function" && (
                          <button
                            type="button"
                            style={styles.dangerButton}
                            onClick={() => setDeleteTarget(conversation)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={styles.paginationRow}>
                  <div style={styles.paginationInfo}>
                    Page {currentPage} of {totalPages}
                  </div>

                  <div style={styles.paginationActions}>
                    <button
                      type="button"
                      style={styles.paginationButton}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      style={styles.paginationButton}
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Delete conversation?</div>
            <div style={styles.modalText}>
              This will permanently remove{" "}
              <strong>{deleteTarget.title || "this chat"}</strong> from history.
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalSecondaryButton}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={styles.modalDangerButton}
                onClick={handleDeleteConversation}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function formatDateTime(value) {
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

function formatRelativeTime(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const styles = {
  page: {
    width: "100%",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "24px",
    flexWrap: "wrap",
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
  primaryButton: {
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  summaryCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "var(--shadow-soft)",
  },
  summaryLabel: {
    fontSize: "13px",
    color: "var(--text-muted)",
    marginBottom: "8px",
  },
  summaryValue: {
    fontSize: "28px",
    fontWeight: "700",
    color: "var(--text-primary)",
    lineHeight: 1.1,
  },
  filterRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  searchInput: {
    flex: "1 1 280px",
    minWidth: "240px",
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
  },
  select: {
    minWidth: "180px",
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
  },
  clearFiltersButton: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  card: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "var(--shadow-soft)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "18px 20px",
    borderBottom: "1px solid var(--border-strong)",
    background: "var(--table-header-bg)",
    flexWrap: "wrap",
  },
  cardHeaderTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  cardHeaderMeta: {
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  emptyState: {
    padding: "28px",
    color: "var(--text-muted)",
    fontSize: "14px",
  },
  emptyStateWrap: {
    padding: "36px 28px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "10px",
  },
  emptyStateTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  emptyStateText: {
    fontSize: "14px",
    color: "var(--text-muted)",
    maxWidth: "520px",
    lineHeight: 1.5,
  },
  emptyStateButton: {
    marginTop: "6px",
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  list: {
    display: "flex",
    flexDirection: "column",
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "16px",
    padding: "0 20px",
    borderBottom: "1px solid var(--border-strong)",
    alignItems: "stretch",
  },
  itemRowActive: {
    background: "var(--table-header-bg)",
  },
  itemRowLast: {
    borderBottom: "none",
  },
  itemButton: {
    background: "transparent",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    padding: "18px 0",
    color: "var(--text-secondary)",
    transition: "background 0.15s ease",
  },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  itemTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  itemTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  activeBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "700",
    background: "rgba(59,130,246,0.12)",
    color: "var(--accent-solid)",
  },
  itemTime: {
    fontSize: "12px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  itemPreview: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: "10px",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  itemMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    border: "1px solid var(--border-strong)",
    background: "var(--surface-2)",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  itemActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "18px 0",
    flexWrap: "wrap",
  },
  secondaryButton: {
    background: "transparent",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  dangerButton: {
    background: "transparent",
    color: "var(--danger-text)",
    border: "1px solid rgba(239,68,68,0.28)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  paginationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    borderTop: "1px solid var(--border-strong)",
    background: "var(--surface-2)",
    flexWrap: "wrap",
  },
  paginationInfo: {
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  paginationActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  paginationButton: {
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.52)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1400,
    padding: "20px",
  },
  modal: {
    width: "100%",
    maxWidth: "440px",
    background: "var(--modal-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "20px",
    boxShadow: "var(--shadow-strong)",
    padding: "22px",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "var(--text-primary)",
    marginBottom: "10px",
  },
  modalText: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "var(--text-secondary)",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
    flexWrap: "wrap",
  },
  modalSecondaryButton: {
    background: "transparent",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  modalDangerButton: {
    background: "var(--danger-text)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
};