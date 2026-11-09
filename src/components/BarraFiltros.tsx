"use client";

import { useRef, type KeyboardEvent } from "react";
import type { Aba, Ordenacao } from "@/domain/lista";

export const ID_PAINEL_LISTA = "painel-lista";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "pendentes", rotulo: "Pendentes" },
  { id: "concluidas", rotulo: "Concluídas" },
  { id: "todas", rotulo: "Todas" },
];

interface PropsFiltros {
  aba: Aba;
  aoMudarAba: (a: Aba) => void;
  contagem: Record<Aba, number> | null;
  ordem: Ordenacao;
  aoMudarOrdem: (o: Ordenacao) => void;
}

export function idAba(a: Aba) {
  return `aba-${a}`;
}

export function BarraFiltros({ aba, aoMudarAba, contagem, ordem, aoMudarOrdem }: PropsFiltros) {
  const refs = useRef<Record<Aba, HTMLButtonElement | null>>({ pendentes: null, concluidas: null, todas: null });

  // Setas esquerda/direita, Home e End navegam entre abas (padrão WAI-ARIA).
  const aoTeclar = (e: KeyboardEvent) => {
    const i = ABAS.findIndex((x) => x.id === aba);
    let prox = i;
    if (e.key === "ArrowRight") prox = (i + 1) % ABAS.length;
    else if (e.key === "ArrowLeft") prox = (i - 1 + ABAS.length) % ABAS.length;
    else if (e.key === "Home") prox = 0;
    else if (e.key === "End") prox = ABAS.length - 1;
    else return;
    e.preventDefault();
    const destino = ABAS[prox].id;
    aoMudarAba(destino);
    refs.current[destino]?.focus();
  };

  return (
    <div className="space-y-3 px-4 pt-4">
      {/* flex-auto: cada aba ocupa a largura do próprio rótulo (cabe em 360 px). */}
      <div role="tablist" aria-label="Filtrar ações" className="flex gap-1 rounded-xl bg-muted p-1" onKeyDown={aoTeclar}>
        {ABAS.map((a) => {
          const ativa = a.id === aba;
          return (
            <button
              key={a.id}
              ref={(el) => {
                refs.current[a.id] = el;
              }}
              id={idAba(a.id)}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={ID_PAINEL_LISTA}
              tabIndex={ativa ? 0 : -1}
              onClick={() => aoMudarAba(a.id)}
              className={`flex min-h-11 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-base font-medium transition-colors ${
                ativa ? "bg-surface text-fg-strong shadow-[var(--shadow-sm)]" : "text-fg-muted hover:text-fg-strong"
              }`}
            >
              <span>{a.rotulo}</span>{" "}
              {contagem ? <span className="tabular-nums text-fg-muted">({contagem[a.id]})</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span id="rotulo-ordenacao" className="text-base text-fg-muted">
          Ordenar por
        </span>
        <div role="group" aria-labelledby="rotulo-ordenacao" className="flex gap-1">
          {(
            [
              { id: "prioridade", rotulo: "Prioridade" },
              { id: "rota", rotulo: "Rota" },
            ] as const
          ).map((o) => {
            const ativa = o.id === ordem;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={ativa}
                onClick={() => aoMudarOrdem(o.id)}
                className={`min-h-11 rounded-lg border px-3 text-base font-medium transition-colors ${
                  ativa
                    ? "border-brand bg-brand-subtle text-brand-fg"
                    : "border-line-subtle bg-surface text-fg-muted hover:text-fg-strong"
                }`}
              >
                {o.rotulo}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
