import { useEffect, useMemo, useState } from "react";
import { listClinics } from "../users/api/clinicsApi";
import {
  getNetworkSettings,
  saveNetworkSettings,
} from "./api/networkingApi";

const MAX_IP_ENTRIES = 10;

function buildDefaultClinicState() {
  return {
    mode: "public",
    currentIp: "",
    entries: [],
    draftValue: "",
    draftLabel: "",
    error: "",
  };
}

function createEntryId() {
  return `entry-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEntriesForCompare(entries) {
  return (entries || [])
    .map((entry) => ({
      value: String(entry.value || "").trim(),
      label: String(entry.label || "").trim(),
    }))
    .sort((a, b) => {
      const valueCompare = a.value.localeCompare(b.value);
      if (valueCompare !== 0) return valueCompare;
      return a.label.localeCompare(b.label);
    });
}

function buildComparableClinicState(state) {
  return {
    mode: String(state?.mode || "public").trim().toLowerCase(),
    entries: normalizeEntriesForCompare(state?.entries || []),
  };
}

function isValidIpv4(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

function isValidIpOrCidr(value) {
  if (!value) return false;

  if (value.includes("/")) {
    const [ip, cidr] = value.split("/");
    if (!isValidIpv4(ip)) return false;
    if (!/^\d+$/.test(cidr)) return false;

    const prefix = Number(cidr);
    return prefix >= 0 && prefix <= 32;
  }

  return isValidIpv4(value);
}

export default function NetworkingModal({
  accessLevel = "manage",
  scopeLevel = "clinic",
  clinicName = "Current Clinic",
  onSave,
}) {
  const normalizedAccess = String(accessLevel || "").trim().toLowerCase();
  const normalizedScope = String(scopeLevel || "").trim().toLowerCase();

  const isAdmin = normalizedAccess === "admin";
  const isManage = normalizedAccess === "manage";
  const canAccess = isAdmin || isManage;
  const canSwitchClinics =
    normalizedScope === "org" || normalizedScope === "organisation";

  const [clinics, setClinics] = useState([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(true);
  const [clinicsError, setClinicsError] = useState("");

  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [formState, setFormState] = useState({});
  const [savedState, setSavedState] = useState({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const visibleClinics = useMemo(() => {
    if (!canAccess) return [];

    if (canSwitchClinics) {
      return clinics;
    }

    const storedClinicId = localStorage.getItem("dbaSelectedClinicId") || "";
    const clinicBySelectedId = clinics.find(
      (clinic) => clinic.clinicId === storedClinicId
    );

    if (clinicBySelectedId) {
      return [clinicBySelectedId];
    }

    const clinicByName = clinics.find((clinic) => clinic.name === clinicName);
    if (clinicByName) {
      return [clinicByName];
    }

    return clinics.length ? [clinics[0]] : [];
  }, [canAccess, canSwitchClinics, clinics, clinicName]);

  const selectedClinic =
    visibleClinics.find((clinic) => clinic.clinicId === selectedClinicId) ||
    visibleClinics[0] ||
    null;

  const selectedState = selectedClinic
    ? formState[selectedClinic.clinicId] || buildDefaultClinicState()
    : null;

  const isRestricted = selectedState?.mode === "restricted";
  const entryCount = selectedState?.entries?.length || 0;

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedClinic || !selectedState) return false;

    const savedClinicState =
      savedState[selectedClinic.clinicId] || buildDefaultClinicState();

    return (
      JSON.stringify(buildComparableClinicState(selectedState)) !==
      JSON.stringify(buildComparableClinicState(savedClinicState))
    );
  }, [selectedClinic, selectedState, savedState]);

  const currentIpAlreadyAdded = useMemo(() => {
    if (!selectedState?.currentIp) return false;

    const normalizedCurrentIp = String(selectedState.currentIp)
      .trim()
      .toLowerCase();

    return (selectedState.entries || []).some(
      (entry) =>
        String(entry.value || "").trim().toLowerCase() === normalizedCurrentIp
    );
  }, [selectedState]);

  const isSaveDisabled =
    !selectedClinic ||
    !selectedState ||
    !hasUnsavedChanges ||
    isSaving ||
    (isRestricted && entryCount === 0);

  useEffect(() => {
    if (!canAccess) return;

    let isMounted = true;

    async function loadClinicsData() {
      try {
        setIsLoadingClinics(true);
        setClinicsError("");

        const clinicRows = await listClinics();
        if (!isMounted) return;

        const normalizedClinics = Array.isArray(clinicRows)
          ? clinicRows.map((clinic) => ({
              clinicId: clinic.clinicId,
              name: clinic.name || clinic.clinicId,
              organisationId: clinic.organisationId,
            }))
          : [];

        setClinics(normalizedClinics);
      } catch (error) {
        if (!isMounted) return;
        setClinicsError(error?.message || "Failed to load clinics");
      } finally {
        if (isMounted) {
          setIsLoadingClinics(false);
        }
      }
    }

    loadClinicsData();

    return () => {
      isMounted = false;
    };
  }, [canAccess]);

  useEffect(() => {
    if (!visibleClinics.length) {
      setSelectedClinicId("");
      return;
    }

    setFormState((prev) => {
      const next = { ...prev };

      visibleClinics.forEach((clinic) => {
        if (!next[clinic.clinicId]) {
          next[clinic.clinicId] = buildDefaultClinicState();
        }
      });

      return next;
    });

    const stillValid = visibleClinics.some(
      (clinic) => clinic.clinicId === selectedClinicId
    );

    if (!stillValid) {
      setSelectedClinicId(visibleClinics[0].clinicId);
    }
  }, [visibleClinics, selectedClinicId]);

  useEffect(() => {
    if (!selectedClinicId) return;
    loadNetworkSettingsForClinic(selectedClinicId);
  }, [selectedClinicId]);

  function updateClinicState(clinicId, updates) {
    setFormState((prev) => ({
      ...prev,
      [clinicId]: {
        ...(prev[clinicId] || buildDefaultClinicState()),
        ...updates,
      },
    }));
  }

  async function withSelectedClinicHeader(clinicId, action) {
    const previousClinicId = localStorage.getItem("dbaSelectedClinicId") || "";

    if (clinicId) {
      localStorage.setItem("dbaSelectedClinicId", clinicId);
    } else {
      localStorage.removeItem("dbaSelectedClinicId");
    }

    try {
      return await action();
    } finally {
      if (previousClinicId) {
        localStorage.setItem("dbaSelectedClinicId", previousClinicId);
      } else {
        localStorage.removeItem("dbaSelectedClinicId");
      }
    }
  }

  async function loadNetworkSettingsForClinic(targetClinicId) {
    if (!targetClinicId) return;

    try {
      setIsLoadingSettings(true);
      setLoadError("");

      const data = await withSelectedClinicHeader(targetClinicId, () =>
        getNetworkSettings()
      );

      const normalizedLoadedState = {
        mode: data?.mode || "public",
        currentIp: data?.currentIp || "",
        entries: Array.isArray(data?.entries)
          ? data.entries.map((entry) => ({
              id: entry.id || createEntryId(),
              value: entry.value || "",
              label: entry.label || "",
            }))
          : [],
        draftValue: "",
        draftLabel: "",
        error: "",
      };

      updateClinicState(targetClinicId, normalizedLoadedState);

      setSavedState((prev) => ({
        ...prev,
        [targetClinicId]: normalizedLoadedState,
      }));
    } catch (error) {
      setLoadError(error?.message || "Failed to load network settings");
    } finally {
      setIsLoadingSettings(false);
    }
  }

  function handleModeChange(mode) {
    if (!selectedClinic || !selectedState) return;

    updateClinicState(selectedClinic.clinicId, {
      mode,
      error: "",
    });
  }

  function handleDraftChange(field, value) {
    if (!selectedClinic) return;

    updateClinicState(selectedClinic.clinicId, {
      [field]: value,
      error: "",
    });
  }

  function handleAddCurrentIp() {
    if (!selectedClinic || !selectedState) return;

    const currentIp = String(selectedState.currentIp || "").trim();
    if (!currentIp) return;

    const alreadyExists = selectedState.entries.some(
      (entry) =>
        String(entry.value || "").trim().toLowerCase() ===
        currentIp.toLowerCase()
    );

    if (alreadyExists) {
      updateClinicState(selectedClinic.clinicId, {
        error: "That IP address has already been added.",
      });
      return;
    }

    if (selectedState.entries.length >= MAX_IP_ENTRIES) {
      updateClinicState(selectedClinic.clinicId, {
        error: `You can add up to ${MAX_IP_ENTRIES} entries per clinic.`,
      });
      return;
    }

    updateClinicState(selectedClinic.clinicId, {
      entries: [
        ...selectedState.entries,
        {
          id: createEntryId(),
          value: currentIp,
          label: "Current IP",
        },
      ],
      error: "",
    });
  }

  function handleAddEntry() {
    if (!selectedClinic || !selectedState) return;

    const value = String(selectedState.draftValue || "").trim();
    const label = String(selectedState.draftLabel || "").trim();

    if (!value) {
      updateClinicState(selectedClinic.clinicId, {
        error: "Enter an IP address or CIDR range.",
      });
      return;
    }

    if (!isValidIpOrCidr(value)) {
      updateClinicState(selectedClinic.clinicId, {
        error: "Enter a valid IPv4 address or CIDR range.",
      });
      return;
    }

    const alreadyExists = selectedState.entries.some(
      (entry) =>
        String(entry.value || "").trim().toLowerCase() === value.toLowerCase()
    );

    if (alreadyExists) {
      updateClinicState(selectedClinic.clinicId, {
        error: "That IP address or range already exists.",
      });
      return;
    }

    if (selectedState.entries.length >= MAX_IP_ENTRIES) {
      updateClinicState(selectedClinic.clinicId, {
        error: `You can add up to ${MAX_IP_ENTRIES} entries per clinic.`,
      });
      return;
    }

    updateClinicState(selectedClinic.clinicId, {
      entries: [
        ...selectedState.entries,
        {
          id: createEntryId(),
          value,
          label,
        },
      ],
      draftValue: "",
      draftLabel: "",
      error: "",
    });
  }

  function handleRemoveEntry(entryId) {
    if (!selectedClinic || !selectedState) return;

    const updatedEntries = selectedState.entries.filter(
      (entry) => entry.id !== entryId
    );

    updateClinicState(selectedClinic.clinicId, {
      entries: updatedEntries,
      error: "",
    });
  }

  async function handleSave() {
    if (!selectedClinic || !selectedState) return;

    if (selectedState.mode === "restricted" && selectedState.entries.length === 0) {
      updateClinicState(selectedClinic.clinicId, {
        error: "Add at least one allowed IP address before saving.",
      });
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        mode: selectedState.mode,
        entries: selectedState.entries.map((entry) => ({
          value: String(entry.value || "").trim(),
          label: String(entry.label || "").trim() || null,
        })),
      };

      const result = await withSelectedClinicHeader(selectedClinic.clinicId, () =>
        saveNetworkSettings(payload)
      );

      const normalizedSavedResult = {
        mode: result?.mode || selectedState.mode,
        currentIp: selectedState.currentIp,
        entries: Array.isArray(result?.entries)
          ? result.entries.map((entry) => ({
              id: createEntryId(),
              value: entry.value || "",
              label: entry.label || "",
            }))
          : selectedState.entries,
        draftValue: "",
        draftLabel: "",
        error: "",
      };

      updateClinicState(selectedClinic.clinicId, normalizedSavedResult);

      setSavedState((prev) => ({
        ...prev,
        [selectedClinic.clinicId]: normalizedSavedResult,
      }));

      onSave?.({
        clinicId: selectedClinic.clinicId,
        clinicName: selectedClinic.name,
        mode: result?.mode || selectedState.mode,
        entries: Array.isArray(result?.entries)
          ? result.entries
          : selectedState.entries,
      });
    } catch (error) {
      updateClinicState(selectedClinic.clinicId, {
        error: error?.message || "Failed to save network settings",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!canAccess) {
    return null;
  }

  if (isLoadingClinics) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <div style={styles.helperText}>Loading clinics...</div>
          </div>
        </div>
      </div>
    );
  }

  if (clinicsError) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <div style={styles.errorBox}>{clinicsError}</div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingSettings) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <div style={styles.helperText}>Loading network settings...</div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <div style={styles.errorBox}>{loadError}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedClinic || !selectedState) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <div style={styles.emptyState}>
              No clinics were found for this account.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.stack}>
        <section style={styles.heroCard}>
          <div style={styles.heroLeft}>
            <div style={styles.heroEyebrow}>Settings</div>
            <h2 style={styles.heroTitle}>Networking</h2>
            <p style={styles.heroSubtitle}>
              Manage allowed IP addresses and network access for the selected clinic.
            </p>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderRow}>
              <div>
                <h3 style={styles.cardTitle}>Clinic network access</h3>
                <p style={styles.cardSubtitle}>
                  Choose the clinic and decide whether access stays public or is limited
                  to approved IP addresses.
                </p>
              </div>
            </div>
          </div>

          <div style={styles.cardBody}>
            {canSwitchClinics && visibleClinics.length > 1 ? (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Selected clinic</label>
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  style={styles.select}
                  disabled={isSaving}
                >
                  {visibleClinics.map((clinic) => (
                    <option key={clinic.clinicId} value={clinic.clinicId}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={styles.identityPanel}>
                <div style={styles.identityLabel}>Clinic</div>
                <div style={styles.identityValue}>
                  {selectedClinic.name || clinicName}
                </div>
              </div>
            )}

            <div style={styles.modeGrid}>
              <button
                type="button"
                onClick={() => handleModeChange("public")}
                disabled={isSaving}
                style={{
                  ...styles.modeCard,
                  ...(selectedState.mode === "public" ? styles.modeCardActive : {}),
                }}
              >
                <div style={styles.modeIconWrap}>
                  <div style={styles.modeIcon}>🌐</div>
                </div>

                <div style={styles.modeContent}>
                  <div style={styles.modeHeader}>
                    <div style={styles.modeTitle}>Allow public access</div>
                    {selectedState.mode === "public" ? (
                      <div style={styles.choiceBadge}>Selected</div>
                    ) : null}
                  </div>

                  <div style={styles.modeText}>
                    Users can access Dental Buddy AI from any network after signing in.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("restricted")}
                disabled={isSaving}
                style={{
                  ...styles.modeCard,
                  ...(selectedState.mode === "restricted"
                    ? styles.modeCardActive
                    : {}),
                }}
              >
                <div style={styles.modeIconWrap}>
                  <div style={styles.modeIcon}>🛡️</div>
                </div>

                <div style={styles.modeContent}>
                  <div style={styles.modeHeader}>
                    <div style={styles.modeTitle}>Restrict to allowed IPs</div>
                    {selectedState.mode === "restricted" ? (
                      <div style={styles.choiceBadge}>Selected</div>
                    ) : null}
                  </div>

                  <div style={styles.modeText}>
                    Only approved IPv4 addresses or CIDR ranges can access Dental Buddy AI.
                  </div>
                </div>
              </button>
            </div>

            <div style={styles.infoBox}>
              {isRestricted
                ? "Restricted mode is on. Only approved IP addresses and ranges will be able to access this clinic."
                : "Public access is enabled. IP allow-list entries only apply in restricted mode."}
            </div>
          </div>
        </section>

        {isRestricted ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderRow}>
                <div>
                  <h3 style={styles.cardTitle}>Allowed IP addresses</h3>
                  <p style={styles.cardSubtitle}>
                    Add the clinic IP addresses or ranges that should be allowed to
                    access this clinic.
                  </p>
                </div>

                <div style={styles.maxEntriesBadge}>
                  {entryCount} / {MAX_IP_ENTRIES} entries
                </div>
              </div>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.stepBlock}>
                <div style={styles.stepLabel}>Step 1</div>
                <div style={styles.sectionTitle}>Detected IP address</div>
                <div style={styles.sectionHelper}>
                  This is the IP address currently reaching the backend.
                </div>

                <div style={styles.currentIpRow}>
                  <div style={styles.currentIpInfo}>
                    <div style={styles.currentIpValue}>
                      {selectedState.currentIp || "—"}
                    </div>
                  </div>

                  <div style={styles.currentIpActions}>
                    {currentIpAlreadyAdded ? (
                      <div style={styles.includedBadge}>Already added</div>
                    ) : (
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={handleAddCurrentIp}
                        disabled={isSaving || !selectedState.currentIp}
                      >
                        Add current IP
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={styles.stepDivider} />

              <div style={styles.stepBlock}>
                <div style={styles.stepLabel}>Step 2</div>
                <div style={styles.sectionTitle}>Add another IP address or range</div>
                <div style={styles.sectionHelper}>
                  Use this when you want to allow a different IP address or a CIDR range.
                </div>

                <div style={styles.entryForm}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>IP address or CIDR</label>
                    <input
                      type="text"
                      value={selectedState.draftValue || ""}
                      onChange={(e) =>
                        handleDraftChange("draftValue", e.target.value)
                      }
                      placeholder="203.0.113.14 or 203.0.113.0/24"
                      style={styles.input}
                      disabled={isSaving}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Label (optional)</label>
                    <input
                      type="text"
                      value={selectedState.draftLabel || ""}
                      onChange={(e) =>
                        handleDraftChange("draftLabel", e.target.value)
                      }
                      placeholder="Main office"
                      style={styles.input}
                      disabled={isSaving}
                    />
                  </div>

                  <div style={styles.entryActions}>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={handleAddEntry}
                      disabled={isSaving}
                    >
                      Add entry
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.stepDivider} />

              <div style={styles.stepBlock}>
                <div style={styles.stepLabel}>Step 3</div>
                <div style={styles.sectionTitle}>Allowed list</div>
                <div style={styles.sectionHelper}>
                  Review the IP addresses and ranges that will be allowed.
                </div>

                {selectedState.entries.length ? (
                  <div style={styles.entryList}>
                    {selectedState.entries.map((entry) => {
                      const isCurrentIpEntry =
                        String(entry.value || "").trim().toLowerCase() ===
                        String(selectedState.currentIp || "").trim().toLowerCase();

                      return (
                        <div
                          key={entry.id}
                          style={{
                            ...styles.entryRow,
                            ...(isCurrentIpEntry ? styles.entryRowCurrent : {}),
                          }}
                        >
                          <div style={styles.entryMain}>
                            <div style={styles.entryValueRow}>
                              <div style={styles.entryValue}>{entry.value}</div>
                              {isCurrentIpEntry ? (
                                <div style={styles.entryCurrentBadge}>Current IP</div>
                              ) : null}
                            </div>

                            <div style={styles.entryMeta}>
                              {entry.label ? entry.label : "No label"}
                            </div>
                          </div>

                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => handleRemoveEntry(entry.id)}
                            disabled={isSaving}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={styles.emptyState}>
                    No allowed IP addresses yet. Add your current IP or enter one manually.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section style={styles.footerBar}>
          <div style={styles.footerBarInner}>
            <div style={styles.footerStatus}>
              {selectedState.error ? (
                <span style={styles.footerErrorText}>{selectedState.error}</span>
              ) : isRestricted && entryCount === 0 ? (
                <span style={styles.footerHelperText}>
                  Add at least one allowed IP address before saving.
                </span>
              ) : hasUnsavedChanges ? (
                <span style={styles.footerHelperText}>
                  Save changes to apply this clinic’s network access settings.
                </span>
              ) : (
                <span style={styles.footerHelperText}>No unsaved changes.</span>
              )}
            </div>

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...styles.footerSaveButton,
                ...(isSaveDisabled ? styles.primaryButtonDisabled : {}),
              }}
              onClick={handleSave}
              disabled={isSaveDisabled}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100%",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  heroCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    padding: "20px 24px",
    borderRadius: "24px",
    background: "var(--card-bg)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
    flexWrap: "wrap",
  },
  heroLeft: {
    minWidth: 0,
    flex: "1 1 520px",
  },
  heroEyebrow: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "8px",
  },
  heroTitle: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "22px",
    fontWeight: "700",
    lineHeight: 1.2,
  },
  heroSubtitle: {
    marginTop: "10px",
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "760px",
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
  cardHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
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
    maxWidth: "760px",
  },
  cardBody: {
    padding: "22px 24px 24px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: "600",
  },
  select: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "14px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    padding: "0 14px",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "14px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    padding: "0 14px",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  identityPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "16px 18px",
    borderRadius: "16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
  },
  identityLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  identityValue: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "600",
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
  },
  modeCard: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    textAlign: "left",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "18px",
    cursor: "pointer",
    transition:
      "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
    boxShadow: "var(--shadow-soft)",
  },
  modeCardActive: {
    border: "1px solid var(--accent-solid)",
    boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.18), var(--shadow-soft)",
    background:
      "linear-gradient(180deg, rgba(37, 99, 235, 0.10) 0%, rgba(37, 99, 235, 0.04) 100%)",
  },
  modeIconWrap: {
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    background: "var(--icon-bubble-bg)",
    border: "1px solid var(--icon-bubble-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modeIcon: {
    fontSize: "18px",
    lineHeight: 1,
  },
  modeContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    flex: 1,
  },
  modeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  modeTitle: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
  },
  modeText: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  choiceBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(37, 99, 235, 0.12)",
    border: "1px solid rgba(96, 165, 250, 0.24)",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  infoBox: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  stepBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  stepLabel: {
    color: "var(--text-muted)",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    color: "var(--text-primary)",
    fontSize: "15px",
    fontWeight: "700",
  },
  sectionHelper: {
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  stepDivider: {
    height: "1px",
    background: "var(--divider)",
  },
  currentIpRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    padding: "16px 18px",
    borderRadius: "16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    flexWrap: "wrap",
  },
  currentIpInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
  currentIpValue: {
    color: "var(--text-primary)",
    fontSize: "24px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },
  currentIpActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  includedBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(37, 99, 235, 0.12)",
    border: "1px solid rgba(96, 165, 250, 0.24)",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: "700",
  },
  helperText: {
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  errorBox: {
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid rgba(244, 63, 94, 0.18)",
    background: "rgba(244, 63, 94, 0.08)",
    color: "var(--danger-text)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  entryForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr) auto",
    gap: "14px",
    alignItems: "end",
  },
  entryActions: {
    display: "flex",
    alignItems: "stretch",
  },
  entryList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  entryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "16px 18px",
    borderRadius: "16px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-2)",
    flexWrap: "wrap",
  },
  entryRowCurrent: {
    boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.14) inset",
  },
  entryMain: {
    minWidth: 0,
    flex: "1 1 420px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  entryValueRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  entryValue: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    wordBreak: "break-word",
  },
  entryCurrentBadge: {
    padding: "5px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(96, 165, 250, 0.24)",
    background: "rgba(37, 99, 235, 0.10)",
    color: "var(--text-primary)",
    fontSize: "11px",
    fontWeight: "700",
  },
  entryMeta: {
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  emptyState: {
    padding: "18px",
    borderRadius: "16px",
    border: "1px dashed var(--border-soft)",
    background: "var(--surface-2)",
    color: "var(--text-muted)",
    fontSize: "13px",
    textAlign: "center",
  },
  maxEntriesBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: "700",
  },
  footerBar: {
    marginTop: "4px",
  },
  footerBarInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "14px 18px",
    borderRadius: "18px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
  },
  footerStatus: {
    minWidth: 0,
    flex: "1 1 320px",
  },
  footerHelperText: {
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  footerErrorText: {
    color: "var(--danger-text)",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  primaryButton: {
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "14px",
    border: "1px solid transparent",
    background: "var(--accent-solid)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "opacity 160ms ease, transform 160ms ease",
    boxShadow: "var(--accent-shadow)",
  },
  footerSaveButton: {
    minWidth: "150px",
    marginLeft: "auto",
  },
  primaryButtonDisabled: {
    opacity: 1,
    cursor: "not-allowed",
    boxShadow: "none",
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border-soft)",
  },
  secondaryButton: {
    minHeight: "42px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  removeButton: {
    minHeight: "40px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid var(--border-soft)",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
};