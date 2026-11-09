import type { Acao, CorpoAlterarStatus, RespostaAcoesDoDia } from "@/domain/acao";

export const TIMEOUT_MS = 10_000;

/** Falha de rede: sem internet, timeout ou servidor inalcançável. */
export class ErroRede extends Error {
  constructor(mensagem = "Sem conexão com o servidor.") {
    super(mensagem);
    this.name = "ErroRede";
  }
}

/** O servidor respondeu com erro. */
export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly acaoAtual?: Acao,
    /** Corpo completo da resposta de erro (ex.: desafio de captcha). */
    public readonly corpo?: unknown,
  ) {
    super(mensagem);
    this.name = "ErroApi";
  }
}

/** Parâmetros de desenvolvimento repassados à API (ex.: ?fiscal=f-002 ou ?cidadao=c-002 no mock). */
export function parametrosRepassados(): URLSearchParams {
  const p = new URLSearchParams();
  if (typeof window === "undefined") return p;
  const atual = new URLSearchParams(window.location.search);
  for (const nome of ["fiscal", "cidadao"]) {
    const valor = atual.get(nome);
    if (valor) p.set(nome, valor);
  }
  return p;
}

export async function requisitar<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      signal: controle.signal,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new ErroRede();
  } finally {
    clearTimeout(timer);
  }

  let corpo: unknown = null;
  try {
    corpo = await resposta.json();
  } catch {
    /* corpo vazio ou não-JSON */
  }

  if (!resposta.ok) {
    const c = (corpo ?? {}) as { erro?: { codigo?: string; mensagem?: string }; acao?: Acao };
    throw new ErroApi(
      resposta.status,
      c.erro?.codigo ?? "ERRO",
      c.erro?.mensagem ?? "Não foi possível concluir. Tente novamente.",
      c.acao,
      corpo,
    );
  }
  return corpo as T;
}

export function buscarAcoesDoDia(data?: string): Promise<RespostaAcoesDoDia> {
  const p = parametrosRepassados();
  if (data) p.set("data", data);
  const qs = p.toString();
  return requisitar<RespostaAcoesDoDia>(`/api/fiscal/acoes-do-dia${qs ? `?${qs}` : ""}`);
}

export async function enviarStatus(codigo: string, corpo: CorpoAlterarStatus): Promise<Acao> {
  const qs = parametrosRepassados().toString();
  const r = await requisitar<{ acao: Acao }>(
    `/api/fiscal/acoes/${encodeURIComponent(codigo)}/status${qs ? `?${qs}` : ""}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    },
  );
  return r.acao;
}
