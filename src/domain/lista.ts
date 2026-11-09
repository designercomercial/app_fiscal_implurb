import { estaEmAberto, type Acao, type Prioridade, type StatusAcao } from "./acao";
import { situacaoPrazoDaAcao } from "./prazo";

export type Aba = "pendentes" | "concluidas" | "todas";
export type Ordenacao = "prioridade" | "rota";

export function filtrarPorAba(acoes: readonly Acao[], aba: Aba): Acao[] {
  switch (aba) {
    case "pendentes":
      return acoes.filter((a) => estaEmAberto(a.status));
    case "concluidas":
      return acoes.filter((a) => a.status === "concluida");
    default:
      return [...acoes];
  }
}

const PESO_PRIORIDADE: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };

/** Ações em andamento ficam no topo; as encerradas, no fim. */
const PESO_STATUS: Record<StatusAcao, number> = {
  em_execucao: 0,
  em_deslocamento: 1,
  pendente: 2,
  nao_realizada: 3,
  concluida: 4,
};

const PESO_PRAZO = { atrasada: 0, vence_hoje: 1, no_prazo: 2 } as const;

/**
 * Prioridade: andamento → prioridade → atrasada/vence hoje → prazo → ordem da rota.
 * Rota: ordem_rota crescente (encerradas continuam na posição da rota).
 */
export function ordenar(acoes: readonly Acao[], ordem: Ordenacao, hoje: string): Acao[] {
  const copia = [...acoes];
  if (ordem === "rota") {
    return copia.sort((a, b) => a.ordem_rota - b.ordem_rota || a.codigo.localeCompare(b.codigo));
  }
  return copia.sort(
    (a, b) =>
      PESO_STATUS[a.status] - PESO_STATUS[b.status] ||
      PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
      PESO_PRAZO[situacaoPrazoDaAcao(a, hoje)] - PESO_PRAZO[situacaoPrazoDaAcao(b, hoje)] ||
      a.prazo.localeCompare(b.prazo) ||
      a.ordem_rota - b.ordem_rota,
  );
}
