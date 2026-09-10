"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Renderiza o conteúdo do modal em `document.body`, para que `position:fixed`
 * escape de qualquer ancestral transformado/animado (ex.: `.page-enter` no
 * detalhe da obra) e o overlay cubra todo o viewport, inclusive a sidebar.
 * Enquanto aberto, torna a sidebar e o workspace `inert`.
 *
 * O portal só é criado no cliente (via `useSyncExternalStore`), para não
 * divergir do HTML do servidor e evitar erro de hidratação.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    const background = Array.from(
      document.querySelectorAll<HTMLElement>("#app-sidebar, .app-shell > .workspace"),
    );
    const restorers = background.map((element) => {
      const alreadyInert = element.hasAttribute("inert");
      element.setAttribute("inert", "");
      return () => {
        if (!alreadyInert) element.removeAttribute("inert");
      };
    });
    return () => restorers.forEach((restore) => restore());
  }, []);

  if (!hydrated) return null;
  return createPortal(children, document.body);
}
