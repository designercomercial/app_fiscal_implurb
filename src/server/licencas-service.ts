import { agoraIsoManaus, hojeManaus } from "@/domain/datas";
import {
  ALVARA_REGEX,
  filtrarLicencas,
  interpretarBusca,
  LIMITE_RESULTADOS,
  paraResumo,
  PROCESSO_REGEX,
  TAMANHO_MINIMO_BUSCA,
  type Licenca,
  type RespostaBuscaLicencas,
} from "@/domain/licenca";
import type { FiscalAtual } from "./auth";
import { gerarLicencasMock, type LicencaInterna } from "./licencas-mock";

/**
 * Consulta de licenças de obra.
 * Qualquer fiscal autenticado pode consultar; toda consulta fica registrada (quem, o quê, quando).
 */

export class ErroLicenca extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly codigo: "BUSCA_CURTA" | "LICENCA_NAO_ENCONTRADA",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export interface RegistroConsulta {
  usuario_id: string;
  tipo: "busca" | "detalhe";
  termo: string;
  em: string;
}

/** Repositório. O mock fica em memória; o real lê o cadastro de licenças do Libera Fácil. */
export interface LicencasRepositorio {
  listarTodas(): Promise<LicencaInterna[]>;
  registrarConsulta(r: RegistroConsulta): Promise<void>;
  listarConsultas(): Promise<RegistroConsulta[]>;
}

export class LicencasEmMemoria implements LicencasRepositorio {
  private consultas: RegistroConsulta[] = [];
  constructor(private readonly licencas: LicencaInterna[]) {}
  async listarTodas() {
    return this.licencas;
  }
  async registrarConsulta(r: RegistroConsulta) {
    this.consultas.push(r);
  }
  async listarConsultas() {
    return [...this.consultas];
  }
}

const globalRepo = globalThis as unknown as { __lfLicencas?: { repo: LicencasEmMemoria; dia: string } };

export function getLicencasRepositorio(): LicencasRepositorio {
  const hoje = hojeManaus();
  if (!globalRepo.__lfLicencas || globalRepo.__lfLicencas.dia !== hoje) {
    globalRepo.__lfLicencas = { repo: new LicencasEmMemoria(gerarLicencasMock(hoje)), dia: hoje };
  }
  return globalRepo.__lfLicencas.repo;
}

/** LGPD: o documento do proprietário nunca sai completo do servidor. */
export function mascararDocumento(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return "Não informado";
}

export function paraLicencaPublica(l: LicencaInterna): Licenca {
  return {
    ...l,
    proprietario: { nome: l.proprietario.nome, documento_mascarado: mascararDocumento(l.proprietario.documento) },
  };
}

interface Deps {
  repo: LicencasRepositorio;
  agora?: () => Date;
}

export async function buscarLicencas(deps: Deps, fiscal: FiscalAtual, termo: string): Promise<RespostaBuscaLicencas> {
  const busca = interpretarBusca(termo);
  if (!busca) {
    throw new ErroLicenca(400, "BUSCA_CURTA", `Digite pelo menos ${TAMANHO_MINIMO_BUSCA} caracteres.`);
  }
  await deps.repo.registrarConsulta({
    usuario_id: fiscal.id,
    tipo: "busca",
    termo: termo.trim(),
    em: agoraIsoManaus(deps.agora?.() ?? new Date()),
  });
  const encontradas = filtrarLicencas(await deps.repo.listarTodas(), busca);
  return {
    termo: termo.trim(),
    tipo_busca: busca.tipo,
    resultados: encontradas.slice(0, LIMITE_RESULTADOS).map((l) => paraResumo(paraLicencaPublica(l))),
    truncado: encontradas.length > LIMITE_RESULTADOS,
  };
}

/** Detalhe por número de alvará ou, para pedidos em análise, por número de processo. */
export async function obterLicenca(deps: Deps, fiscal: FiscalAtual, numero: string): Promise<Licenca> {
  const n = numero.trim().toUpperCase();
  if (!ALVARA_REGEX.test(n) && !PROCESSO_REGEX.test(n)) {
    throw new ErroLicenca(404, "LICENCA_NAO_ENCONTRADA", "Licença não encontrada.");
  }
  const l = (await deps.repo.listarTodas()).find((x) => x.numero_alvara === n || x.numero_processo === n);
  if (!l) throw new ErroLicenca(404, "LICENCA_NAO_ENCONTRADA", "Licença não encontrada.");
  await deps.repo.registrarConsulta({
    usuario_id: fiscal.id,
    tipo: "detalhe",
    termo: n,
    em: agoraIsoManaus(deps.agora?.() ?? new Date()),
  });
  return paraLicencaPublica(l);
}
