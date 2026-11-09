"use client";

import { useEffect, type RefObject } from "react";

const FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de modal acessível: foco inicial dentro do painel, foco preso (Tab),
 * Esc fecha, rolagem do fundo travada e foco devolvido ao elemento de origem.
 */
export function useModal(painel: RefObject<HTMLElement | null>, aberto: boolean, aoFechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const el = painel.current;
    const inicial =
      el?.querySelector<HTMLElement>("[data-foco-inicial]") ?? el?.querySelector<HTMLElement>(FOCAVEIS) ?? el;
    inicial?.focus();

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const itens = Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      if (anterior && document.contains(anterior)) anterior.focus();
    };
    // aoFechar muda a cada render; o efeito só deve rodar ao abrir/fechar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
}
