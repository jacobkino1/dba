import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function UserManageMenuPortal({
  menuState,
  onClose,
  onAction,
  onDeleteUser,
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!menuState || !menuRef.current) {
      setPosition(null);
      return;
    }

    const margin = 12;
    const offset = 8;
    const anchorRect = menuState.anchorRect;
    const menuRect = menuRef.current.getBoundingClientRect();

    let left = anchorRect.right - menuRect.width;
    let top = anchorRect.bottom + offset;

    const maxLeft = window.innerWidth - menuRect.width - margin;
    left = Math.max(margin, Math.min(left, maxLeft));

    const fitsBelow =
      anchorRect.bottom + offset + menuRect.height <=
      window.innerHeight - margin;
    const fitsAbove =
      anchorRect.top - offset - menuRect.height >= margin;

    if (!fitsBelow && fitsAbove) {
      top = anchorRect.top - menuRect.height - offset;
    } else if (!fitsBelow) {
      top = Math.max(margin, window.innerHeight - menuRect.height - margin);
    }

    setPosition({ top, left });
  }, [menuState]);

  useEffect(() => {
    if (!menuState) return;

    function handlePointerDown(event) {
      const target = event.target;

      if (menuRef.current?.contains(target)) return;
      if (menuState.anchorElement?.contains(target)) return;

      onClose?.();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    function handleScroll() {
      onClose?.();
    }

    function handleResize() {
      onClose?.();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [menuState, onClose]);

  const actions = useMemo(() => {
    if (!menuState?.user) return [];

    const user = menuState.user;
    const isDisabled = String(user.status || "").toLowerCase() === "disabled";

    const resetPasswordAction = {
      key: "reset-password",
      label: "Reset Password",
      visible: user.hideResetPassword !== true,
      disabled: user.canResetPassword === false,
      disabledReason:
        user.resetPasswordReason || "This action is not available for this user.",
      variant: "default",
      onClick: () => {
        if (user.canResetPassword === false) return;
        onAction?.("reset-password", user);
      },
    };

    const toggleStatusAction = {
      key: isDisabled ? "enable" : "disable",
      label: isDisabled ? "Enable" : "Disable",
      visible: user.hideToggleStatus !== true,
      disabled: user.canToggleStatus === false,
      disabledReason:
        user.toggleStatusReason || "This account status cannot be changed.",
      variant: "default",
      onClick: () => {
        if (user.canToggleStatus === false) return;
        onAction?.(isDisabled ? "enable" : "disable", user);
      },
    };

    const deleteAction = {
      key: "delete-user",
      label: "Delete User",
      visible: user.hideDelete !== true,
      disabled: user.canDelete === false,
      disabledReason: user.deleteReason || "This user cannot be deleted.",
      variant: "danger",
      onClick: () => {
        if (user.canDelete === false) return;
        onDeleteUser?.(user);
      },
    };

    return [resetPasswordAction, toggleStatusAction, deleteAction].filter(
      (action) => action.visible
    );
  }, [menuState, onAction, onDeleteUser]);

  if (!menuState) return null;

  const { user } = menuState;
  const menuMinWidth = Math.max(220, Math.round(menuState.anchorRect.width));
  const hasPrimaryActions = actions.some((action) => action.variant !== "danger");

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Manage actions for ${user.displayName}`}
      style={{
        ...styles.menu,
        minWidth: `${menuMinWidth}px`,
        visibility: position ? "visible" : "hidden",
        top: position ? `${position.top}px` : "0px",
        left: position ? `${position.left}px` : "0px",
      }}
    >
      {actions.map((action, index) => {
        const showDividerBefore =
          action.variant === "danger" &&
          hasPrimaryActions &&
          index > 0 &&
          actions[index - 1]?.variant !== "danger";

        return (
          <div key={action.key}>
            {showDividerBefore ? <div style={styles.menuDivider} /> : null}

            <button
              type="button"
              role="menuitem"
              title={action.disabled ? action.disabledReason : ""}
              disabled={action.disabled}
              aria-disabled={action.disabled}
              style={{
                ...(action.variant === "danger"
                  ? styles.menuItemDanger
                  : styles.menuItem),
                ...(action.disabled ? styles.menuItemDisabled : null),
              }}
              onClick={action.onClick}
              onMouseEnter={(e) => {
                if (action.disabled) return;

                if (action.variant === "danger") {
                  e.currentTarget.style.background = "rgba(244,63,94,0.12)";
                  e.currentTarget.style.color = "var(--danger-text)";
                } else {
                  e.currentTarget.style.background =
                    "var(--table-action-hover-bg)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (action.disabled) return;

                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color =
                  action.variant === "danger"
                    ? "var(--danger-text)"
                    : "var(--text-secondary)";
              }}
            >
              <div style={styles.menuItemLabel}>{action.label}</div>

              {action.disabled && action.disabledReason ? (
                <div style={styles.menuItemReason}>{action.disabledReason}</div>
              ) : null}
            </button>
          </div>
        );
      })}

      {!actions.length ? (
        <div style={styles.emptyState}>No actions available for this user.</div>
      ) : null}
    </div>
  );

  return createPortal(menu, document.body);
}

const styles = {
  menu: {
    position: "fixed",
    zIndex: 1300,
    background: "var(--modal-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "14px",
    boxShadow: "var(--shadow-strong)",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  menuItem: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
    transition: "all 0.15s ease",
  },
  menuItemDanger: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "var(--danger-text)",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  menuItemDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    background: "rgba(148,163,184,0.04)",
  },
  menuItemLabel: {
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  menuItemReason: {
    marginTop: "4px",
    fontSize: "11px",
    lineHeight: 1.35,
    color: "var(--text-muted)",
  },
  menuDivider: {
    height: "1px",
    background: "var(--divider)",
    margin: "6px 0",
  },
  emptyState: {
    padding: "10px 12px",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
};