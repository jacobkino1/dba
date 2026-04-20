import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ManageMenuPortal({
  menuState,
  canReplace,
  canArchive,
  canRestore,
  canDelete,
  onClose,
  onAction,
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

      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleScroll() {
      onClose();
    }

    function handleResize() {
      onClose();
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

  if (!menuState) return null;

  const { doc } = menuState;
  const menuMinWidth = Math.max(170, Math.round(menuState.anchorRect.width));

  const hasVisibleActions =
    canReplace || canArchive || canRestore || canDelete;

  if (!hasVisibleActions) return null;

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Manage actions for ${doc.name}`}
      style={{
        ...styles.menu,
        minWidth: `${menuMinWidth}px`,
        visibility: position ? "visible" : "hidden",
        top: position ? `${position.top}px` : "0px",
        left: position ? `${position.left}px` : "0px",
      }}
    >
      {canReplace && (
        <button
          type="button"
          role="menuitem"
          style={styles.menuItem}
          onClick={() => onAction("Replace", doc)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--table-action-hover-bg)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          Replace
        </button>
      )}

      {doc.status === "Archived" ? (
        canRestore && (
          <button
            type="button"
            role="menuitem"
            style={styles.menuItem}
            onClick={() => onAction("Restore", doc)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--table-action-hover-bg)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Restore
          </button>
        )
      ) : (
        canArchive && (
          <button
            type="button"
            role="menuitem"
            style={styles.menuItem}
            onClick={() => onAction("Archive", doc)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--table-action-hover-bg)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Archive
          </button>
        )
      )}

      {canDelete && (
        <button
          type="button"
          role="menuitem"
          style={styles.menuDanger}
          onClick={() => onAction("Delete", doc)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.12)";
            e.currentTarget.style.color = "var(--danger-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--danger-text)";
          }}
        >
          Delete
        </button>
      )}
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
    animation: "fadeInManageMenu 0.12s ease-out",
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
  menuDanger: {
    background: "transparent",
    color: "var(--danger-text)",
    border: "none",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
    transition: "all 0.15s ease",
  },
};