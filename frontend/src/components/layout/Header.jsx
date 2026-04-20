import { useEffect, useRef, useState } from "react";

export default function Header({
  currentUser,
  selectedClinicName,
  clinics = [],
  onSignOut,
  onSelectClinic,
  onOpenProfile,
  onOpenAppearance,
}) {
  const [isClinicMenuOpen, setIsClinicMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const clinicMenuRef = useRef(null);
  const accountMenuRef = useRef(null);

  const accountType = String(currentUser?.accountType || "").toLowerCase();
  const isWorkstation = accountType === "workstation";

  const identityLabel = isWorkstation
    ? currentUser?.username || "Workstation account"
    : currentUser?.email || "user@example.com";

  const accountSubtext = isWorkstation ? "Workstation" : "Account";

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        clinicMenuRef.current &&
        !clinicMenuRef.current.contains(event.target)
      ) {
        setIsClinicMenuOpen(false);
      }

      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsClinicMenuOpen(false);
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleClinicSelect(clinic) {
    setIsClinicMenuOpen(false);
    onSelectClinic?.(clinic);
  }

  function handleAccountAction(action) {
    setIsAccountMenuOpen(false);

    if (action === "profile") {
      onOpenProfile?.();
      return;
    }

    if (action === "appearance") {
      onOpenAppearance?.();
      return;
    }

    if (action === "signout") {
      onSignOut?.();
    }
  }

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <span style={styles.logo}>🦷</span>
        <span style={styles.title}>Dental Buddy AI</span>
      </div>

      <div style={styles.right}>
        <div style={styles.clinicSwitcherWrap} ref={clinicMenuRef}>
          <button
            type="button"
            onClick={() => setIsClinicMenuOpen((prev) => !prev)}
            style={styles.clinicSwitcherButton}
          >
            <span style={styles.workspace}>
              {selectedClinicName || "Select clinic"}
            </span>
            <span style={styles.chevron}>▾</span>
          </button>

          {isClinicMenuOpen && (
            <div style={styles.clinicMenu}>
              {clinics.length === 0 ? (
                <div style={styles.emptyMenuItem}>No clinics available</div>
              ) : (
                clinics.map((clinic) => {
                  const isSelected = clinic.name === selectedClinicName;

                  return (
                    <button
                      key={clinic.clinicId}
                      type="button"
                      onClick={() => handleClinicSelect(clinic)}
                      style={{
                        ...styles.clinicMenuItem,
                        ...(isSelected ? styles.clinicMenuItemActive : {}),
                      }}
                    >
                      {clinic.name}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div style={styles.accountWrap} ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setIsAccountMenuOpen((prev) => !prev)}
            style={styles.accountChip}
          >
            <span style={styles.avatar}>
              {getInitials(currentUser?.displayName || "User")}
            </span>

            <span style={styles.accountText}>
              <span style={styles.accountName}>
                {currentUser?.displayName || "User"}
              </span>
              <span style={styles.accountSubtext}>{accountSubtext}</span>
            </span>

            <span style={styles.chevron}>▾</span>
          </button>

          {isAccountMenuOpen && (
            <div style={styles.accountMenu}>
              <div style={styles.accountMenuHeader}>
                <div style={styles.accountMenuAvatar}>
                  {getInitials(currentUser?.displayName || "User")}
                </div>

                <div style={styles.accountMenuIdentity}>
                  <div style={styles.accountMenuName}>
                    {currentUser?.displayName || "User"}
                  </div>
                  <div style={styles.accountMenuEmail}>{identityLabel}</div>
                </div>
              </div>

              <div style={styles.menuDivider} />

              <button
                type="button"
                style={styles.accountMenuItem}
                onClick={() => handleAccountAction("profile")}
              >
                Profile
              </button>

              <button
                type="button"
                style={styles.accountMenuItem}
                onClick={() => handleAccountAction("appearance")}
              >
                Theme
              </button>

              <div style={styles.menuDivider} />

              <button
                type="button"
                style={styles.accountMenuDanger}
                onClick={() => handleAccountAction("signout")}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

const styles = {
  header: {
    position: "relative",
    zIndex: 200,
    height: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    borderBottom: "1px solid var(--border-subtle)",
    background: "var(--header-bg)",
    color: "var(--text-primary)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
    boxShadow: "0 1px 0 rgba(255,255,255,0.35) inset",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  logo: {
    fontSize: "24px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text-primary)",
  },
  clinicSwitcherWrap: {
    position: "relative",
  },
  clinicSwitcherButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-1)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  workspace: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  chevron: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  clinicMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: "240px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "14px",
    boxShadow: "var(--shadow-strong)",
    padding: "8px",
    zIndex: 1000,
  },
  clinicMenuItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background 160ms ease, color 160ms ease",
  },
  clinicMenuItemActive: {
    background: "var(--surface-3)",
    color: "var(--text-primary)",
    fontWeight: "600",
  },
  emptyMenuItem: {
    padding: "10px 12px",
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  accountWrap: {
    position: "relative",
  },
  accountChip: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 10px 6px 6px",
    borderRadius: "14px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-1)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  avatar: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    background: "var(--avatar-bg)",
    border: "1px solid var(--avatar-border)",
    color: "var(--avatar-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  accountText: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
  },
  accountName: {
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: 1.2,
  },
  accountSubtext: {
    color: "var(--text-muted)",
    fontSize: "11px",
    lineHeight: 1.2,
  },
  accountMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: "280px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-strong)",
    borderRadius: "16px",
    boxShadow: "var(--shadow-strong)",
    padding: "10px",
    zIndex: 1100,
  },
  accountMenuHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 8px 10px 8px",
  },
  accountMenuAvatar: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    background: "var(--avatar-bg)",
    border: "1px solid var(--avatar-border)",
    color: "var(--avatar-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    flexShrink: 0,
  },
  accountMenuIdentity: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  accountMenuName: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
  },
  accountMenuEmail: {
    color: "var(--text-muted)",
    fontSize: "12px",
    wordBreak: "break-word",
  },
  menuDivider: {
    height: "1px",
    background: "var(--divider)",
    margin: "6px 0",
  },
  accountMenuItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background 160ms ease, color 160ms ease",
  },
  accountMenuDanger: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "var(--danger-text)",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background 160ms ease, color 160ms ease",
  },
};