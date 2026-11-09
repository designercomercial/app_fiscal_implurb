import type { AcaoInterna } from "./tipos";

/**
 * Ponto de extensão: regra de negócio do back-end.
 *
 * Uma ação marcada como "nao_realizada" volta para a fila do dia seguinte.
 * O reagendamento (criar nova programação para D+1, mantendo histórico e
 * motivo) é responsabilidade do back-end do Libera Fácil e do módulo de
 * distribuição da chefia. Esta função é chamada logo após a mudança de status
 * ser gravada; implemente aqui a chamada à fila real.
 */
export type ReagendadorNaoRealizada = (acao: AcaoInterna) => Promise<void>;

export const reagendarParaDiaSeguinte: ReagendadorNaoRealizada = async () => {
  // Mock: nada a fazer. A ação continua visível hoje como "Não realizada".
};
