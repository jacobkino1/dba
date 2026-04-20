import { useMemo, useState } from "react";
import NetworkingModal from "./NetworkingModal";


const THEME_OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Use the light theme across Dental Buddy AI.",
    icon: "☀️",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the dark theme across Dental Buddy AI.",
    icon: "🌙",
  },
  {
    value: "system",
    label: "System",
    description: "Match your device or browser appearance automatically.",
    icon: "💻",
  },
];


export default function SettingsPage({
  onOpenAppearance,
  themeMode = "system",
  resolvedTheme = "dark",
  onThemeChange,
  accessLevel = "read",
  scopeLevel = "clinic",
  clinicName = "Current Clinic",
  organisationName = "Your Organisation",
}) {
  console.log("Settings accessLevel:", accessLevel);
  console.log("Settings scopeLevel:", scopeLevel);
  
  const [activeLegalModal, setActiveLegalModal] = useState("");
  const [activeSection, setActiveSection] = useState("appearance");

  const normalizedAccess = String(accessLevel || "").toLowerCase();
  const canAccessNetworking =
    normalizedAccess === "admin" || normalizedAccess === "manage";


  const navItems = useMemo(() => {
    const items = [
      {
        key: "general",
        label: "General",
        icon: "⚙️",
      },
      {
        key: "appearance",
        label: "Appearance",
        icon: "🎨",
      },
    ];

    if (canAccessNetworking) {
      items.push({
        key: "networking",
        label: "Networking",
        icon: "🌐",
      });
    }

    items.push({
      key: "about",
      label: "About",
      icon: "ℹ️",
    });

    return items;
  }, [canAccessNetworking]);

  const currentThemeLabel =
    themeMode === "system"
      ? `System (${resolvedTheme === "dark" ? "Dark" : "Light"} active)`
      : themeMode === "dark"
      ? "Dark"
      : "Light";

  const activeNavItem =
    navItems.find((item) => item.key === activeSection) || navItems[0];

  function openLegalModal(type) {
    setActiveLegalModal(type);
  }

  function closeLegalModal() {
    setActiveLegalModal("");
  }

  function renderSection() {
    if (activeSection === "general") {
      return (
        <GeneralSection
          accessLevel={accessLevel}
          scopeLevel={scopeLevel}
          clinicName={clinicName}
          organisationName={organisationName}
        />
      );
    }

    if (activeSection === "appearance") {
      return (
        <AppearanceSection
          currentThemeLabel={currentThemeLabel}
          resolvedTheme={resolvedTheme}
          themeMode={themeMode}
          onThemeChange={onThemeChange}
        />
      );
    }

    if (activeSection === "networking" && canAccessNetworking) {
      return (
        <NetworkingModal
          accessLevel={accessLevel}
          scopeLevel={scopeLevel}
          clinicName={clinicName}
          organisationName={organisationName}
        />
      );
    }

    return <AboutSection onOpenLegalModal={openLegalModal} />;
  }

  return (
    <>
      <div style={styles.page}>
        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <div style={styles.sidebarTitle}>Settings</div>
            <div style={styles.navList}>
              {navItems.map((item) => {
                const isActive = item.key === activeSection;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    style={{
                      ...styles.navButton,
                      ...(isActive ? styles.navButtonActive : {}),
                    }}
                  >
                    <span style={styles.navIcon}>{item.icon}</span>
                    <span style={styles.navLabel}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main style={styles.content}>
            <div style={styles.contentHeader}>
              <div style={styles.eyebrow}>Settings</div>
              <h1 style={styles.title}>{activeNavItem.label}</h1>
              <p style={styles.subtitle}>
                {getSectionSubtitle(activeNavItem.key)}
              </p>
            </div>

            <div style={styles.sectionWrap}>{renderSection()}</div>
          </main>
        </div>
      </div>

      {activeLegalModal === "privacy" && (
        <LegalModal
          title="Privacy Policy"
          subtitle="Current privacy information for Dental Buddy AI."
          onClose={closeLegalModal}
        >
          <div style={styles.legalContent}>
            <p style={styles.legalParagraph}>
              Dental Buddy AI is designed to assist clinic teams using
              organisation-approved documents, workflows, and settings.
            </p>

            <p style={styles.legalParagraph}>
              Clinics are responsible for the documents, policies, and
              information made available within their workspace.
            </p>

            <p style={styles.legalParagraph}>
              Users should only access and use information within Dental Buddy AI
              in line with their organisation’s internal privacy, security, and
              operational policies.
            </p>

            <p style={styles.legalParagraph}>
              This in-app privacy summary is a placeholder for the full hosted
              Privacy Policy that can be added later.
            </p>
          </div>
        </LegalModal>
      )}

      {activeLegalModal === "terms" && (
        <LegalModal
          title="Terms of Use"
          subtitle="Current terms for using Dental Buddy AI."
          onClose={closeLegalModal}
        >
          <div style={styles.legalContent}>
            <p style={styles.legalParagraph}>
              Dental Buddy AI must be used in accordance with your
              organisation’s approved processes, permissions, and clinical
              governance requirements.
            </p>

            <p style={styles.legalParagraph}>
              Users are responsible for reviewing answers carefully and
              following internal clinic procedures where required.
            </p>

            <p style={styles.legalParagraph}>
              Access to documents, chats, and features may vary based on role,
              clinic access, and organisation settings.
            </p>

            <p style={styles.legalParagraph}>
              This in-app terms summary is a placeholder for the full hosted
              Terms of Use that can be added later.
            </p>
          </div>
        </LegalModal>
      )}
    </>
  );
}

function GeneralSection({
  accessLevel,
  scopeLevel,
  clinicName,
  organisationName,
}) {
  const isOrgScope = String(scopeLevel).toLowerCase() === "org";

  return (
    <div style={styles.sectionGrid}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Workspace</h2>
          <p style={styles.cardSubtitle}>
            Your current access scope inside Dental Buddy AI.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.infoList}>
            <InfoRow
              label="Access level"
              value={formatAccessLabel(accessLevel)}
            />
            <InfoRow
              label="Scope"
              value={isOrgScope ? "Organisation level" : "Clinic level"}
            />
            <InfoRow
              label={isOrgScope ? "Organisation" : "Clinic"}
              value={isOrgScope ? organisationName : clinicName}
            />
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>General settings</h2>
          <p style={styles.cardSubtitle}>
            This section is ready for future workspace settings.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.helperBox}>
            More general settings can be added here later.
          </div>
        </div>
      </section>
    </div>
  );
}

function AppearanceSection({
  currentThemeLabel,
  resolvedTheme,
  themeMode,
  onThemeChange,
}) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Appearance</h2>
        <p style={styles.cardSubtitle}>
          Control how Dental Buddy AI looks and feels.
        </p>
      </div>

      <div style={styles.cardBody}>
        <div style={styles.featureRowTop}>
          <div>
            <div style={styles.featureTitle}>Current theme</div>
            <div style={styles.featureText}>{currentThemeLabel}</div>
          </div>

          <div style={styles.themeBadge}>
            {resolvedTheme === "dark" ? "Dark active" : "Light active"}
          </div>
        </div>

        <div style={styles.themeOptionList}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = themeMode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onThemeChange?.(option.value)}
                style={{
                  ...styles.themeOption,
                  ...(isSelected ? styles.themeOptionActive : {}),
                }}
              >
                <div style={styles.themeOptionLeft}>
                  <div style={styles.themeOptionIcon}>{option.icon}</div>

                  <div>
                    <div style={styles.themeOptionTitle}>{option.label}</div>
                    <div style={styles.themeOptionText}>
                      {option.description}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    ...styles.radioPill,
                    ...(isSelected ? styles.radioPillActive : {}),
                  }}
                >
                  {isSelected ? "Selected" : "Choose"}
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
}

function NetworkingSection({
  accessLevel,
  scopeLevel,
  clinicName,
  organisationName,
}) {
  const isOrgScope = String(scopeLevel).toLowerCase() === "org";
  const normalizedAccess = String(accessLevel || "").toLowerCase();

  return (
    <div style={styles.sectionGrid}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Allowed IP Addresses</h2>
          <p style={styles.cardSubtitle}>
            Restrict access to DBA to approved clinic or organisation networks.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.modeCardActive}>
            <div style={styles.modeTitle}>Allow public access</div>
            <div style={styles.modeText}>
              Users can access DBA from any network after signing in.
            </div>
            <div style={styles.choiceBadge}>Default</div>
          </div>

          <div style={styles.modeCard}>
            <div style={styles.modeTitle}>Restrict to allowed IP addresses</div>
            <div style={styles.modeText}>
              Only approved IP addresses or CIDR ranges can access DBA.
            </div>
          </div>

          <div style={styles.helperText}>
            This section is ready for the real IP restriction feature next.
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Access scope</h2>
          <p style={styles.cardSubtitle}>
            What this user should be able to manage in Networking.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.infoList}>
            <InfoRow
              label="Permission level"
              value={formatAccessLabel(accessLevel)}
            />
            <InfoRow
              label="View type"
              value={
                isOrgScope ? "Organisation-wide clinic view" : "Single clinic view"
              }
            />
            <InfoRow
              label="Target"
              value={isOrgScope ? organisationName : clinicName}
            />
          </div>

          <div style={styles.helperBox}>
            {normalizedAccess === "admin" &&
              "Admin can manage organisation defaults and clinic-level rules."}
            {normalizedAccess === "manage" && isOrgScope &&
              "Organisation Manage can maintain clinic-level allowed IP rules across all clinics."}
            {normalizedAccess === "manage" && !isOrgScope &&
              "Clinic Manage can maintain allowed IP rules only for their clinic."}
          </div>
        </div>
      </section>
    </div>
  );
}

function AboutSection({ onOpenLegalModal }) {
  return (
    <div style={styles.sectionGrid}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>About Dental Buddy AI</h2>
          <p style={styles.cardSubtitle}>
            A quick overview of what this app is for.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.aboutLead}>
            Dental Buddy AI helps clinics find answers from their own documents.
          </div>

          <div style={styles.aboutText}>
            It is designed to support faster, more consistent access to clinic
            policies, procedures, and internal guidance across the workspace.
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Legal</h2>
          <p style={styles.cardSubtitle}>
            Review key legal and privacy information for this app.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.buttonGroup}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => onOpenLegalModal("privacy")}
            >
              View Privacy Policy
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => onOpenLegalModal("terms")}
            >
              View Terms of Use
            </button>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Version & Support</h2>
          <p style={styles.cardSubtitle}>
            Product details and support guidance.
          </p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.infoList}>
            <InfoRow label="Version" value="MVP" />
            <InfoRow
              label="Support"
              value="Contact your DBA administrator, practice manager, or clinic owner for support."
              multiline
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, multiline = false }) {
  return (
    <div style={styles.infoRow}>
      <div style={styles.infoLabel}>{label}</div>
      <div
        style={{
          ...styles.infoValue,
          ...(multiline ? styles.infoValueMultiline : {}),
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LegalModal({ title, subtitle, children, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{title}</h2>
            <p style={styles.modalSubtitle}>{subtitle}</p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.modalBody} className="dba-scroll">
          {children}
        </div>

        <div style={styles.modalFooter}>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getSectionSubtitle(sectionKey) {
  if (sectionKey === "general") {
    return "Workspace and account-related settings.";
  }

  if (sectionKey === "appearance") {
    return "Theme and display preferences.";
  }

  if (sectionKey === "networking") {
    return "Allowed IP addresses and network access.";
  }

  return "Product, legal, version, and support information.";
}

function formatAccessLabel(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "admin") return "Admin";
  if (normalized === "manage") return "Manage";
  if (normalized === "write") return "Write";
  if (normalized === "read") return "Read";

  return value || "Unknown";
}

const styles = {
  page: {
    width: "100%",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: "32px",
    alignItems: "start",
  },
  sidebar: {
    minWidth: 0,
    paddingTop: "6px",
  },
  sidebarTitle: {
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "14px",
  },
  navList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  navButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    textAlign: "left",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "14px",
    padding: "10px 12px",
    cursor: "pointer",
    color: "var(--text-secondary)",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  navButtonActive: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    color: "var(--text-primary)",
  },
  navIcon: {
    fontSize: "16px",
    lineHeight: 1,
    width: "20px",
    textAlign: "center",
    flexShrink: 0,
  },
  navLabel: {
    fontSize: "14px",
    fontWeight: "600",
  },
  content: {
    minWidth: 0,
  },
  contentHeader: {
    marginBottom: "18px",
  },
  eyebrow: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "30px",
    fontWeight: "700",
    lineHeight: 1.15,
  },
  subtitle: {
    marginTop: "6px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  sectionWrap: {
    minWidth: 0,
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "18px",
  },
  card: {
    background: "var(--card-bg)",
    border: "1px solid var(--border-soft)",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "var(--shadow-soft)",
  },
  cardHeader: {
    padding: "22px 24px 16px 24px",
    borderBottom: "1px solid var(--divider)",
  },
  cardTitle: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: 1.3,
  },
  cardSubtitle: {
    marginTop: "6px",
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  cardBody: {
    padding: "22px 24px 24px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  featureRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  featureTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  featureText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  themeBadge: {
    background: "var(--surface-2)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "700",
  },
  themeOptionList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  themeOption: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "14px 16px",
    cursor: "pointer",
    textAlign: "left",
    transition:
      "background 160ms ease, border-color 160ms ease, transform 160ms ease",
  },
  themeOptionActive: {
    background: "var(--theme-option-active-bg)",
    border: "1px solid var(--theme-option-active-border)",
    boxShadow: "var(--theme-option-active-shadow)",
  },
  themeOptionLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
  },
  themeOptionIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: "var(--icon-bubble-bg)",
    border: "1px solid var(--icon-bubble-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
  },
  themeOptionTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "4px",
  },
  themeOptionText: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  radioPill: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border-soft)",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  radioPillActive: {
    background: "var(--accent-solid)",
    color: "#ffffff",
    border: "1px solid var(--accent-solid)",
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
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease",
  },
  infoList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  infoRow: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "14px 16px",
  },
  infoLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "8px",
  },
  infoValue: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: 1.5,
  },
  infoValueMultiline: {
    fontSize: "14px",
    fontWeight: "600",
    lineHeight: 1.7,
  },
  helperBox: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "14px 16px",
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  modeCardActive: {
    background: "var(--theme-option-active-bg)",
    border: "1px solid var(--theme-option-active-border)",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "var(--theme-option-active-shadow)",
  },
  modeCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "16px",
  },
  modeTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  modeText: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  choiceBadge: {
    display: "inline-flex",
    marginTop: "12px",
    background: "var(--accent-solid)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "11px",
    fontWeight: "700",
  },
  helperText: {
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  aboutLead: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
    lineHeight: 1.6,
  },
  aboutText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.75,
  },
  buttonGroup: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "var(--modal-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1400,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  modal: {
    width: "100%",
    maxWidth: "760px",
    maxHeight: "calc(100vh - 48px)",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    padding: "24px 28px 18px 28px",
    borderBottom: "1px solid var(--divider)",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  modalTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  modalSubtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  modalBody: {
    padding: "22px 28px 24px 28px",
    overflowY: "auto",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "0 28px 24px 28px",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "24px",
    lineHeight: 1,
    cursor: "pointer",
  },
  legalContent: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  legalParagraph: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.75,
  },
};