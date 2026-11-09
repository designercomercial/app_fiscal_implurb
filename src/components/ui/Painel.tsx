"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { useModal } from "./use-modal";

interface PropsPainel {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  /** "sheet": painel inferior alto (detalhe). "dialogo": caixa compacta (confirmações). */
  tipo?: "sheet" | "dialogo";
  role?: "dialog" | "alertdialog";
  testId?: string;
}

/**
 * Painel modal ancorado embaixo (alcance do polegar). Usado como Sheet (detalhe)
 * e como Dialog (motivo). Nunca há dois abertos ao mesmo tempo.
 */
export function Painel({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
  tipo = "sheet",
  role = "dialog",
  testId,
}: PropsPainel) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idSub = useId();
  useModal(ref, aberto, aoFechar);
  if (!aberto) return null;

  const altura = tipo === "sheet" ? "max-h-[92dvh]" : "max-h-[85dvh]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div aria-hidden className="absolute inset-0 bg-overlay" onClick={aoFechar} />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={subtitulo ? idSub : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line-subtle bg-surface outline-none ${altura}`}
      >
        <header className="flex items-start gap-2 border-b border-line-subtle px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={idTitulo} className="text-xl font-semibold leading-snug text-fg-strong">
              {titulo}
            </h2>
            {subtitulo ? (
              <div id={idSub} className="mt-0.5 text-base text-fg-muted">
                {subtitulo}
              </div>
            ) : null}
          </div>
          <IconButton aria-label="Fechar" onClick={aoFechar} icone={<X aria-hidden className="size-6" strokeWidth={2} />} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {rodape ? (
          <footer className="border-t border-line-subtle bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {rodape}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
