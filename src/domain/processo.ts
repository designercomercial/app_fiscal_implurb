/**
 * Processo de licenciamento visto pelo cidadão (App do Cidadão → Meus Processos).
 * Regras puras, sem acesso a rede ou banco: usadas no servidor e na página.
 */

export type TipoProcesso =
  | "alvara_construcao"
  | "alvara_reforma"
  | "alvara_ampliacao"
  | "alvara_reforma_ampliacao"
  | "alvara_demolicao"
  | "habite_se"
  | "licenca_publicidade";

export type StatusProcesso =
  | "recebido"
  | "em_triagem"
  | "em_analise_tecnica"
  | "pendente_documentacao"
  | "em_aprovacao"
  | "aguardando_pagamento"
  | "vistoria_agendada"
  | "deferido"
  | "indeferido"
  | "documento_emitido"
  | "arquivado";

export type ComQuem = "orgao" | "requerente";
export type Papel = "proprietario" | "responsavel_tecnico" | "despachante";
export type SituacaoPendencia = "aberta" | "respondida" | "atendida";
export type SituacaoGuia = "em_aberto" | "paga" | "vencida";

export interface Participante {
  nome: string;
  papel: Papel;
  documento_mascarado: string;
  /** É a pessoa logada. */
  voce: boolean;
}

export interface EventoHistorico {
  status: StatusProcesso;
  /** ISO 8601 com fuso de Manaus */
  data_hora: string;
  descricao_publica: string;
}

export interface Pendencia {
  id: string;
  texto: string;
  emitida_em: string;
  /** AAAA-MM-DD */
  prazo_resposta: string;
  situacao: SituacaoPendencia;
}

export interface Guia {
  descricao: string;
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  situacao: SituacaoGuia;
}

export interface DocumentoEmitido {
  /** Rótulo do documento, ex.: "Alvará de ampliação" */
  tipo: string;
  numero: string;
  emitido_em: string;
  /** AAAA-MM-DD ou null (Habite-se não vence) */
  validade: string | null;
  url_pdf: string;
  codigo_validacao: string;
}

export interface Processo {
  protocolo: string;
  tipo: TipoProcesso;
  endereco_obra: string;
  bairro_obra: string;
  status: StatusProcesso;
  setor_atual: string;
  /** null quando o processo já terminou */
  com_quem_esta: ComQuem | null;
  dias_na_etapa: number;
  prazo_etapa_dias: number;
  aberto_em: string;
  atualizado_em: string;
  /** Quem deu entrada no pedido (transparência: pode não ser o proprietário). */
  aberto_por: { nome: string; papel: Papel };
  participantes: Participante[];
  historico: EventoHistorico[];
  pendencias: Pendencia[];
  guias: Guia[];
  documentos_emitidos: DocumentoEmitido[];
  /** Papel de quem está logado neste processo. */
  meu_papel: Papel;
}

/** Item da lista: sem participantes, histórico nem documentos. */
export type ProcessoResumo = Pick<
  Processo,
  | "protocolo"
  | "tipo"
  | "endereco_obra"
  | "bairro_obra"
  | "status"
  | "setor_atual"
  | "com_quem_esta"
  | "dias_na_etapa"
  | "prazo_etapa_dias"
  | "atualizado_em"
  | "meu_papel"
> & {
  /** Prazo da próxima coisa que o cidadão precisa fazer (pendência ou guia), se houver. */
  prazo_acao_cidadao: string | null;
};

export interface RespostaMeusProcessos {
  cidadao: { nome: string };
  processos: ProcessoResumo[];
}

/* ------------------------------------------------------------------ Rótulos */

export const ROTULO_TIPO: Record<TipoProcesso, string> = {
  alvara_construcao: "Alvará de construção",
  alvara_reforma: "Alvará de reforma",
  alvara_ampliacao: "Alvará de ampliação",
  alvara_reforma_ampliacao: "Alvará de reforma e ampliação",
  alvara_demolicao: "Alvará de demolição",
  habite_se: "Habite-se",
  licenca_publicidade: "Licença de publicidade",
};

const ROTULO_STATUS_BASE: Record<Exclude<StatusProcesso, "documento_emitido">, string> = {
  recebido: "Recebido",
  em_triagem: "Em triagem",
  em_analise_tecnica: "Em análise técnica",
  pendente_documentacao: "Pendente: aguardando você",
  em_aprovacao: "Em aprovação",
  aguardando_pagamento: "Aguardando pagamento",
  vistoria_agendada: "Vistoria agendada",
  deferido: "Aprovado",
  indeferido: "Não aprovado",
  arquivado: "Arquivado",
};

/** Texto do status para o cidadão. "documento_emitido" depende do tipo do processo. */
export function rotuloStatus(status: StatusProcesso, tipo: TipoProcesso): string {
  if (status === "documento_emitido") {
    if (tipo === "habite_se") return "Habite-se emitido";
    if (tipo === "licenca_publicidade") return "Licença emitida";
    return "Alvará emitido";
  }
  return ROTULO_STATUS_BASE[status];
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  proprietario: "Proprietário",
  responsavel_tecnico: "Responsável técnico",
  despachante: "Despachante",
};

export function textoMeuPapel(p: Papel): string {
  if (p === "proprietario") return "Você é o proprietário";
  if (p === "responsavel_tecnico") return "Você é o responsável técnico";
  return "Você é o despachante";
}

/** Tom do selo. Cor nunca é o único sinal: o selo sempre tem ícone e texto. */
export type TomStatus = "info" | "warning" | "success" | "danger" | "neutro";

export function tomStatus(status: StatusProcesso): TomStatus {
  switch (status) {
    case "pendente_documentacao":
    case "aguardando_pagamento":
      return "warning";
    case "deferido":
    case "documento_emitido":
      return "success";
    case "indeferido":
      return "danger";
    case "arquivado":
      return "neutro";
    default:
      return "info";
  }
}

/* --------------------------------------------------------- Com quem está */

const STATUS_FINAIS: readonly StatusProcesso[] = ["documento_emitido", "indeferido", "arquivado"];
const STATUS_DO_REQUERENTE: readonly StatusProcesso[] = ["pendente_documentacao", "aguardando_pagamento"];

export function processoConcluido(status: StatusProcesso): boolean {
  return STATUS_FINAIS.includes(status);
}

/**
 * Com quem o processo está, derivado do status (fonte única: o servidor grava este valor).
 * Pendência e pagamento dependem do cidadão; processo concluído não está com ninguém.
 */
export function comQuemEsta(status: StatusProcesso): ComQuem | null {
  if (processoConcluido(status)) return null;
  return STATUS_DO_REQUERENTE.includes(status) ? "requerente" : "orgao";
}

export function textoDias(n: number): string {
  return n === 1 ? "1 dia" : `${n} dias`;
}

/** "Com o IMPLURB há 12 dias" ou "Aguardando você". null quando concluído. */
export function textoIndicador(p: Pick<Processo, "com_quem_esta" | "dias_na_etapa">): string | null {
  if (p.com_quem_esta === "requerente") return "Aguardando você";
  if (p.com_quem_esta === "orgao") {
    return p.dias_na_etapa <= 0 ? "Com o IMPLURB desde hoje" : `Com o IMPLURB há ${textoDias(p.dias_na_etapa)}`;
  }
  return null;
}

/* ------------------------------------------------------------------ Abas */

export type AbaProcessos = "andamento" | "concluidos" | "todos";

export function filtrarPorAba<T extends { status: StatusProcesso }>(lista: T[], aba: AbaProcessos): T[] {
  if (aba === "todos") return lista;
  return lista.filter((p) => (aba === "concluidos" ? processoConcluido(p.status) : !processoConcluido(p.status)));
}

/** "Aguardando você" primeiro; depois o atualizado mais recentemente. */
export function ordenarProcessos<T extends Pick<ProcessoResumo, "com_quem_esta" | "atualizado_em">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const pa = a.com_quem_esta === "requerente" ? 0 : 1;
    const pb = b.com_quem_esta === "requerente" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return Date.parse(b.atualizado_em) - Date.parse(a.atualizado_em);
  });
}

/* --------------------------------------------------------- Linha do tempo */

/** Etapas previstas para cada tipo de pedido, na ordem. */
export function etapasDoFluxo(tipo: TipoProcesso): StatusProcesso[] {
  const base: StatusProcesso[] = ["recebido", "em_triagem", "em_analise_tecnica", "em_aprovacao", "aguardando_pagamento"];
  if (tipo === "habite_se") base.push("vistoria_agendada");
  return [...base, "deferido", "documento_emitido"];
}

export interface EtapaLinhaDoTempo {
  status: StatusProcesso;
  rotulo: string;
  situacao: "concluida" | "atual" | "futura";
  data_hora: string | null;
  descricao: string | null;
}

/**
 * Etapas concluídas (do histórico, com data), a etapa atual e as próximas previstas.
 * Com pendência, a etapa interrompida volta a aparecer nas próximas (o processo retoma dela).
 */
export function montarLinhaDoTempo(p: Pick<Processo, "tipo" | "status" | "historico">): EtapaLinhaDoTempo[] {
  const eventos = [...p.historico].sort((a, b) => Date.parse(a.data_hora) - Date.parse(b.data_hora));
  const etapas: EtapaLinhaDoTempo[] = eventos.map((e, i) => ({
    status: e.status,
    rotulo: rotuloStatus(e.status, p.tipo),
    situacao: i === eventos.length - 1 && !processoConcluido(p.status) ? "atual" : "concluida",
    data_hora: e.data_hora,
    descricao: e.descricao_publica,
  }));
  if (eventos.length === 0 || eventos[eventos.length - 1].status !== p.status) {
    etapas.forEach((e) => (e.situacao = "concluida"));
    etapas.push({
      status: p.status,
      rotulo: rotuloStatus(p.status, p.tipo),
      situacao: processoConcluido(p.status) ? "concluida" : "atual",
      data_hora: null,
      descricao: null,
    });
  }
  if (processoConcluido(p.status)) return etapas;

  const fluxo = etapasDoFluxo(p.tipo);
  let indice = -1;
  for (const e of etapas) {
    const i = fluxo.indexOf(e.status);
    if (i >= 0) indice = i;
  }
  const inicio = p.status === "pendente_documentacao" ? Math.max(indice, 0) : indice + 1;
  for (const status of fluxo.slice(inicio)) {
    etapas.push({ status, rotulo: rotuloStatus(status, p.tipo), situacao: "futura", data_hora: null, descricao: null });
  }
  return etapas;
}

/* -------------------------------------------------------------- Protocolo */

export const PROTOCOLO_REGEX = /^\d{4}\.\d{3}\.\d{4}$/;

/** Aceita "2026.000.4587", "20260004587" ou com espaços/traços. null se não for um protocolo. */
export function normalizarProtocolo(entrada: string): string | null {
  const d = entrada.replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`;
}

/* -------------------------------------------------------------- Formatos */

/** "2026-11-05" ou "2026-11-05T14:20:00-04:00" → "05/11/2026" (datas já no fuso de Manaus). */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "05/11/2026 às 14:20" */
export function dataHoraBr(iso: string): string {
  return `${dataBr(iso)} às ${iso.slice(11, 16)}`;
}

/** Dias corridos de `de` até `ate` (AAAA-MM-DD). */
export function diasAte(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate.slice(0, 10)}T12:00:00Z`) - Date.parse(`${de.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

/** "faltam 27 dias", "vence hoje", "venceu há 3 dias" */
export function textoPrazo(prazo: string, hoje: string): string {
  const n = diasAte(hoje, prazo);
  if (n === 0) return "vence hoje";
  if (n > 0) return n === 1 ? "falta 1 dia" : `faltam ${n} dias`;
  return `venceu há ${textoDias(-n)}`;
}

export function moeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export const ROTULO_SITUACAO_GUIA: Record<SituacaoGuia, string> = {
  em_aberto: "Em aberto",
  paga: "Paga",
  vencida: "Vencida",
};

/* ------------------------------------------------------- Consulta pública */

/** Dados mínimos da consulta pública (LGPD): sem nome, documento, endereço completo ou valores. */
export interface ConsultaPublica {
  protocolo: string;
  tipo: TipoProcesso;
  bairro_obra: string;
  status: StatusProcesso;
  atualizado_em: string;
  tem_pendencia_aberta: boolean;
  tem_guia_em_aberto: boolean;
}

/* ------------------------------------------------------------- Validação */

export type ResultadoValidacao =
  | { resultado: "valido"; documento: DocumentoValidado }
  | { resultado: "vencido"; documento: DocumentoValidado & { validade: string } }
  | { resultado: "cancelado_ou_suspenso"; situacao: "cancelado" | "suspenso" }
  | { resultado: "nao_encontrado" };

export interface DocumentoValidado {
  tipo: string;
  numero: string;
  emitido_em: string;
  validade: string | null;
  bairro_obra: string;
  responsavel_tecnico: string;
}

/** Código impresso: letras e números; hífens e espaços são ignorados. */
export function normalizarCodigoValidacao(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Extrai o código de um texto lido no QR Code (URL .../validar?codigo=XXXX ou o próprio código). */
export function codigoDoQr(texto: string): string | null {
  const t = texto.trim();
  try {
    const url = new URL(t);
    const c = url.searchParams.get("codigo");
    return c ? normalizarCodigoValidacao(c) || null : null;
  } catch {
    const c = normalizarCodigoValidacao(t);
    return c.length >= 6 ? c : null;
  }
}

/** "LF7KQ3M9XA2P" → "LF-7KQ3-M9XA-2P" (como sai impresso). */
export function formatarCodigoValidacao(codigo: string): string {
  const c = normalizarCodigoValidacao(codigo);
  return [c.slice(0, 2), c.slice(2, 6), c.slice(6, 10), c.slice(10)].filter(Boolean).join("-");
}
