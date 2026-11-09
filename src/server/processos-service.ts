import { hojeManaus } from "@/domain/datas";
import {
  comQuemEsta,
  normalizarCodigoValidacao,
  normalizarProtocolo,
  type ConsultaPublica,
  type DocumentoEmitido,
  type Papel,
  type Processo,
  type ProcessoResumo,
  type RespostaMeusProcessos,
  type ResultadoValidacao,
} from "@/domain/processo";
import type { CidadaoAtual } from "./auth-cidadao";
import { mascararDocumento } from "./licencas-service";
import { gerarProcessosMock, type DocumentoInterno, type ProcessoInterno } from "./processos-mock";

/**
 * Meus Processos: regras de acesso e montagem das respostas.
 *
 * Controle de acesso (validado AQUI, no back-end):
 *  - o cidadão só vê processos em que é participante (proprietário, responsável técnico ou despachante);
 *  - processo de outra pessoa responde 404, igual a um protocolo inexistente: não revela que existe.
 * A consulta pública e a validação devolvem só campos escolhidos um a um (LGPD).
 */

export class ErroProcesso extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly codigo: "NAO_ENCONTRADO" | "PROTOCOLO_INVALIDO",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const MENSAGEM_PROTOCOLO_NAO_ENCONTRADO = "Não encontramos este protocolo. Confira o número e tente de novo.";

/** Repositório. O mock fica em memória; o real lê os processos do Libera Fácil. */
export interface ProcessosRepositorio {
  listarTodos(): Promise<ProcessoInterno[]>;
}

export class ProcessosEmMemoria implements ProcessosRepositorio {
  constructor(private readonly processos: ProcessoInterno[]) {}
  async listarTodos() {
    return this.processos;
  }
}

const globalRepo = globalThis as unknown as { __lfProcessos?: { repo: ProcessosEmMemoria; dia: string } };

export function getProcessosRepositorio(): ProcessosRepositorio {
  const hoje = hojeManaus();
  if (!globalRepo.__lfProcessos || globalRepo.__lfProcessos.dia !== hoje) {
    globalRepo.__lfProcessos = { repo: new ProcessosEmMemoria(gerarProcessosMock(hoje)), dia: hoje };
  }
  return globalRepo.__lfProcessos.repo;
}

export function reiniciarProcessosMock() {
  delete globalRepo.__lfProcessos;
}

export interface DepsProcessos {
  repo: ProcessosRepositorio;
  hoje?: () => string;
}

const hojeDe = (deps: DepsProcessos) => (deps.hoje ?? (() => hojeManaus()))();

/* ----------------------------------------------------------- Acesso */

const PRECEDENCIA: Papel[] = ["proprietario", "responsavel_tecnico", "despachante"];

/** Papel do cidadão no processo, ou null se não participa. */
export function papelNoProcesso(p: ProcessoInterno, cidadaoId: string): Papel | null {
  const papeis = p.participantes.filter((x) => x.cidadao_id === cidadaoId).map((x) => x.papel);
  return PRECEDENCIA.find((x) => papeis.includes(x)) ?? null;
}

/* ------------------------------------------------------- Montagem */

function diasDesde(isoDataHora: string, hoje: string): number {
  const dia = hojeManaus(new Date(isoDataHora));
  return Math.max(0, Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000));
}

function eventosOrdenados(p: ProcessoInterno) {
  return [...p.historico].sort((a, b) => Date.parse(a.data_hora) - Date.parse(b.data_hora));
}

function urlPdf(numero: string) {
  return `/api/cidadao/documentos/${encodeURIComponent(numero)}/pdf`;
}

function paraDocumento(d: DocumentoInterno): DocumentoEmitido {
  return {
    tipo: d.tipo,
    numero: d.numero,
    emitido_em: d.emitido_em,
    validade: d.validade,
    url_pdf: urlPdf(d.numero),
    codigo_validacao: d.codigo_validacao,
  };
}

function prazoAcaoCidadao(p: ProcessoInterno): string | null {
  if (p.status === "pendente_documentacao") {
    const prazos = p.pendencias.filter((x) => x.situacao === "aberta").map((x) => x.prazo_resposta).sort();
    return prazos[0] ?? null;
  }
  if (p.status === "aguardando_pagamento") {
    const venc = p.guias.filter((g) => g.situacao !== "paga").map((g) => g.vencimento).sort();
    return venc[0] ?? null;
  }
  return null;
}

export function paraProcessoCidadao(p: ProcessoInterno, cidadaoId: string, papel: Papel, hoje: string): Processo {
  const eventos = eventosOrdenados(p);
  const ultimo = eventos[eventos.length - 1];
  const abridor = p.participantes.find((x) => x.cidadao_id === p.aberto_por_id);
  return {
    protocolo: p.protocolo,
    tipo: p.tipo,
    endereco_obra: p.endereco_obra,
    bairro_obra: p.bairro_obra,
    status: p.status,
    setor_atual: p.setor_atual,
    com_quem_esta: comQuemEsta(p.status),
    dias_na_etapa: ultimo ? diasDesde(ultimo.data_hora, hoje) : 0,
    prazo_etapa_dias: p.prazo_etapa_dias,
    aberto_em: eventos[0]?.data_hora ?? "",
    atualizado_em: ultimo?.data_hora ?? "",
    aberto_por: abridor ? { nome: abridor.nome, papel: abridor.papel } : { nome: "Não informado", papel: "proprietario" },
    participantes: p.participantes.map((x) => ({
      nome: x.nome,
      papel: x.papel,
      documento_mascarado: mascararDocumento(x.documento),
      voce: x.cidadao_id === cidadaoId,
    })),
    historico: eventos,
    pendencias: p.pendencias,
    guias: p.guias,
    documentos_emitidos: p.documentos.map(paraDocumento),
    meu_papel: papel,
  };
}

function paraResumo(p: Processo, prazo: string | null): ProcessoResumo {
  return {
    protocolo: p.protocolo,
    tipo: p.tipo,
    endereco_obra: p.endereco_obra,
    bairro_obra: p.bairro_obra,
    status: p.status,
    setor_atual: p.setor_atual,
    com_quem_esta: p.com_quem_esta,
    dias_na_etapa: p.dias_na_etapa,
    prazo_etapa_dias: p.prazo_etapa_dias,
    atualizado_em: p.atualizado_em,
    meu_papel: p.meu_papel,
    prazo_acao_cidadao: prazo,
  };
}

/* ------------------------------------------------------- Com login */

export async function listarMeusProcessos(deps: DepsProcessos, cidadao: CidadaoAtual): Promise<RespostaMeusProcessos> {
  const hoje = hojeDe(deps);
  const todos = await deps.repo.listarTodos();
  const processos: ProcessoResumo[] = [];
  for (const p of todos) {
    const papel = papelNoProcesso(p, cidadao.id);
    if (papel) processos.push(paraResumo(paraProcessoCidadao(p, cidadao.id, papel, hoje), prazoAcaoCidadao(p)));
  }
  return { cidadao: { nome: cidadao.nome }, processos };
}

async function processoDoParticipante(deps: DepsProcessos, cidadao: CidadaoAtual, protocolo: string) {
  const normal = normalizarProtocolo(protocolo);
  const p = normal ? (await deps.repo.listarTodos()).find((x) => x.protocolo === normal) : undefined;
  const papel = p ? papelNoProcesso(p, cidadao.id) : null;
  // Inexistente ou de outra pessoa: mesma resposta.
  if (!p || !papel) throw new ErroProcesso(404, "NAO_ENCONTRADO", "Não encontramos este processo entre os seus.");
  return { p, papel };
}

export async function obterMeuProcesso(deps: DepsProcessos, cidadao: CidadaoAtual, protocolo: string): Promise<Processo> {
  const { p, papel } = await processoDoParticipante(deps, cidadao, protocolo);
  return paraProcessoCidadao(p, cidadao.id, papel, hojeDe(deps));
}

/** PDF do documento: só para participantes do processo que o emitiu. */
export async function obterDocumentoDoParticipante(deps: DepsProcessos, cidadao: CidadaoAtual, numero: string) {
  const alvo = numero.trim().toUpperCase();
  for (const p of await deps.repo.listarTodos()) {
    const d = p.documentos.find((x) => x.numero === alvo);
    if (d && papelNoProcesso(p, cidadao.id)) {
      return { documento: d, processo: p, responsavel: responsavelTecnico(p) };
    }
  }
  throw new ErroProcesso(404, "NAO_ENCONTRADO", "Documento não encontrado.");
}

/* -------------------------------------------------------- Públicas */

export async function consultarPublico(deps: DepsProcessos, protocolo: string): Promise<ConsultaPublica> {
  const normal = normalizarProtocolo(protocolo);
  if (!normal) throw new ErroProcesso(400, "PROTOCOLO_INVALIDO", "Digite o protocolo completo, como 2026.000.4587.");
  const p = (await deps.repo.listarTodos()).find((x) => x.protocolo === normal);
  if (!p) throw new ErroProcesso(404, "NAO_ENCONTRADO", MENSAGEM_PROTOCOLO_NAO_ENCONTRADO);
  const eventos = eventosOrdenados(p);
  // Campos escolhidos um a um: nada de nome, documento, endereço completo ou valores.
  return {
    protocolo: p.protocolo,
    tipo: p.tipo,
    bairro_obra: p.bairro_obra,
    status: p.status,
    atualizado_em: eventos[eventos.length - 1]?.data_hora ?? "",
    tem_pendencia_aberta: p.pendencias.some((x) => x.situacao === "aberta"),
    tem_guia_em_aberto: p.guias.some((g) => g.situacao !== "paga"),
  };
}

function responsavelTecnico(p: ProcessoInterno): string {
  return p.participantes.find((x) => x.papel === "responsavel_tecnico")?.nome ?? "Não informado";
}

export async function validarDocumento(deps: DepsProcessos, codigo: string): Promise<ResultadoValidacao> {
  const alvo = normalizarCodigoValidacao(codigo);
  if (!alvo) return { resultado: "nao_encontrado" };
  for (const p of await deps.repo.listarTodos()) {
    const d = p.documentos.find((x) => x.codigo_validacao === alvo);
    if (!d) continue;
    // Cancelado ou suspenso: aviso claro, sem dados adicionais.
    if (d.situacao_cadastro !== "ativo") return { resultado: "cancelado_ou_suspenso", situacao: d.situacao_cadastro === "cancelado" ? "cancelado" : "suspenso" };
    const documento = {
      tipo: d.tipo,
      numero: d.numero,
      emitido_em: d.emitido_em,
      validade: d.validade,
      bairro_obra: p.bairro_obra,
      responsavel_tecnico: responsavelTecnico(p),
    };
    if (d.validade && d.validade < hojeDe(deps)) return { resultado: "vencido", documento: { ...documento, validade: d.validade } };
    return { resultado: "valido", documento };
  }
  return { resultado: "nao_encontrado" };
}
