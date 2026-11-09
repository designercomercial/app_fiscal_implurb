"use client";

import { useRef, type KeyboardEvent } from "react";

interface PropsAbas<T extends string> {
  abas: { id: T; rotulo: string }[];
  ativa: T;
  aoMudar: (a: T) => void;
  contagem?: Record<T, number> | null;
  rotulo: string;
  idPainel: string;
}

export const idDaAba = (id: string) => `aba-${id}`;

/** Abas WAI-ARIA (setas, Home, End). Cada aba ocupa a largura do rótulo: cabe em 360 px. */
export function Abas<T extends string>({ abas, ativa, aoMudar, contagem, rotulo, idPainel }: PropsAbas<T>) {
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  const aoTeclar = (e: KeyboardEvent) => {
    const i = abas.findIndex((x) => x.id === ativa);
    let prox = i;
    if (e.key === "ArrowRight") prox = (i + 1) % abas.length;
    else if (e.key === "ArrowLeft") prox = (i - 1 + abas.length) % abas.length;
    else if (e.key === "Home") prox = 0;
    else if (e.key === "End") prox = abas.length - 1;
    else return;
    e.preventDefault();
    const destino = abas[prox].id;
    aoMudar(destino);
    refs.current[destino]?.focus();
  };

  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1 rounded-xl bg-muted p-1" onKeyDown={aoTeclar}>
      {abas.map((a) => {
        const selecionada = a.id === ativa;
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[a.id] = el;
            }}
            id={idDaAba(a.id)}
            type="button"
            role="tab"
            aria-selected={selecionada}
            aria-controls={idPainel}
            tabIndex={selecionada ? 0 : -1}
            onClick={() => aoMudar(a.id)}
            className={`flex min-h-11 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-base font-medium transition-colors ${
              selecionada ? "bg-surface text-fg-strong shadow-[var(--shadow-sm)]" : "text-fg-muted hover:text-fg-strong"
            }`}
          >
            <span>{a.rotulo}</span>{" "}
            {contagem ? <span className="tabular-nums text-fg-muted">({contagem[a.id]})</span> : null}
          </button>
        );
      })}
    </div>
  );
}
