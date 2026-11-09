import { hojeManaus } from "@/domain/datas";
import { gerarAcoesMock } from "./mock-data";
import type { AcaoInterna, RegistroAuditoria } from "./tipos";

/**
 * Repositório de ações. A implementação em memória serve ao mock; o back-end real
 * do Libera Fácil deve implementar a mesma interface (banco de dados).
 */
export interface AcoesRepositorio {
  listarPorFiscalEData(fiscalId: string, data: string): Promise<AcaoInterna[]>;
  buscar(codigo: string): Promise<AcaoInterna | null>;
  salvar(acao: AcaoInterna): Promise<void>;
  registrarAuditoria(registro: RegistroAuditoria): Promise<void>;
  listarAuditoria(codigo: string): Promise<RegistroAuditoria[]>;
}

export class RepositorioEmMemoria implements AcoesRepositorio {
  private acoes = new Map<string, AcaoInterna>();
  private auditoria: RegistroAuditoria[] = [];

  constructor(iniciais: AcaoInterna[] = []) {
    for (const a of iniciais) this.acoes.set(a.codigo, structuredClone(a));
  }

  async listarPorFiscalEData(fiscalId: string, data: string) {
    return [...this.acoes.values()]
      .filter((a) => a.fiscal_id === fiscalId && a.data_programada === data)
      .map((a) => structuredClone(a));
  }

  async buscar(codigo: string) {
    const a = this.acoes.get(codigo);
    return a ? structuredClone(a) : null;
  }

  async salvar(acao: AcaoInterna) {
    this.acoes.set(acao.codigo, structuredClone(acao));
  }

  async registrarAuditoria(registro: RegistroAuditoria) {
    this.auditoria.push({ ...registro });
  }

  async listarAuditoria(codigo: string) {
    return this.auditoria.filter((r) => r.codigo_acao === codigo);
  }
}

/** Instância única do mock, preservada entre recargas do servidor de desenvolvimento. */
const globalRepo = globalThis as unknown as {
  __lfRepo?: { repo: RepositorioEmMemoria; dia: string };
};

export function getRepositorio(): AcoesRepositorio {
  const hoje = hojeManaus();
  // Recria os dados mock quando o dia muda, para que sempre haja "ações do dia".
  if (!globalRepo.__lfRepo || globalRepo.__lfRepo.dia !== hoje) {
    globalRepo.__lfRepo = { repo: new RepositorioEmMemoria(gerarAcoesMock(hoje)), dia: hoje };
  }
  return globalRepo.__lfRepo.repo;
}

/** Só para testes/desenvolvimento: volta o mock ao estado inicial. */
export function reiniciarRepositorioMock(): void {
  globalRepo.__lfRepo = undefined;
}
