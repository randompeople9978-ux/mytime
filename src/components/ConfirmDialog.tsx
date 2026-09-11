import type { ReactNode } from "react";

export function ConfirmDialog({
  open, title, message, confirmLabel = "Ya, lanjutkan", cancelLabel = "Batal",
  danger = false, onConfirm, onCancel, children,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: "var(--surface)", width: "100%", maxWidth: 380, padding: 22, borderRadius: 18 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>{title}</h3>
        {message && <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.5 }}>{message}</p>}
        {children}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} style={{ flex: 1 }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
