import { useEffect, useMemo, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MainPanel from "./MainPanel";
import { getCurrentUser } from "../../features/users/api/usersApi";
import { listClinics } from "../../features/users/api/clinicsApi";
import LoginPage from "../../features/auth/LoginPage";
import SetPasswordPage from "../../features/auth/SetPasswordPage";
import ClinicSelectorPage from "../../features/clinics/ClinicSelectorPage";
import ProfileModal from "../../features/profile/ProfileModal";
import {
  clearAuthSession,
  clearSelectedClinicId,
  getSelectedClinicId,
  isAuthenticated,
  setSelectedClinicId,
} from "../../features/auth/authStorage";
import {
  appendConversationMessage,
  createConversation,
  getConversationMessages,
  listConversations,
} from "../../features/chat/api/chatApi";

const THEME_STORAGE_KEY = "dbaThemeMode";

function createEmptyClinicChatState() {
  return {
    prompt: "",
    messages: [],
    conversations: [],
    activeConversationId: "",
    isLoadingConversations: false,
    isLoadingMessages: false,
    hasLoaded: false,
  };
}

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialThemeMode() {
  if (typeof window === "undefined") return "system";

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }

  return "system";
}

function isWorkstationAccount(user) {
  return String(user?.accountType || "").toLowerCase() === "workstation";
}

export default function AppShell() {
  const [activeView, setActiveView] = useState("Chat");
  const [currentUser, setCurrentUser] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSelectingClinic, setIsSelectingClinic] = useState(false);
  const [isSwitchingClinic, setIsSwitchingClinic] = useState(false);
  const [mustSetPassword, setMustSetPassword] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [chatStateByClinic, setChatStateByClinic] = useState({});

  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange(event) {
      setSystemTheme(event.matches ? "dark" : "light");
    }

    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      if (!isAuthenticated()) {
        if (isMounted) {
          setCurrentUser(null);
          setClinics([]);
          setChatStateByClinic({});
          setIsCheckingAuth(false);
          setMustSetPassword(false);
        }
        return;
      }

      try {
        const me = await getCurrentUser();
        const clinicList = await listClinics();

        if (!isMounted) return;

        setClinics(clinicList);
        setMustSetPassword(Boolean(me?.mustSetPassword));

        const savedClinicId = getSelectedClinicId();
        const membershipClinicIds = Array.isArray(me?.clinicMemberships)
          ? me.clinicMemberships.map((item) => item.clinicId)
          : [];

        const isOrgAdmin =
          String(me?.organisationPermissionLevel || "").toLowerCase() ===
          "admin";

        const selectableClinics = isOrgAdmin
          ? clinicList
          : clinicList.filter((clinic) =>
              membershipClinicIds.includes(clinic.clinicId)
            );

        const validSavedClinic = selectableClinics.find(
          (clinic) => clinic.clinicId === savedClinicId
        );

        if (validSavedClinic) {
          const nextUser = {
            ...me,
            selectedClinicId: validSavedClinic.clinicId,
          };

          setCurrentUser(nextUser);

          if (!isWorkstationAccount(nextUser) && !me?.mustSetPassword) {
            await loadClinicChatState(validSavedClinic.clinicId);
          }

          setIsCheckingAuth(false);
          return;
        }

        if (selectableClinics.length === 1) {
          const autoClinicId = selectableClinics[0].clinicId;
          setSelectedClinicId(autoClinicId);

          const refreshedMe = await getCurrentUser();

          if (!isMounted) return;

          const nextUser = {
            ...refreshedMe,
            selectedClinicId: autoClinicId,
          };

          setCurrentUser(nextUser);

          if (!isWorkstationAccount(nextUser) && !refreshedMe?.mustSetPassword) {
            await loadClinicChatState(autoClinicId);
          }

          setIsCheckingAuth(false);
          return;
        }

        clearSelectedClinicId();
        setCurrentUser(me);
      } catch {
        clearAuthSession();

        if (isMounted) {
          setCurrentUser(null);
          setClinics([]);
          setChatStateByClinic({});
          setMustSetPassword(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canManageUsers =
      String(currentUser?.organisationPermissionLevel || "").toLowerCase() ===
        "admin" ||
      ["admin", "manage"].includes(
        String(currentUser?.effectivePermissionLevel || "").toLowerCase()
      );

    if (!canManageUsers && activeView === "Users") {
      setActiveView("Chat");
    }
  }, [activeView, currentUser]);

  useEffect(() => {
    const canViewInsights =
      String(currentUser?.organisationPermissionLevel || "").toLowerCase() ===
        "admin" ||
      ["admin", "manage"].includes(
        String(currentUser?.effectivePermissionLevel || "").toLowerCase()
      );

    if (!canViewInsights && activeView === "Insights") {
      setActiveView("Chat");
    }
  }, [activeView, currentUser]);

  useEffect(() => {
    if (isWorkstationAccount(currentUser) && activeView === "History") {
      setActiveView("Chat");
    }
  }, [activeView, currentUser]);

  const selectableClinics = useMemo(() => {
    if (!currentUser) return [];

    const isOrgAdmin =
      String(currentUser?.organisationPermissionLevel || "").toLowerCase() ===
      "admin";

    if (isOrgAdmin) {
      return clinics;
    }

    const membershipClinicIds = Array.isArray(currentUser?.clinicMemberships)
      ? currentUser.clinicMemberships.map((item) => item.clinicId)
      : [];

    return clinics.filter((clinic) =>
      membershipClinicIds.includes(clinic.clinicId)
    );
  }, [clinics, currentUser]);

  const selectedClinicId = currentUser?.selectedClinicId || "";

  const selectedClinicName = useMemo(() => {
    if (!selectedClinicId) return "";

    const match = clinics.find((clinic) => clinic.clinicId === selectedClinicId);
    return match?.name || "";
  }, [clinics, selectedClinicId]);

  const activeClinicChatState = useMemo(() => {
    if (!selectedClinicId) {
      return createEmptyClinicChatState();
    }

    return chatStateByClinic[selectedClinicId] || createEmptyClinicChatState();
  }, [chatStateByClinic, selectedClinicId]);

  function setClinicPrompt(nextPrompt) {
    if (!selectedClinicId) return;

    setChatStateByClinic((prev) => ({
      ...prev,
      [selectedClinicId]: {
        ...(prev[selectedClinicId] || createEmptyClinicChatState()),
        prompt:
          typeof nextPrompt === "function"
            ? nextPrompt(
                (prev[selectedClinicId] || createEmptyClinicChatState()).prompt
              )
            : nextPrompt,
      },
    }));
  }

  function setClinicMessages(nextMessages) {
    if (!selectedClinicId) return;

    setChatStateByClinic((prev) => {
      const currentClinicState =
        prev[selectedClinicId] || createEmptyClinicChatState();

      return {
        ...prev,
        [selectedClinicId]: {
          ...currentClinicState,
          messages:
            typeof nextMessages === "function"
              ? nextMessages(currentClinicState.messages)
              : nextMessages,
        },
      };
    });
  }

  async function loadConversationMessagesForClinic(clinicId, conversationId) {
    if (!clinicId || !conversationId) return;

    setChatStateByClinic((prev) => {
      const existing = prev[clinicId] || createEmptyClinicChatState();

      return {
        ...prev,
        [clinicId]: {
          ...existing,
          isLoadingMessages: true,
        },
      };
    });

    try {
      const data = await getConversationMessages(conversationId);

      setChatStateByClinic((prev) => {
        const existing = prev[clinicId] || createEmptyClinicChatState();

        return {
          ...prev,
          [clinicId]: {
            ...existing,
            activeConversationId: conversationId,
            messages: Array.isArray(data?.messages)
              ? data.messages.map((item) => ({
                  role: item.role,
                  content: item.content,
                  sourceJson: item.sourceJson || null,
                  createdAt: item.createdAt,
                }))
              : [],
            isLoadingMessages: false,
            hasLoaded: true,
          },
        };
      });
    } catch (error) {
      setChatStateByClinic((prev) => {
        const existing = prev[clinicId] || createEmptyClinicChatState();

        return {
          ...prev,
          [clinicId]: {
            ...existing,
            activeConversationId: "",
            messages: [],
            isLoadingMessages: false,
            hasLoaded: true,
          },
        };
      });

      throw error;
    }
  }

  async function loadClinicChatState(clinicId) {
    if (!clinicId || isWorkstationAccount(currentUser)) return;

    setChatStateByClinic((prev) => {
      const existing = prev[clinicId] || createEmptyClinicChatState();

      return {
        ...prev,
        [clinicId]: {
          ...existing,
          isLoadingConversations: true,
        },
      };
    });

    try {
      const conversations = await listConversations();

      if (conversations.length === 0) {
        setChatStateByClinic((prev) => {
          const existing = prev[clinicId] || createEmptyClinicChatState();

          return {
            ...prev,
            [clinicId]: {
              ...existing,
              conversations: [],
              activeConversationId: "",
              messages: [],
              isLoadingConversations: false,
              isLoadingMessages: false,
              hasLoaded: true,
            },
          };
        });

        return;
      }

      const firstConversation = conversations[0];
      const messageData = await getConversationMessages(
        firstConversation.conversationId
      );

      setChatStateByClinic((prev) => {
        const existing = prev[clinicId] || createEmptyClinicChatState();

        return {
          ...prev,
          [clinicId]: {
            ...existing,
            conversations,
            activeConversationId: firstConversation.conversationId,
            messages: Array.isArray(messageData?.messages)
              ? messageData.messages.map((item) => ({
                  role: item.role,
                  content: item.content,
                  sourceJson: item.sourceJson || null,
                  createdAt: item.createdAt,
                }))
              : [],
            isLoadingConversations: false,
            isLoadingMessages: false,
            hasLoaded: true,
          },
        };
      });
    } catch {
      setChatStateByClinic((prev) => {
        const existing = prev[clinicId] || createEmptyClinicChatState();

        return {
          ...prev,
          [clinicId]: {
            ...existing,
            conversations: [],
            activeConversationId: "",
            messages: [],
            isLoadingConversations: false,
            isLoadingMessages: false,
            hasLoaded: true,
          },
        };
      });
    }
  }

  async function handleCreateConversation(initialTitle = "New chat") {
    if (!selectedClinicId || isWorkstationAccount(currentUser)) return null;

    const created = await createConversation({
      title: initialTitle,
    });

    setChatStateByClinic((prev) => {
      const existing = prev[selectedClinicId] || createEmptyClinicChatState();

      return {
        ...prev,
        [selectedClinicId]: {
          ...existing,
          activeConversationId: created.conversationId,
          conversations: [created, ...existing.conversations],
        },
      };
    });

    return created;
  }

  async function handleOpenConversation(conversationId) {
    if (
      !selectedClinicId ||
      !conversationId ||
      isWorkstationAccount(currentUser)
    ) {
      return;
    }

    await loadConversationMessagesForClinic(selectedClinicId, conversationId);
    setActiveView("Chat");
  }

  async function handlePersistConversationMessage(
    conversationId,
    role,
    content,
    sourceJson = null
  ) {
    if (
      !selectedClinicId ||
      !conversationId ||
      isWorkstationAccount(currentUser)
    ) {
      return null;
    }

    const savedMessage = await appendConversationMessage(conversationId, {
      role,
      content,
      sourceJson,
    });

    setChatStateByClinic((prev) => {
      const existing = prev[selectedClinicId] || createEmptyClinicChatState();

      const updatedConversations = [...existing.conversations];
      const conversationIndex = updatedConversations.findIndex(
        (item) => item.conversationId === conversationId
      );

      if (conversationIndex >= 0) {
        const updatedConversation = {
          ...updatedConversations[conversationIndex],
          updatedAt: new Date().toISOString(),
          title:
            role === "user" &&
            (!updatedConversations[conversationIndex].title ||
              updatedConversations[conversationIndex].title === "New chat")
              ? content.slice(0, 80)
              : updatedConversations[conversationIndex].title,
        };

        updatedConversations.splice(conversationIndex, 1);
        updatedConversations.unshift(updatedConversation);
      }

      return {
        ...prev,
        [selectedClinicId]: {
          ...existing,
          conversations: updatedConversations,
        },
      };
    });

    return savedMessage;
  }

  function handleNewChat() {
    if (!selectedClinicId) return;

    setChatStateByClinic((prev) => {
      const existing = prev[selectedClinicId] || createEmptyClinicChatState();

      return {
        ...prev,
        [selectedClinicId]: {
          ...existing,
          activeConversationId: "",
          messages: [],
          prompt: "",
        },
      };
    });

    setActiveView("Chat");
  }

  async function handleLoginSuccess(loginResult) {
    setIsCheckingAuth(true);

    try {
      setMustSetPassword(Boolean(loginResult?.mustSetPassword));

      const me = loginResult?.user || (await getCurrentUser());
      const clinicList = await listClinics();

      setClinics(clinicList);
      setCurrentUser(me);

      const isOrgAdmin =
        String(me?.organisationPermissionLevel || "").toLowerCase() === "admin";

      const membershipClinicIds = Array.isArray(me?.clinicMemberships)
        ? me.clinicMemberships.map((item) => item.clinicId)
        : [];

      const availableClinics = isOrgAdmin
        ? clinicList
        : clinicList.filter((clinic) =>
            membershipClinicIds.includes(clinic.clinicId)
          );

      if (availableClinics.length === 1) {
        const autoClinicId = availableClinics[0].clinicId;
        setSelectedClinicId(autoClinicId);

        const refreshedMe = await getCurrentUser();

        const nextUser = {
          ...refreshedMe,
          selectedClinicId: autoClinicId,
        };

        setCurrentUser(nextUser);

        if (!loginResult?.mustSetPassword && !isWorkstationAccount(nextUser)) {
          await loadClinicChatState(autoClinicId);
        }
      } else {
        clearSelectedClinicId();
        setCurrentUser(me);
      }
    } catch {
      clearAuthSession();
      setCurrentUser(null);
      setClinics([]);
      setChatStateByClinic({});
      setMustSetPassword(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }

  async function handlePasswordSetComplete() {
    try {
      const me = await getCurrentUser();
      setMustSetPassword(false);
      setCurrentUser((prev) => ({
        ...(prev || {}),
        ...me,
      }));
    } catch {
      clearAuthSession();
      setCurrentUser(null);
      setClinics([]);
      setChatStateByClinic({});
      setMustSetPassword(false);
    }
  }

  async function handleSelectClinic(clinic) {
    if (!clinic?.clinicId) return;

    setIsSelectingClinic(true);

    try {
      setSelectedClinicId(clinic.clinicId);
      const refreshedMe = await getCurrentUser();

      const nextUser = {
        ...refreshedMe,
        selectedClinicId: clinic.clinicId,
      };

      setCurrentUser(nextUser);

      if (!mustSetPassword && !isWorkstationAccount(nextUser)) {
        await loadClinicChatState(clinic.clinicId);
      }

      setActiveView("Chat");
      setIsSwitchingClinic(false);
    } catch {
      clearSelectedClinicId();
    } finally {
      setIsSelectingClinic(false);
    }
  }

  function handleOpenProfile() {
    setIsProfileOpen(true);
  }

  function handleOpenAppearance() {
    setActiveView("Settings");
  }

  function handleSignOut() {
    clearAuthSession();
    setCurrentUser(null);
    setClinics([]);
    setChatStateByClinic({});
    setActiveView("Chat");
    setIsSwitchingClinic(false);
    setMustSetPassword(false);
    setIsProfileOpen(false);
  }

  if (isCheckingAuth) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (mustSetPassword) {
    return (
      <SetPasswordPage
        email={currentUser?.email || ""}
        onPasswordSet={handlePasswordSetComplete}
      />
    );
  }

  if (!currentUser.selectedClinicId || isSwitchingClinic) {
    return (
      <ClinicSelectorPage
        currentUser={currentUser}
        clinics={selectableClinics}
        onSelectClinic={handleSelectClinic}
        isLoading={isSelectingClinic}
      />
    );
  }

  return (
    <div style={styles.app}>
      <Header
        currentUser={currentUser}
        selectedClinicName={selectedClinicName}
        clinics={selectableClinics}
        onSelectClinic={handleSelectClinic}
        onSignOut={handleSignOut}
        onOpenProfile={handleOpenProfile}
        onOpenAppearance={handleOpenAppearance}
      />

      <div style={styles.body} className="dba-scroll">
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          currentUser={currentUser}
        />

        <MainPanel
          activeView={activeView}
          selectedClinicId={selectedClinicId}
          selectedClinicName={selectedClinicName}
          messages={activeClinicChatState.messages}
          prompt={activeClinicChatState.prompt}
          setPrompt={setClinicPrompt}
          setMessages={setClinicMessages}
          onNewChat={handleNewChat}
          conversations={activeClinicChatState.conversations}
          activeConversationId={activeClinicChatState.activeConversationId}
          isLoadingConversations={activeClinicChatState.isLoadingConversations}
          isLoadingMessages={activeClinicChatState.isLoadingMessages}
          onOpenConversation={handleOpenConversation}
          onCreateConversation={handleCreateConversation}
          onPersistConversationMessage={handlePersistConversationMessage}
          onOpenAppearance={handleOpenAppearance}
          themeMode={themeMode}
          resolvedTheme={resolvedTheme}
          onThemeChange={setThemeMode}
          currentUser={currentUser}
        />
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        clinics={clinics}
      />
    </div>
  );
}

const styles = {
  app: {
    height: "100vh",
    width: "100vw",
    background: "var(--app-bg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "var(--text-primary)",
    transition: "background 160ms ease, color 160ms ease",
  },
  body: {
    flex: 1,
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
  },
  loadingPage: {
    minHeight: "100vh",
    background: "var(--app-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    transition: "background 160ms ease",
  },
  loadingCard: {
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    borderRadius: "16px",
    padding: "24px 28px",
    boxShadow: "var(--shadow-soft)",
  },
};