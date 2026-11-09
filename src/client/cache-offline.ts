import type { RespostaAcoesDoDia } from "@/domain/acao";

/**
 * Guarda a última lista carregada no aparelho, para exibir quando estiver sem internet.
 * Toda leitura/escrita é protegida: webviews podem bloquear o armazenamento.
 */
const CHAVE = "lf:acoes-do-dia:v1";

export interface ListaEmCache {
  resposta: RespostaAcoesDoDia;
  /** ms desde epoch: quando a lista foi recebida do servidor */
  salvoEm: number;
  /** identifica o fiscal para não mostrar a lista de outro fiscal no mesmo aparelho */
  chaveFiscal: string;
}

export function salvarListaEmCache(item: ListaEmCache): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(item));
  } catch {
    /* armazenamento indisponível: segue sem cache */
  }
}

export function lerListaEmCache(chaveFiscal: string): ListaEmCache | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const item = JSON.parse(bruto) as ListaEmCache;
    if (item?.chaveFiscal !== chaveFiscal || !item.resposta?.acoes) return null;
    return item;
  } catch {
    return null;
  }
}
