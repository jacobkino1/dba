import { useEffect, useMemo, useRef } from "react";
import EmptyState from "../../features/chat/EmptyState";
import ChatComposer from "../../features/chat/ChatComposer";
import MessageList from "../../features/chat/MessageList";
import HistoryPage from "../../features/chat/HistoryPage";
import InsightsPage from "../../features/chat/InsightsPage";
import ClinicDocsPage from "../../features/docs/ClinicDocsPage";
import UserManagementPage from "../../features/users/UserManagementPage";
import SettingsPage from "../../features/settings/SettingsPage";

const SOFT_WARNING_THRESHOLD = 10;
const STRONG_WARNING_THRESHOLD = 20;

function isWorkstationAccount(user) {
  return String(user?.accountType || "").toLowerCase() === "workstation";
}

export default function MainPanel({
  activeView,
  selectedClinicId,
  selectedClinicName,
  messages,
  prompt,
  setPrompt,
  setMessages,
  onNewChat,
  conversations,
  activeConversationId,
  isLoadingConversations,
  isLoadingMessages,
  onOpenConversation,
  onCreateConversation,
  onPersistConversationMessage,
  onOpenAppearance,
  themeMode,
  resolvedTheme,
  onThemeChange,
  currentUser,
}) {
  const contentRef = useRef(null);

  const hasMessages = Array.isArray(messages) && messages.length > 0;
  const isChatView = activeView === "Chat";
  const isWorkstation = isWorkstationAccount(currentUser);

  const userQuestionCount = useMemo(() => {
    return Array.isArray(messages)
      ? messages.filter((message) => message.role === "user").length
      : 0;
  }, [messages]);

  const chatLengthState = useMemo(() => {
    if (userQuestionCount >= STRONG_WARNING_THRESHOLD) {
      return "strong";
    }

    if (userQuestionCount >= SOFT_WARNING_THRESHOLD) {
      return "soft";
    }

    return "none";
  }, [userQuestionCount]);

  useEffect(() => {
    if (!isChatView) return;

    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isChatView, selectedClinicId]);

  if (activeView === "History" && isWorkstation) {
    return (
      <main style={styles.main}>
        <div style={styles.placeholderArea}>
          <div style={styles.placeholderCard}>
            <h2 style={styles.placeholderTitle}>History</h2>
            <p style={styles.placeholderText}>
              Workstation accounts do not keep personal chat history.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      {isChatView ? (
        <>
          <div style={styles.chatTopBar}>
            <div>
              <div style={styles.chatTopBarLabel}>Chatting in</div>
              <div style={styles.chatTopBarClinic}>
                {selectedClinicName || "Selected clinic"}
              </div>
            </div>

            {!isWorkstation ? (
              <button
                type="button"
                style={styles.newChatButton}
                onClick={onNewChat}
              >
                New chat
              </button>
            ) : null}
          </div>

          <div ref={contentRef} style={styles.contentArea} className="dba-scroll">
            {isLoadingMessages ? (
              <div style={styles.loadingCard}>Loading conversation...</div>
            ) : (
              <>
                {!isWorkstation && chatLengthState !== "none" ? (
                  <ChatLengthBanner
                    variant={chatLengthState}
                    userQuestionCount={userQuestionCount}
                    onNewChat={onNewChat}
                  />
                ) : null}

                {!hasMessages ? (
                  <EmptyState
                    setPrompt={setPrompt}
                    selectedClinicName={selectedClinicName}
                  />
                ) : (
                  <MessageList messages={messages} />
                )}
              </>
            )}
          </div>

          <div style={styles.composerArea}>
            <ChatComposer
              key={selectedClinicId || "no-clinic"}
              prompt={prompt}
              setPrompt={setPrompt}
              setMessages={setMessages}
              selectedClinicName={selectedClinicName}
              activeConversationId={isWorkstation ? "" : activeConversationId}
              onCreateConversation={isWorkstation ? undefined : onCreateConversation}
              onPersistConversationMessage={
                isWorkstation ? undefined : onPersistConversationMessage
              }
            />
          </div>
        </>
      ) : activeView === "History" ? (
        <div style={styles.pageArea} className="dba-scroll">
          <HistoryPage
            selectedClinicName={selectedClinicName}
            conversations={conversations}
            activeConversationId={activeConversationId}
            isLoading={isLoadingConversations}
            onOpenConversation={onOpenConversation}
            onNewChat={onNewChat}
          />
        </div>
      ) : activeView === "Insights" ? (
        <div style={styles.pageArea} className="dba-scroll">
          <InsightsPage selectedClinicName={selectedClinicName} />
        </div>
      ) : activeView === "Clinic Docs" ? (
        <div style={styles.pageArea} className="dba-scroll">
          <ClinicDocsPage />
        </div>
      ) : activeView === "Users" ? (
        <div style={styles.pageArea} className="dba-scroll">
          <UserManagementPage />
        </div>
      ) : activeView === "Settings" ? (
        <div style={styles.pageArea} className="dba-scroll">
          <SettingsPage
            onOpenAppearance={onOpenAppearance}
            themeMode={themeMode}
            resolvedTheme={resolvedTheme}
            onThemeChange={onThemeChange}
            accessLevel={
              String(currentUser?.organisationPermissionLevel || "").toLowerCase() === "admin"
                ? "admin"
                : currentUser?.effectivePermissionLevel || "read"
            }
            scopeLevel={
              ["admin", "manage"].includes(
                String(currentUser?.organisationPermissionLevel || "").toLowerCase()
              )
                ? "org"
                : "clinic"
            }
            clinicName={selectedClinicName || "Current Clinic"}
            organisationName={currentUser?.organisationName || "Your Organisation"}
          />
        </div>
      ) : (
        <div style={styles.placeholderArea}>
          <div style={styles.placeholderCard}>
            <h2 style={styles.placeholderTitle}>{activeView}</h2>
            <p style={styles.placeholderText}>
              This section is not built yet.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function ChatLengthBanner({ variant, userQuestionCount, onNewChat }) {
  const isStrong = variant === "strong";

  return (
    <div
      style={{
        ...styles.banner,
        ...(isStrong ? styles.bannerStrong : styles.bannerSoft),
      }}
    >
      <div style={styles.bannerContent}>
        <div style={styles.bannerTitle}>
          {isStrong
            ? "This conversation is getting long"
            : "This conversation is building up"}
        </div>

        <div style={styles.bannerText}>
          {isStrong
            ? `This chat already has ${userQuestionCount} questions. Starting a new chat will usually give cleaner answers for a new topic.`
            : `This chat has ${userQuestionCount} questions so far. For best results, start a new chat when you move to a different topic.`}
        </div>
      </div>

      <button type="button" style={styles.bannerButton} onClick={onNewChat}>
        Start new chat
      </button>
    </div>
  );
}

const styles = {
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    background: "var(--app-bg)",
    color: "var(--text-primary)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    transition: "background 160ms ease, color 160ms ease",
  },
  chatTopBar: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "24px 56px 0 56px",
    boxSizing: "border-box",
  },
  chatTopBarLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  chatTopBarClinic: {
    marginTop: "4px",
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
  },
  newChatButton: {
    background: "var(--surface-1)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  contentArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "28px 56px 24px 56px",
    boxSizing: "border-box",
  },
  composerArea: {
    flexShrink: 0,
    padding: "0 56px 24px 56px",
    boxSizing: "border-box",
    background: "var(--app-bg)",
    transition: "background 160ms ease",
  },
  pageArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "32px 40px",
    boxSizing: "border-box",
  },
  loadingCard: {
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "16px",
    padding: "18px 20px",
    color: "var(--text-secondary)",
    fontSize: "14px",
    boxShadow: "var(--shadow-soft)",
  },
  banner: {
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto 20px auto",
    borderRadius: "16px",
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    boxSizing: "border-box",
  },
  bannerSoft: {
    background: "var(--banner-soft-bg)",
    border: "1px solid var(--banner-soft-border)",
  },
  bannerStrong: {
    background: "var(--banner-strong-bg)",
    border: "1px solid var(--banner-strong-border)",
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  bannerText: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  bannerButton: {
    background: "var(--surface-2)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  placeholderArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
    boxSizing: "border-box",
  },
  placeholderCard: {
    width: "100%",
    maxWidth: "560px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "var(--shadow-soft)",
  },
  placeholderTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  placeholderText: {
    marginTop: "10px",
    color: "var(--text-muted)",
    fontSize: "15px",
  },
};