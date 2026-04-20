import { useEffect, useMemo, useRef, useState } from "react";
import CreateUserModal from "./CreateUserModal";
import {
  getCurrentUser,
  listUsers,
  updateUserStatus,
  deleteUser,
} from "./api/usersApi";
import EditUserAccessModal from "./EditUserAccessModal";
import { listClinics } from "./api/clinicsApi";
import ResetPasswordModal from "./ResetPasswordModal";
import UserManageMenuPortal from "./UserManageMenuPortal";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export default function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState("");
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [editAccessUser, setEditAccessUser] = useState(null);
  const [disableTargetUser, setDisableTargetUser] = useState(null);
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [manageMenu, setManageMenu] = useState(null);
  const [clinicMembershipUser, setClinicMembershipUser] = useState(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [scopeFilter, setScopeFilter] = useState("All Scopes");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [sortConfig, setSortConfig] = useState({
    key: "displayName",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const toastTimerRef = useRef(null);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, scopeFilter, roleFilter, sortConfig, pageSize]);

  async function loadPage() {
    setLoadError("");
    setIsLoadingUser(true);
    setIsLoadingUsers(true);

    try {
      const [me, userList, clinicList] = await Promise.all([
        getCurrentUser(),
        listUsers(),
        listClinics(),
      ]);

      setCurrentUser(me);
      setUsers(userList);
      setClinics(clinicList);
    } catch (error) {
      setLoadError(error.message || "Failed to load user management.");
    } finally {
      setIsLoadingUser(false);
      setIsLoadingUsers(false);
    }
  }

  function showToast(message, type = "success") {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ message, type });

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }

  async function handleToggleStatus(user) {
    const isSelf = currentUser?.userId === user.userId;
    const isProtectedOrganisationAdmin =
      protectedOrganisationAdminUserIds.has(user.userId);

    if (isSelf) {
      showToast("You cannot disable your own account.", "error");
      return;
    }

    if (
      isProtectedOrganisationAdmin &&
      String(user.status || "").toLowerCase() !== "disabled"
    ) {
      showToast(
        "The last active organisation admin cannot be disabled.",
        "error"
      );
      return;
    }

    const nextStatus = user.status === "disabled" ? "active" : "disabled";

    if (nextStatus === "disabled") {
      setDisableTargetUser(user);
      return;
    }

    try {
      setStatusUpdatingUserId(user.userId);

      const updatedUser = await updateUserStatus({
        userId: user.userId,
        status: nextStatus,
      });

      setUsers((prev) =>
        prev.map((item) =>
          item.userId === updatedUser.userId ? updatedUser : item
        )
      );

      showToast("User reactivated.");
    } catch (error) {
      showToast(error.message || "Failed to update user status.", "error");
    } finally {
      setStatusUpdatingUserId("");
    }
  }

  async function handleConfirmDisable() {
    if (!disableTargetUser) return;

    try {
      setIsConfirmingDisable(true);
      setStatusUpdatingUserId(disableTargetUser.userId);

      const updatedUser = await updateUserStatus({
        userId: disableTargetUser.userId,
        status: "disabled",
      });

      setUsers((prev) =>
        prev.map((item) =>
          item.userId === updatedUser.userId ? updatedUser : item
        )
      );

      showToast("User disabled.");
      setDisableTargetUser(null);
    } catch (error) {
      showToast(error.message || "Failed to update user status.", "error");
    } finally {
      setIsConfirmingDisable(false);
      setStatusUpdatingUserId("");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteUserTarget) return;

    setDeleteError("");

    try {
      setIsDeleting(true);

      await deleteUser({
        userId: deleteUserTarget.userId,
      });

      setUsers((prev) => prev.filter((u) => u.userId !== deleteUserTarget.userId));

      setDeleteUserTarget(null);
      showToast("User deleted.");
    } catch (err) {
      setDeleteError(err.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  }

  const canManageUsers = useMemo(() => {
    const orgLevel = String(
      currentUser?.organisationPermissionLevel || ""
    ).toLowerCase();

    const effectiveLevel = String(
      currentUser?.effectivePermissionLevel || ""
    ).toLowerCase();

    return orgLevel === "admin" || ["admin", "manage"].includes(effectiveLevel);
  }, [currentUser]);

  const protectedOrganisationAdminUserIds = useMemo(() => {
    const activeOrganisationAdmins = users.filter((user) => {
      const isAdmin =
        String(user.organisationPermissionLevel || "").toLowerCase() === "admin";

      const isActive = String(user.status || "").toLowerCase() === "active";

      return isAdmin && isActive;
    });

    if (activeOrganisationAdmins.length !== 1) {
      return new Set();
    }

    return new Set(activeOrganisationAdmins.map((user) => user.userId));
  }, [users]);

  const clinicNameMap = useMemo(() => {
    const map = {};

    for (const clinic of clinics) {
      map[clinic.clinicId] = clinic.name;
    }

    return map;
  }, [clinics]);

  const selectedClinicDisplay = useMemo(() => {
    if (!currentUser?.selectedClinicId) {
      return "None";
    }

    return (
      clinicNameMap[currentUser.selectedClinicId] || currentUser.selectedClinicId
    );
  }, [clinicNameMap, currentUser?.selectedClinicId]);

  const totalUsers = users.length;

  const activeUsers = users.filter(
    (user) => String(user.status || "").toLowerCase() === "active"
  ).length;

  const disabledUsers = users.filter(
    (user) => String(user.status || "").toLowerCase() === "disabled"
  ).length;

  const organisationUsers = users.filter(
    (user) => !!user.organisationPermissionLevel
  ).length;

  const clinicUsers = users.filter(
    (user) => !user.organisationPermissionLevel
  ).length;

  function buildManageMenuUser(user) {
    const isSelf = currentUser?.userId === user.userId;
    const isProtectedOrganisationAdmin =
      protectedOrganisationAdminUserIds.has(user.userId);
    const isDisabled = String(user.status || "").toLowerCase() === "disabled";

    let canToggleStatus = true;
    let toggleStatusReason = "";

    if (isSelf) {
      canToggleStatus = false;
      toggleStatusReason = "You cannot change your own account status here.";
    } else if (isProtectedOrganisationAdmin && !isDisabled) {
      canToggleStatus = false;
      toggleStatusReason = "The last active organisation admin cannot be disabled.";
    }

    let canDelete = true;
    let deleteReason = "";

    if (isSelf) {
      canDelete = false;
      deleteReason = "You cannot delete your own account.";
    } else if (isProtectedOrganisationAdmin) {
      canDelete = false;
      deleteReason = "The last active organisation admin cannot be deleted.";
    }

    return {
      ...user,
      canResetPassword: true,
      canToggleStatus,
      canDelete,
      hideResetPassword: false,
      hideToggleStatus: false,
      hideDelete: false,
      toggleStatusReason,
      deleteReason,
      resetPasswordReason: "",
    };
  }

  function handleOpenManageMenu(event, user) {
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const menuUser = buildManageMenuUser(user);

    setManageMenu((prev) => {
      if (prev?.user?.userId === user.userId) {
        return null;
      }

      return {
        user: menuUser,
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

  async function handleManageAction(action, user) {
    setManageMenu(null);

    if (action === "reset-password") {
      setResetPasswordUser(user);
      return;
    }

    if (action === "disable") {
      await handleToggleStatus(user);
      return;
    }

    if (action === "enable") {
      await handleToggleStatus(user);
    }
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
        direction: key === "createdAt" ? "desc" : "asc",
      };
    });
  }

  function handleSummaryCardClick(nextFilterType, nextValue) {
    setCurrentPage(1);

    if (nextFilterType === "status") {
      setStatusFilter(nextValue);
      setScopeFilter("All Scopes");
      return;
    }

    if (nextFilterType === "scope") {
      setScopeFilter(nextValue);
      setStatusFilter("All Statuses");
    }
  }

  function handleClearFilters() {
    setSearchTerm("");
    setStatusFilter("Active");
    setScopeFilter("All Scopes");
    setRoleFilter("All Roles");
    setCurrentPage(1);
  }

  function handleStatusBadgeClick(nextStatus) {
    setRoleFilter("All Roles");
    setScopeFilter("All Scopes");
    setStatusFilter(nextStatus);
    setCurrentPage(1);
  }

  function handleScopeBadgeClick(nextScope) {
    setRoleFilter("All Roles");
    setStatusFilter("All Statuses");
    setScopeFilter(nextScope);
    setCurrentPage(1);
  }

  function isSummaryCardActive(cardKey) {
    if (cardKey === "total") {
      return statusFilter === "All Statuses" && scopeFilter === "All Scopes";
    }

    if (cardKey === "active") {
      return statusFilter === "Active" && scopeFilter === "All Scopes";
    }

    if (cardKey === "disabled") {
      return statusFilter === "Disabled" && scopeFilter === "All Scopes";
    }

    if (cardKey === "organisation") {
      return scopeFilter === "Organisation" && statusFilter === "All Statuses";
    }

    if (cardKey === "clinic") {
      return scopeFilter === "Clinic" && statusFilter === "All Statuses";
    }

    return false;
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchValue = searchTerm.trim().toLowerCase();

      const primaryRole = getPrimaryRole(user);
      const scopeValue = user.organisationPermissionLevel
        ? "organisation"
        : "clinic";
      const clinicMemberships = Array.isArray(user.clinicMemberships)
        ? user.clinicMemberships
        : [];

      const clinicNamesJoined = clinicMemberships
        .map((membership) => clinicNameMap[membership.clinicId] || membership.clinicId)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        searchValue === "" ||
        String(user.displayName || "").toLowerCase().includes(searchValue) ||
        String(user.email || "").toLowerCase().includes(searchValue) ||
        String(user.username || "").toLowerCase().includes(searchValue) ||
        String(getAccountTypeLabel(user) || "").toLowerCase().includes(searchValue) ||
        String(primaryRole || "").toLowerCase().includes(searchValue) ||
        scopeValue.includes(searchValue) ||
        clinicNamesJoined.includes(searchValue);

      const normalizedStatus = String(user.status || "").toLowerCase();

      const matchesStatus =
        statusFilter === "All Statuses"
          ? true
          : statusFilter === "Active"
          ? normalizedStatus === "active"
          : statusFilter === "Disabled"
          ? normalizedStatus === "disabled"
          : statusFilter === "Invited"
          ? normalizedStatus === "invited"
          : true;

      const matchesScope =
        scopeFilter === "All Scopes"
          ? true
          : scopeFilter === "Organisation"
          ? !!user.organisationPermissionLevel
          : !user.organisationPermissionLevel;

      const matchesRole =
        roleFilter === "All Roles"
          ? true
          : String(primaryRole || "").toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesScope && matchesRole;
    });
  }, [users, searchTerm, statusFilter, scopeFilter, roleFilter, clinicNameMap]);

  const sortedUsers = useMemo(() => {
    const items = [...filteredUsers];
    const { key, direction } = sortConfig;

    items.sort((a, b) => {
      let aValue;
      let bValue;

      if (key === "scope") {
        aValue = a.organisationPermissionLevel ? "organisation" : "clinic";
        bValue = b.organisationPermissionLevel ? "organisation" : "clinic";
      } else if (key === "role") {
        aValue = String(getPrimaryRole(a) || "").toLowerCase();
        bValue = String(getPrimaryRole(b) || "").toLowerCase();
      } else if (key === "clinics") {
        aValue = getClinicCount(a);
        bValue = getClinicCount(b);
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

    return items;
  }, [filteredUsers, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedUsers.slice(startIndex, startIndex + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    statusFilter !== "Active" ||
    scopeFilter !== "All Scopes" ||
    roleFilter !== "All Roles";

  const emptyStateMessage = getEmptyStateMessage({
    isLoadingUsers,
    totalUsers: users.length,
    filteredCount: filteredUsers.length,
    statusFilter,
    searchTerm,
    scopeFilter,
    roleFilter,
  });

  return (
    <>
      {toast && (
        <div
          style={{
            ...styles.toast,
            ...(toast.type === "error" ? styles.toastError : styles.toastSuccess),
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={styles.page}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>User Management</h1>
            <p style={styles.subtitle}>
              Manage team access across your clinics.
            </p>
          </div>

          {canManageUsers && (
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => setIsCreateUserOpen(true)}
            >
              Create User
            </button>
          )}
        </div>

        {loadError && <div style={styles.errorBox}>{loadError}</div>}

        <div style={styles.summaryRow}>
          <SummaryCard
            label="Total Users"
            value={isLoadingUsers ? "Loading..." : String(totalUsers)}
            isActive={isSummaryCardActive("total")}
            onClick={() => {
              setStatusFilter("All Statuses");
              setScopeFilter("All Scopes");
              setCurrentPage(1);
            }}
          />
          <SummaryCard
            label="Active"
            value={isLoadingUsers ? "Loading..." : String(activeUsers)}
            isActive={isSummaryCardActive("active")}
            onClick={() => handleSummaryCardClick("status", "Active")}
          />
          <SummaryCard
            label="Disabled"
            value={isLoadingUsers ? "Loading..." : String(disabledUsers)}
            isActive={isSummaryCardActive("disabled")}
            onClick={() => handleSummaryCardClick("status", "Disabled")}
          />
          <SummaryCard
            label="Organisation Users"
            value={isLoadingUsers ? "Loading..." : String(organisationUsers)}
            isActive={isSummaryCardActive("organisation")}
            onClick={() => handleSummaryCardClick("scope", "Organisation")}
          />
          <SummaryCard
            label="Clinic Users"
            value={isLoadingUsers ? "Loading..." : String(clinicUsers)}
            isActive={isSummaryCardActive("clinic")}
            onClick={() => handleSummaryCardClick("scope", "Clinic")}
          />
        </div>

        <div style={styles.contextBar}>
          <div style={styles.contextPill}>
            <span style={styles.contextLabel}>Current User</span>
            <span style={styles.contextValue}>
              {isLoadingUser ? "Loading..." : currentUser?.displayName || "—"}
            </span>
          </div>

          <div style={styles.contextPill}>
            <span style={styles.contextLabel}>Selected Clinic</span>
            <span style={styles.contextValue}>
              {isLoadingUser ? "Loading..." : selectedClinicDisplay}
            </span>
          </div>

          <div style={styles.contextPill}>
            <span style={styles.contextLabel}>Effective Permission</span>
            <span style={styles.contextValue}>
              {isLoadingUser
                ? "Loading..."
                : formatPermission(currentUser?.effectivePermissionLevel)}
            </span>
          </div>
        </div>

        <div style={styles.filterRow}>
          <input
            type="text"
            placeholder="Search users..."
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
            <option>Disabled</option>
            <option>Invited</option>
          </select>

          <select
            style={styles.select}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option>All Scopes</option>
            <option>Organisation</option>
            <option>Clinic</option>
          </select>

          <select
            style={styles.select}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option>All Roles</option>
            <option>Admin</option>
            <option>Manage</option>
            <option>Write</option>
            <option>Read</option>
            <option>Mixed</option>
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

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <SortableHeader
                  label="User"
                  sortKey="displayName"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Identity"
                  sortKey="email"
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
                  label="Role"
                  sortKey="role"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Clinics"
                  sortKey="clinics"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td style={styles.emptyStateCell} colSpan={7}>
                    <div style={styles.emptyStateWrap}>
                      <div style={styles.emptyStateIcon}>👥</div>
                      <div style={styles.emptyStateTitle}>Loading users</div>
                      <div style={styles.emptyStateText}>{emptyStateMessage}</div>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td style={styles.emptyStateCell} colSpan={7}>
                    <div style={styles.emptyStateWrap}>
                      <div style={styles.emptyStateIcon}>👤</div>
                      <div style={styles.emptyStateTitle}>
                        {statusFilter === "Disabled"
                          ? "No disabled users"
                          : statusFilter === "Invited"
                          ? "No invited users"
                          : statusFilter === "Active"
                          ? "No active users"
                          : "No users to show"}
                      </div>
                      <div style={styles.emptyStateText}>{emptyStateMessage}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const isBusy = statusUpdatingUserId === user.userId;
                  const isSelf = currentUser?.userId === user.userId;
                  const isProtectedOrganisationAdmin =
                    protectedOrganisationAdminUserIds.has(user.userId);

                  return (
                    <tr
                      key={user.userId}
                      style={styles.tr}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--table-row-hover)";

                        const avatar = e.currentTarget.querySelector(
                          "[data-user-avatar='true']"
                        );
                        if (avatar) {
                          avatar.style.transform = "translateY(-1px)";
                          avatar.style.boxShadow =
                            "0 0 16px rgba(59,130,246,0.16)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";

                        const avatar = e.currentTarget.querySelector(
                          "[data-user-avatar='true']"
                        );
                        if (avatar) {
                          avatar.style.transform = "translateY(0)";
                          avatar.style.boxShadow = "none";
                        }
                      }}
                    >
                      <td style={styles.tdStrong}>
                        <div style={styles.userCell}>
                          <div data-user-avatar="true" style={styles.userAvatar}>
                            {getInitials(user.displayName)}
                          </div>

                          <div style={styles.userTextWrap}>
                            <div style={styles.userNameRow}>
                              <div style={styles.userName}>{user.displayName}</div>
                              <span
                                style={
                                  isWorkstationAccount(user)
                                    ? styles.accountTypeBadgeWorkstation
                                    : styles.accountTypeBadgeWork
                                }
                              >
                                {getAccountTypeLabel(user)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.identityCell}>
                          <div style={styles.identityPrimary}>{getUserIdentity(user)}</div>
                          <div style={styles.identitySecondary}>{getAccountTypeLabel(user)} account</div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() =>
                            handleScopeBadgeClick(formatScopeFilterValue(user))
                          }
                          style={styles.badgeButton}
                          title={`Filter by ${formatScopeFilterValue(user)}`}
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
                          <ScopeBadge user={user} />
                        </button>
                      </td>

                      <td style={styles.td}>
                        <PermissionBadge permission={getPrimaryRole(user)} />
                      </td>

                      <td style={styles.td}>
                        <ClinicsCell
                          user={user}
                          onOpenClinics={() => setClinicMembershipUser(user)}
                        />
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() =>
                            handleStatusBadgeClick(
                              formatStatusFilterValue(user.status)
                            )
                          }
                          style={styles.badgeButton}
                          title={`Filter by ${formatStatusFilterValue(user.status)}`}
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
                          <StatusBadge status={user.status} />
                        </button>
                      </td>

                      <td style={styles.td}>
                        {canManageUsers ? (
                          <div style={styles.actions}>
                            <button
                              type="button"
                              style={styles.actionButton}
                              onClick={() => setEditAccessUser(user)}
                            >
                              Edit Access
                            </button>

                            <button
                              type="button"
                              style={{
                                ...styles.actionButton,
                                ...(manageMenu?.user?.userId === user.userId
                                  ? styles.actionButtonActive
                                  : {}),
                              }}
                              onClick={(e) => handleOpenManageMenu(e, user)}
                              title={
                                isSelf
                                  ? "Some actions are limited for your own account"
                                  : isProtectedOrganisationAdmin
                                  ? "Protected organisation admin actions are limited"
                                  : ""
                              }
                            >
                              Manage ▾
                            </button>

                            {isBusy && (
                              <span style={styles.inlineBusyText}>Updating...</span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoadingUsers && sortedUsers.length > 0 && (
          <div style={styles.paginationRow}>
            <div style={styles.paginationInfo}>
              Showing{" "}
              <strong>
                {Math.min((currentPage - 1) * pageSize + 1, sortedUsers.length)}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(currentPage * pageSize, sortedUsers.length)}
              </strong>{" "}
              of <strong>{sortedUsers.length}</strong> results
            </div>

            <div style={styles.paginationControls}>
              <button
                type="button"
                style={{
                  ...styles.paginationButton,
                  ...(currentPage === 1 ? styles.paginationButtonDisabled : {}),
                }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
          </div>
        )}
      </div>

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        currentUser={currentUser}
        availableClinics={clinics}
        onCreated={async (createdUser) => {
          setUsers((prev) => [...prev, createdUser]);
          showToast("User created.");
        }}
      />

      <EditUserAccessModal
        isOpen={!!editAccessUser}
        onClose={() => setEditAccessUser(null)}
        currentUser={currentUser}
        user={editAccessUser}
        availableClinics={clinics}
        isProtectedOrganisationAdmin={
          !!editAccessUser &&
          protectedOrganisationAdminUserIds.has(editAccessUser.userId)
        }
        onSaved={async (updatedUser) => {
          setUsers((prev) =>
            prev.map((item) =>
              item.userId === updatedUser.userId ? updatedUser : item
            )
          );
          showToast("User access updated.");
        }}
      />

      <ResetPasswordModal
        user={resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        onResetComplete={async (user, result) => {
          const isWorkstation =
            String(user?.accountType || "").toLowerCase() === "workstation";

          if (isWorkstation) {
            const returnedPassword =
              result?.temporaryPassword || result?.password || "";

            showToast(
              returnedPassword
                ? "New workstation password generated."
                : "Workstation password reset completed."
            );
            return;
          }

          showToast("Password reset started. The user must set a new password.");
        }}
      />

      <ConfirmDisableUserModal
        user={disableTargetUser}
        isSaving={isConfirmingDisable}
        onClose={() => setDisableTargetUser(null)}
        onConfirm={handleConfirmDisable}
      />

      <ClinicMembershipsModal
        user={clinicMembershipUser}
        clinicNameMap={clinicNameMap}
        onClose={() => setClinicMembershipUser(null)}
      />

      {deleteUserTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.confirmHeader}>
              <div>
                <h2 style={styles.confirmTitle}>Delete User</h2>
                <p style={styles.confirmSubtitle}>
                  This will permanently delete the user from Dental Buddy AI.
                </p>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteUserTarget(null);
                    setDeleteError("");
                  }
                }}
              >
                ✕
              </button>
            </div>

            <div style={styles.confirmBody}>
              <div style={styles.confirmCard}>
                <div style={styles.confirmLabel}>Display Name</div>
                <div style={styles.confirmValue}>{deleteUserTarget.displayName}</div>

                <div style={{ ...styles.confirmLabel, marginTop: "12px" }}>
                  {isWorkstationAccount(deleteUserTarget) ? "Username" : "Email"}
                </div>
                <div style={styles.confirmValue}>{getUserIdentity(deleteUserTarget)}</div>
              </div>

              {deleteError ? (
                <div
                  style={{
                    ...styles.errorBox,
                    marginTop: "16px",
                    marginBottom: 0,
                  }}
                >
                  {deleteError}
                </div>
              ) : null}
            </div>

            <div style={styles.confirmFooter}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteUserTarget(null);
                    setDeleteError("");
                  }
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                style={styles.dangerButton}
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserManageMenuPortal
        menuState={manageMenu}
        onClose={() => setManageMenu(null)}
        onAction={handleManageAction}
        onDeleteUser={(user) => {
          setManageMenu(null);
          setDeleteError("");
          setDeleteUserTarget(user);
        }}
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

function ClinicsCell({ user, onOpenClinics }) {
  if (user.organisationPermissionLevel) {
    return (
      <div style={styles.clinicsCellWrap}>
        <div style={styles.clinicsPrimary}>All clinics</div>
        <div style={styles.clinicsSecondary}>Organisation access</div>
      </div>
    );
  }

  const memberships = Array.isArray(user.clinicMemberships)
    ? user.clinicMemberships
    : [];

  if (memberships.length === 0) {
    return "—";
  }

  const count = memberships.length;

  return (
    <div style={styles.clinicsCellWrap}>
      <button
        type="button"
        onClick={onOpenClinics}
        style={styles.clinicsLinkButton}
      >
        {count} clinic{count === 1 ? "" : "s"}
      </button>

      <button
        type="button"
        onClick={onOpenClinics}
        style={styles.clinicsSecondaryButton}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.textDecorationColor = "var(--avatar-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.88";
          e.currentTarget.style.textDecorationColor = "transparent";
        }}
      >
        View clinics
      </button>
    </div>
  );
}

function ClinicMembershipsModal({ user, clinicNameMap, onClose }) {
  if (!user) return null;

  const memberships = Array.isArray(user.clinicMemberships)
    ? user.clinicMemberships
    : [];

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.membershipModal}>
        <div style={styles.confirmHeader}>
          <div>
            <h2 style={styles.confirmTitle}>Clinic Access</h2>
            <p style={styles.confirmSubtitle}>
              Review clinic memberships for {user.displayName}.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.membershipModalBody}>
          <div style={styles.membershipIdentityCard}>
            <div style={styles.membershipIdentityLeft}>
              <div style={styles.membershipAvatar}>
                {getInitials(user.displayName)}
              </div>

              <div style={styles.membershipIdentityTextWrap}>
                <div style={styles.membershipIdentityName}>{user.displayName}</div>
                <div style={styles.membershipIdentityEmail}>{getUserIdentity(user)}</div>

                <div style={styles.membershipIdentityMetaRow}>
                  <span style={styles.membershipMetaBadge}>
                    {isWorkstationAccount(user) ? "Workstation account" : "Clinic user"}
                  </span>
                  <span style={styles.membershipMetaBadgeSecondary}>
                    {memberships.length} clinic{memberships.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.membershipSection}>
            <div style={styles.membershipSectionHeader}>
              <div style={styles.membershipSectionTitle}>Assigned clinics</div>
              <div style={styles.membershipSectionSubtitle}>
                Review this user&apos;s clinic-by-clinic access.
              </div>
            </div>

            {memberships.length === 0 ? (
              <div style={styles.membershipEmptyState}>
                No clinic memberships found.
              </div>
            ) : (
              <div style={styles.membershipListModal}>
                {memberships.map((membership) => {
                  const clinicName =
                    clinicNameMap[membership.clinicId] || membership.clinicId;

                  return (
                    <div
                      key={`${membership.clinicId}-${membership.permissionLevel}`}
                      style={styles.membershipItemModal}
                    >
                      <div style={styles.membershipItemLeft}>
                        <div style={styles.membershipClinicIcon}>🏥</div>

                        <div style={styles.membershipItemText}>
                          <div style={styles.membershipItemTitle}>{clinicName}</div>
                          <div style={styles.membershipItemSubtitle}>
                            Clinic membership
                          </div>
                        </div>
                      </div>

                      <div style={styles.membershipItemBadgeWrap}>
                        <PermissionBadge permission={membership.permissionLevel} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={styles.confirmFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getPrimaryRole(user) {
  if (user.organisationPermissionLevel) {
    return user.organisationPermissionLevel;
  }

  if (!Array.isArray(user.clinicMemberships) || user.clinicMemberships.length === 0) {
    return null;
  }

  const normalizedLevels = user.clinicMemberships
    .map((item) => String(item.permissionLevel || "").toLowerCase())
    .filter(Boolean);

  if (normalizedLevels.length === 0) {
    return null;
  }

  const uniqueLevels = [...new Set(normalizedLevels)];

  if (uniqueLevels.length === 1) {
    return uniqueLevels[0];
  }

  return "mixed";
}

function getAccountType(user) {
  return String(user?.accountType || "work").toLowerCase();
}

function isWorkstationAccount(user) {
  return getAccountType(user) === "workstation";
}

function getUserIdentity(user) {
  return isWorkstationAccount(user)
    ? user?.username || "—"
    : user?.email || "—";
}

function getAccountTypeLabel(user) {
  return isWorkstationAccount(user) ? "Workstation" : "Work";
}

function getClinicCount(user) {
  if (user.organisationPermissionLevel) return 999;
  if (!Array.isArray(user.clinicMemberships)) return 0;
  return user.clinicMemberships.length;
}

function getStatusSortWeight(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") return 1;
  if (normalized === "invited") return 2;
  if (normalized === "disabled") return 3;
  return 4;
}

function formatStatusFilterValue(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") return "Active";
  if (normalized === "disabled") return "Disabled";
  if (normalized === "invited") return "Invited";

  return "All Statuses";
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

function formatScopeFilterValue(user) {
  return user?.organisationPermissionLevel ? "Organisation" : "Clinic";
}

function ScopeBadge({ user }) {
  const isOrganisation = !!user.organisationPermissionLevel;

  return (
    <span
      style={
        isOrganisation ? styles.badgeOrganisationScope : styles.badgeClinicScope
      }
    >
      {isOrganisation ? "Organisation" : "Clinic"}
    </span>
  );
}

function PermissionBadge({ permission }) {
  const normalized = String(permission || "").toLowerCase();

  if (normalized === "admin") {
    return <span style={styles.badgeAdmin}>Admin</span>;
  }

  if (normalized === "manage") {
    return <span style={styles.badgeManage}>Manage</span>;
  }

  if (normalized === "write") {
    return <span style={styles.badgeWrite}>Write</span>;
  }

  if (normalized === "read") {
    return <span style={styles.badgeRead}>Read</span>;
  }

  if (normalized === "mixed") {
    return <span style={styles.badgeNeutral}>Mixed</span>;
  }

  return <span style={styles.badgeNeutral}>{permission || "Unknown"}</span>;
}

function formatPermission(value) {
  if (!value) return "—";

  const normalized = String(value).trim().toLowerCase();

  if (normalized === "admin") return "Admin";
  if (normalized === "manage") return "Manage";
  if (normalized === "write") return "Write";
  if (normalized === "read") return "Read";

  return value;
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

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") {
    return <span style={styles.badgeActive}>Active</span>;
  }

  if (normalized === "disabled") {
    return <span style={styles.badgeDisabled}>Disabled</span>;
  }

  if (normalized === "invited") {
    return <span style={styles.badgeInvited}>Invited</span>;
  }

  return <span style={styles.badgeNeutral}>{status || "Unknown"}</span>;
}

function ConfirmDisableUserModal({ user, isSaving, onClose, onConfirm }) {
  if (!user) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.confirmModal}>
        <div style={styles.confirmHeader}>
          <div>
            <h2 style={styles.confirmTitle}>Disable User</h2>
            <p style={styles.confirmSubtitle}>
              This user will no longer be able to access Dental Buddy AI until re-enabled.
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.confirmBody}>
          <div style={styles.confirmCard}>
            <div style={styles.confirmLabel}>Display Name</div>
            <div style={styles.confirmValue}>{user.displayName}</div>

            <div style={{ ...styles.confirmLabel, marginTop: "12px" }}>
              {isWorkstationAccount(user) ? "Username" : "Email"}
            </div>
            <div style={styles.confirmValue}>{getUserIdentity(user)}</div>
          </div>
        </div>

        <div style={styles.confirmFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="button"
            style={styles.dangerButton}
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? "Disabling..." : "Disable User"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getEmptyStateMessage({
  isLoadingUsers,
  totalUsers,
  filteredCount,
  statusFilter,
  searchTerm,
  scopeFilter,
  roleFilter,
}) {
  if (isLoadingUsers) {
    return "Loading users...";
  }

  if (totalUsers === 0) {
    return "No users have been added yet.";
  }

  const hasSearch = searchTerm.trim() !== "";
  const hasScopeFilter = scopeFilter !== "All Scopes";
  const hasRoleFilter = roleFilter !== "All Roles";
  const hasCustomStatus =
    statusFilter !== "Active" && statusFilter !== "All Statuses";

  if (filteredCount > 0) {
    return "";
  }

  if (statusFilter === "Active") {
    return "No active users found.";
  }

  if (statusFilter === "Disabled") {
    return "No disabled users found.";
  }

  if (statusFilter === "Invited") {
    return "No invited users found.";
  }

  if (hasSearch || hasScopeFilter || hasRoleFilter || hasCustomStatus) {
    return "No users match your filters.";
  }

  return "No users found.";
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
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "18px",
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
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--text-primary)",
    wordBreak: "break-word",
  },
  summaryLabel: {
    marginTop: "6px",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  contextBar: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  contextPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    background: "var(--surface-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "999px",
    padding: "10px 14px",
  },
  contextLabel: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
  },
  contextValue: {
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "700",
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
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "16px",
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "600",
    verticalAlign: "middle",
  },
  userCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  userAvatar: {
    width: "38px",
    height: "38px",
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
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  userTextWrap: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  userName: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: 1.4,
  },
  identityCell: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  identityPrimary: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "600",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  identitySecondary: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  userNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  accountTypeBadgeWork: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.14)",
    color: "var(--avatar-text)",
    fontSize: "11px",
    fontWeight: "700",
  },
  accountTypeBadgeWorkstation: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(168,85,247,0.14)",
    color: "#8b5cf6",
    fontSize: "11px",
    fontWeight: "700",
  },
  clinicsCellWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    alignItems: "flex-start",
  },
  clinicsLinkButton: {
    background: "transparent",
    border: "none",
    padding: 0,
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    textAlign: "left",
  },
  clinicsSecondaryButton: {
    background: "transparent",
    border: "none",
    padding: 0,
    color: "var(--avatar-text)",
    fontSize: "11px",
    cursor: "pointer",
    textAlign: "left",
    opacity: 0.88,
    transition: "opacity 0.15s ease, text-decoration-color 0.15s ease",
    textDecoration: "underline",
    textDecorationColor: "transparent",
    textUnderlineOffset: "3px",
  },
  clinicsPrimary: {
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: 1.4,
  },
  clinicsSecondary: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.4,
    maxWidth: "220px",
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
    padding: "7px 11px",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  actionButtonActive: {
    background: "var(--table-action-hover-bg)",
    borderColor: "var(--table-action-hover-border)",
    boxShadow: "0 0 0 1px rgba(96,165,250,0.12) inset",
  },
  inlineBusyText: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeActive: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.14)",
    color: "#16a34a",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeDisabled: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(244,63,94,0.14)",
    color: "var(--danger-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeInvited: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.14)",
    color: "var(--avatar-text)",
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
  badgeOrganisationScope: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.14)",
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeClinicScope: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(168,85,247,0.14)",
    color: "#8b5cf6",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeAdmin: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(244,63,94,0.14)",
    color: "var(--danger-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeManage: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(250,204,21,0.14)",
    color: "#b45309",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeWrite: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.14)",
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeRead: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.14)",
    color: "#16a34a",
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
    zIndex: 1200,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  confirmModal: {
    width: "100%",
    maxWidth: "560px",
    background: "var(--modal-bg)",
    border: "1px solid rgba(248,113,113,0.16)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  membershipModal: {
    width: "100%",
    maxWidth: "620px",
    background: "var(--modal-bg)",
    border: "1px solid var(--modal-border)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-strong)",
    overflow: "hidden",
  },
  confirmHeader: {
    padding: "24px 28px 18px 28px",
    borderBottom: "1px solid var(--divider)",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  confirmTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  confirmSubtitle: {
    marginTop: "8px",
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  confirmBody: {
    padding: "22px 28px 24px 28px",
  },
  confirmCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "16px",
  },
  confirmLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontWeight: "600",
  },
  confirmValue: {
    marginTop: "6px",
    fontSize: "14px",
    color: "var(--text-primary)",
    fontWeight: "600",
    wordBreak: "break-word",
  },
  confirmFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "0 28px 24px 28px",
  },
  membershipItemText: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  membershipItemTitle: {
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: 1.4,
  },
  membershipItemSubtitle: {
    color: "var(--text-muted)",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  dangerButton: {
    background: "rgba(239,68,68,0.16)",
    color: "var(--danger-text)",
    border: "1px solid rgba(248,113,113,0.28)",
    borderRadius: "14px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
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
  membershipIdentityCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "18px",
  },
  membershipIdentityLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  membershipAvatar: {
    width: "52px",
    height: "52px",
    borderRadius: "999px",
    background: "var(--avatar-bg)",
    border: "1px solid var(--avatar-border)",
    color: "var(--avatar-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "700",
    flexShrink: 0,
  },
  membershipIdentityTextWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  membershipIdentityName: {
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: "700",
    lineHeight: 1.3,
  },
  membershipIdentityEmail: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  membershipIdentityMetaRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "6px",
  },
  membershipMetaBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "var(--icon-bubble-bg)",
    color: "var(--avatar-text)",
    fontSize: "12px",
    fontWeight: "600",
  },
  membershipMetaBadgeSecondary: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "var(--surface-2)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
    fontSize: "12px",
    fontWeight: "600",
  },
  membershipSection: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  membershipSectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  membershipSectionTitle: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: "700",
  },
  membershipSectionSubtitle: {
    color: "var(--text-muted)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  membershipEmptyState: {
    background: "var(--surface-2)",
    border: "1px dashed var(--border-soft)",
    borderRadius: "16px",
    padding: "18px",
    color: "var(--text-muted)",
    fontSize: "14px",
  },
  membershipModalBody: {
    padding: "22px 28px 24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  membershipListModal: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  membershipItemModal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "18px",
    padding: "16px",
  },
  membershipItemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  membershipClinicIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    background: "var(--icon-bubble-bg)",
    border: "1px solid var(--icon-bubble-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    flexShrink: 0,
  },
  membershipItemBadgeWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
  },
};