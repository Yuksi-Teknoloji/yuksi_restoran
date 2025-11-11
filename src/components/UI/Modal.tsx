// src/components/UI/Modal.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

type ModalProps = {
  open?: boolean;                // varsayılan: true
  onClose?: () => void;          // varsayılan: router.back()
  title?: string;
  actions?: React.ReactNode;     // footer butonları
  children: React.ReactNode;
};

export default function Modal({
  open = true,
  onClose,
  title,
  actions,
  children,
}: ModalProps) {
  const router = useRouter();
  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
    else router.back();
  }, [onClose, router]);

  // Esc ile kapat
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} // içeriğe tıklayınca kapanmasın
      >
        {/* Header */}
        {(title || onClose !== null) && (
          <header className="flex items-center justify-between gap-3 px-6 pt-5">
            {title ? (
              <h2 className="text-lg font-semibold text-neutral-800">{title}</h2>
            ) : <span />}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
              aria-label="Kapat"
              title="Kapat"
            >
              ✕
            </button>
          </header>
        )}

        {/* Body */}
        <div className="p-6 pt-4">{children}</div>

        {/* Footer (opsiyonel) */}
        {actions && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200 bg-neutral-50">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
