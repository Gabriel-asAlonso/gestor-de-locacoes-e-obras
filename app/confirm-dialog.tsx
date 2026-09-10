"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { ModalPortal } from "./modal-portal";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type ConfirmPrompt = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
};

type ConfirmDialogProps = ConfirmPrompt & { onCancel: () => void };

/**
 * Confirmação do produto — substitui `window.confirm`. Sobrepõe qualquer outro
 * modal: escuta o teclado no `window` em captura para que Esc/Tab ajam só aqui,
 * mesmo quando aberta sobre um formulário já gerenciado pelo shell.
 */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = "Cancelar", tone = "default", onConfirm, onCancel }: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (panel.querySelector<HTMLElement>("[data-confirm-default]") ?? panel).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); return; }
      if (event.key !== "Tab") return;
      event.stopPropagation();
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown, true);
      window.requestAnimationFrame(() => opener?.isConnected && opener.focus());
    };
  }, [onCancel]);

  return (
    <ModalPortal>
      <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <button type="button" className="drawer-backdrop" onClick={onCancel} aria-label={cancelLabel} />
        <div ref={panelRef} tabIndex={-1} className={`receipt-modal confirm-modal confirm-modal-${tone}`}>
          <div className="confirm-modal-body">
            <span className="confirm-modal-icon" aria-hidden="true">{tone === "danger" ? <TriangleAlert /> : <Info />}</span>
            <div><h2 id={titleId}>{title}</h2><p id={messageId}>{message}</p></div>
          </div>
          <footer className="confirm-modal-footer">
            <button type="button" className="secondary-button" onClick={onCancel}>{cancelLabel}</button>
            <button type="button" className={`primary-button ${tone === "danger" ? "confirm-modal-confirm-danger" : ""}`} data-confirm-default onClick={onConfirm}>{confirmLabel}</button>
          </footer>
        </div>
      </div>
    </ModalPortal>
  );
}

/**
 * Protege formulários longos contra fechamento acidental. Ligue `onFormChange`
 * ao `onChange` do <form>, troque o fechar (backdrop/X/Esc) por `requestClose`
 * e renderize `discardDialog` dentro do modal.
 */
export function useDiscardGuard(onClose: () => void, message = "As informações preenchidas neste formulário não serão salvas.") {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const onFormChange = useCallback(() => setDirty(true), []);
  const requestClose = useCallback(() => {
    setDirty((current) => {
      if (current) setConfirming(true);
      else onClose();
      return current;
    });
  }, [onClose]);

  const discardDialog = confirming ? (
    <ConfirmDialog
      title="Descartar alterações?"
      message={message}
      confirmLabel="Descartar"
      cancelLabel="Continuar editando"
      tone="danger"
      onConfirm={onClose}
      onCancel={() => setConfirming(false)}
    />
  ) : null;

  return { dirty, onFormChange, requestClose, discardDialog };
}
