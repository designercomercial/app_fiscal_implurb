import { estaEmAberto, type Acao } from "./acao";

export type SituacaoPrazo = "atrasada" | "vence_hoje" | "no_prazo";

/** Compara datas AAAA-MM-DD (ordem lexicográfica = ordem cronológica). */
export function situacaoPrazo(prazo: string, hoje: string): SituacaoPrazo {
  if (prazo < hoje) return "atrasada";
  if (prazo === hoje) return "vence_hoje";
  return "no_prazo";
}

/** Só faz sentido alertar sobre prazo de ação que ainda está em aberto. */
export function situacaoPrazoDaAcao(acao: Pick<Acao, "prazo" | "status">, hoje: string): SituacaoPrazo {
  if (!estaEmAberto(acao.status)) return "no_prazo";
  return situacaoPrazo(acao.prazo, hoje);
}
