import { somarDias } from "./datas";

/** Licença (alvará) de obra, como a página do fiscal a vê. */

export const TIPOS_OBRA = ["construcao", "reforma", "ampliacao", "demolicao"] as const;
export type TipoObra = (typeof TIPOS_OBRA)[number];

export const USOS = ["residencial", "comercial", "misto", "institucional"] as const;
export type UsoObra = (typeof USOS)[number];

/** Status gravado no cadastro. "Vencida" e "vence em breve" são calculados pela validade. */
export const STATUS_CADASTRO = ["ativa", "suspensa", "cancelada", "em_analise"] as const;
export type StatusCadastro = (typeof STATUS_CADASTRO)[number];

export type SituacaoLicenca =
  | "valida"
  | "vence_em_breve"
  | "vencida"
  | "suspensa"
  | "cancelada"
  | "em_analise";

/** Dias antes da validade em que a licença passa a "vence em breve". */
export const DIAS_ALERTA_VENCIMENTO = 30;

export interface ResponsavelTecnico {
  nome: string;
  conselho: "CREA" | "CAU";
  registro: string;
  /** Número da ART (CREA) ou RRT (CAU) */
  art_rrt: string;
}

export interface EventoHistorico {
  /** AAAA-MM-DD */
  data: string;
  evento: string;
  descricao?: string | null;
}

export interface Licenca {
  /** ALV-AAAA-NNNNN. Nulo enquanto o pedido está em análise. */
  numero_alvara: string | null;
  numero_processo: string;
  tipo_obra: TipoObra;
  uso: UsoObra;
  status_cadastro: StatusCadastro;
  /** Motivo da suspensão/cancelamento, quando houver. */
  motivo_status?: string | null;
  endereco: string;
  bairro: string;
  latitude?: number | null;
  longitude?: number | null;
  /** AAAA-MM-DD */
  data_emissao: string | null;
  /** AAAA-MM-DD */
  validade: string | null;
  area_aprovada_m2: number;
  pavimentos: number;
  condicionantes: string[];
  proprietario: {
    nome: string;
    /** Sempre mascarado na API (LGPD). */
    documento_mascarado: string;
  };
  responsavel_tecnico: ResponsavelTecnico | null;
  historico: EventoHistorico[];
  /** ISO 8601 */
  atualizado_em: string;
}

/** Item da lista de resultados. */
export interface LicencaResumo {
  numero_alvara: string | null;
  numero_processo: string;
  tipo_obra: TipoObra;
  uso: UsoObra;
  status_cadastro: StatusCadastro;
  endereco: string;
  bairro: string;
  validade: string | null;
}

export type TipoBusca = "alvara" | "processo" | "endereco";

export interface RespostaBuscaLicencas {
  termo: string;
  tipo_busca: TipoBusca;
  resultados: LicencaResumo[];
  /** Havia mais resultados que o limite. */
  truncado: boolean;
}

export const LIMITE_RESULTADOS = 20;
export const TAMANHO_MINIMO_BUSCA = 3;

export const ROTULO_TIPO_OBRA: Record<TipoObra, string> = {
  construcao: "Construção",
  reforma: "Reforma",
  ampliacao: "Ampliação",
  demolicao: "Demolição",
};

export const ROTULO_USO: Record<UsoObra, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  misto: "Misto",
  institucional: "Institucional",
};

export const ROTULO_SITUACAO: Record<SituacaoLicenca, string> = {
  valida: "Válida",
  vence_em_breve: "Vence em breve",
  vencida: "Vencida",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
  em_analise: "Em análise",
};

export const ROTULO_TIPO_BUSCA: Record<TipoBusca, string> = {
  alvara: "número de alvará",
  processo: "número de processo",
  endereco: "endereço ou bairro",
};

export function situacaoLicenca(
  l: Pick<Licenca, "status_cadastro" | "validade">,
  hoje: string,
): SituacaoLicenca {
  if (l.status_cadastro !== "ativa") return l.status_cadastro;
  if (!l.validade || l.validade < hoje) return "vencida";
  if (l.validade <= somarDias(hoje, DIAS_ALERTA_VENCIMENTO)) return "vence_em_breve";
  return "valida";
}

/** Diferença em dias entre duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** "15/03/2027" */
export function dataBr(dataIso: string): string {
  const [a, m, d] = dataIso.split("-");
  return `${d}/${m}/${a}`;
}

/** Frase curta sobre a validade, para o fiscal ler de relance. */
export function textoValidade(
  l: Pick<Licenca, "status_cadastro" | "validade" | "motivo_status" | "historico">,
  hoje: string,
): string {
  const s = situacaoLicenca(l, hoje);
  switch (s) {
    case "em_analise": {
      const inicio = l.historico[0]?.data;
      return inicio ? `Pedido em análise desde ${dataBr(inicio)}. Ainda não há alvará emitido.` : "Pedido em análise. Ainda não há alvará emitido.";
    }
    case "suspensa":
    case "cancelada":
      return l.motivo_status ?? (s === "suspensa" ? "Alvará suspenso." : "Alvará cancelado.");
    case "vencida": {
      if (!l.validade) return "Sem data de validade registrada.";
      const dias = diasEntre(l.validade, hoje);
      return `Venceu em ${dataBr(l.validade)} (há ${dias} ${dias === 1 ? "dia" : "dias"}).`;
    }
    case "vence_em_breve": {
      const dias = diasEntre(hoje, l.validade!);
      if (dias === 0) return `Vence hoje (${dataBr(l.validade!)}).`;
      return `Vence em ${dias} ${dias === 1 ? "dia" : "dias"} (${dataBr(l.validade!)}).`;
    }
    default:
      return `Válida até ${dataBr(l.validade!)}.`;
  }
}

/** Identificador estável da licença: alvará, ou processo enquanto em análise. */
export function idLicenca(l: Pick<Licenca, "numero_alvara" | "numero_processo">): string {
  return l.numero_alvara ?? l.numero_processo;
}

export function paraResumo(l: Licenca): LicencaResumo {
  return {
    numero_alvara: l.numero_alvara,
    numero_processo: l.numero_processo,
    tipo_obra: l.tipo_obra,
    uso: l.uso,
    status_cadastro: l.status_cadastro,
    endereco: l.endereco,
    bairro: l.bairro,
    validade: l.validade,
  };
}

/* ------------------------------------------------------------------ busca */

export const ALVARA_REGEX = /^ALV-\d{4}-\d{5}$/;
export const PROCESSO_REGEX = /^\d{4}\.\d{3}\.\d{4}$/;

/** Sem acentos, minúsculas e espaços simples: "Adrianópolis" casa com "adrianopolis". */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface BuscaInterpretada {
  tipo: TipoBusca;
  /** Termo normalizado para comparação. */
  valor: string;
}

/**
 * Um campo só: o formato diz o tipo.
 *  - começa com "ALV" → alvará (aceita parcial: "ALV-2026-004")
 *  - só dígitos e pontos, começando com 4 dígitos → processo (aceita parcial)
 *  - o resto → endereço ou bairro
 * Retorna null quando o termo é curto demais.
 */
export function interpretarBusca(termo: string): BuscaInterpretada | null {
  const t = termo.trim();
  if (t.length < TAMANHO_MINIMO_BUSCA) return null;
  const compacto = t.replace(/\s+/g, "").toUpperCase();
  if (/^ALV/.test(compacto)) return { tipo: "alvara", valor: compacto };
  if (/^\d{4}[\d.]*$/.test(compacto)) return { tipo: "processo", valor: compacto };
  return { tipo: "endereco", valor: normalizarTexto(t) };
}

/** Pontuação de correspondência (0 = não corresponde; maior = melhor). */
export function pontuarCorrespondencia(
  l: Pick<Licenca, "numero_alvara" | "numero_processo" | "endereco" | "bairro">,
  busca: BuscaInterpretada,
): number {
  if (busca.tipo === "alvara") {
    const alv = l.numero_alvara ?? "";
    if (alv === busca.valor) return 3;
    return alv.startsWith(busca.valor) ? 1 : 0;
  }
  if (busca.tipo === "processo") {
    if (l.numero_processo === busca.valor) return 3;
    // "20260004587" casa com "2026.000.4587"
    const soDigitos = l.numero_processo.replace(/\D/g, "");
    const buscado = busca.valor.replace(/\D/g, "");
    if (soDigitos === buscado) return 3;
    return l.numero_processo.startsWith(busca.valor) || soDigitos.startsWith(buscado) ? 1 : 0;
  }
  const alvo = normalizarTexto(`${l.endereco} ${l.bairro}`);
  const palavras = busca.valor.split(" ").filter(Boolean);
  if (!palavras.every((p) => alvo.includes(p))) return 0;
  return normalizarTexto(l.endereco).startsWith(busca.valor) ? 2 : 1;
}

/** Filtra e ordena (exatos primeiro, depois por endereço). Usada no servidor e, offline, no aparelho. */
export function filtrarLicencas<T extends Pick<Licenca, "numero_alvara" | "numero_processo" | "endereco" | "bairro">>(
  lista: readonly T[],
  busca: BuscaInterpretada,
): T[] {
  return lista
    .map((l) => ({ l, p: pontuarCorrespondencia(l, busca) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.l.endereco.localeCompare(b.l.endereco, "pt-BR"))
    .map((x) => x.l);
}
