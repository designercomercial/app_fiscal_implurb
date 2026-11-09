/** Modelo de dados da Ação de fiscalização (Libera Fácil / IMPLURB). */

export const TIPOS_ACAO = [
  "vistoria_obra",
  "vistoria_habite_se",
  "atendimento_denuncia",
  "verificacao_regularizacao",
  "vistoria_publicidade",
] as const;
export type TipoAcao = (typeof TIPOS_ACAO)[number];

export const ORIGENS_ACAO = [
  "rotina",
  "denuncia",
  "habite_se",
  "retorno_notificacao",
  "determinacao_chefia",
  "outro_orgao",
] as const;
export type OrigemAcao = (typeof ORIGENS_ACAO)[number];

export const PRIORIDADES = ["alta", "media", "baixa"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const STATUS_ACAO = [
  "pendente",
  "em_deslocamento",
  "em_execucao",
  "concluida",
  "nao_realizada",
] as const;
export type StatusAcao = (typeof STATUS_ACAO)[number];

export const MOTIVOS_NAO_REALIZADA = [
  "acesso_negado",
  "obra_fechada",
  "endereco_nao_localizado",
  "situacao_risco",
  "outro",
] as const;
export type MotivoNaoRealizada = (typeof MOTIVOS_NAO_REALIZADA)[number];

export interface Acao {
  /** Formato ACAO-AAAA-NNNNNN */
  codigo: string;
  tipo: TipoAcao;
  origem: OrigemAcao;
  prioridade: Prioridade;
  /** AAAA-MM-DD */
  prazo: string;
  status: StatusAcao;
  motivo_nao_realizada?: MotivoNaoRealizada | null;
  /** Texto livre, obrigatório quando motivo_nao_realizada = "outro" */
  motivo_outro?: string | null;
  endereco: string;
  bairro: string;
  ponto_referencia?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  numero_processo?: string | null;
  numero_alvara?: string | null;
  nome_proprietario?: string | null;
  orientacao_chefia?: string | null;
  ordem_rota: number;
  /** ISO 8601 com fuso */
  atualizado_em: string;
}

export const CODIGO_ACAO_REGEX = /^ACAO-\d{4}-\d{6}$/;

export const ROTULO_TIPO: Record<TipoAcao, string> = {
  vistoria_obra: "Vistoria de obra",
  vistoria_habite_se: "Vistoria de Habite-se",
  atendimento_denuncia: "Atendimento a denúncia",
  verificacao_regularizacao: "Verificação de regularização",
  vistoria_publicidade: "Vistoria de publicidade",
};

export const ROTULO_ORIGEM: Record<OrigemAcao, string> = {
  rotina: "Rotina",
  denuncia: "Denúncia",
  habite_se: "Pedido de Habite-se",
  retorno_notificacao: "Retorno de notificação",
  determinacao_chefia: "Determinação da chefia",
  outro_orgao: "Outro órgão",
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const ROTULO_STATUS: Record<StatusAcao, string> = {
  pendente: "Pendente",
  em_deslocamento: "A caminho",
  em_execucao: "Em vistoria",
  concluida: "Concluída",
  nao_realizada: "Não realizada",
};

export const ROTULO_MOTIVO: Record<MotivoNaoRealizada, string> = {
  acesso_negado: "Acesso negado",
  obra_fechada: "Obra fechada",
  endereco_nao_localizado: "Endereço não localizado",
  situacao_risco: "Situação de risco",
  outro: "Outro motivo",
};

/** Status que ainda exigem trabalho do fiscal no dia. */
export const STATUS_EM_ABERTO: readonly StatusAcao[] = [
  "pendente",
  "em_deslocamento",
  "em_execucao",
];

export function estaEmAberto(status: StatusAcao): boolean {
  return STATUS_EM_ABERTO.includes(status);
}

export interface ResumoDia {
  total: number;
  concluidas: number;
  /** pendente + em_deslocamento + em_execucao */
  pendentes: number;
  nao_realizadas: number;
}

export function calcularResumo(acoes: readonly Acao[]): ResumoDia {
  let concluidas = 0;
  let pendentes = 0;
  let nao_realizadas = 0;
  for (const a of acoes) {
    if (a.status === "concluida") concluidas++;
    else if (a.status === "nao_realizada") nao_realizadas++;
    else pendentes++;
  }
  return { total: acoes.length, concluidas, pendentes, nao_realizadas };
}

export interface FiscalResumo {
  nome: string;
  zona: string;
}

export interface RespostaAcoesDoDia {
  fiscal: FiscalResumo;
  /** AAAA-MM-DD */
  data: string;
  resumo: ResumoDia;
  acoes: Acao[];
  /** ISO 8601: quando o servidor gerou a resposta */
  gerado_em: string;
}

export interface CorpoAlterarStatus {
  status: StatusAcao;
  motivo_nao_realizada?: MotivoNaoRealizada;
  motivo_outro?: string;
  /** Status que a página tinha ao pedir a mudança (controle de concorrência). */
  status_anterior?: StatusAcao;
}
