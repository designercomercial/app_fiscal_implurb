import type { ConsultaPublica, Processo, RespostaMeusProcessos, ResultadoValidacao } from "@/domain/processo";
import { ErroApi, parametrosRepassados, requisitar } from "./api";

function qs(): string {
  const s = parametrosRepassados().toString();
  return s ? `?${s}` : "";
}

export function buscarMeusProcessos(): Promise<RespostaMeusProcessos> {
  return requisitar<RespostaMeusProcessos>(`/api/cidadao/processos${qs()}`);
}

export async function obterProcesso(protocolo: string): Promise<Processo> {
  const r = await requisitar<{ processo: Processo }>(`/api/cidadao/processos/${encodeURIComponent(protocolo)}${qs()}`);
  return r.processo;
}

/** Link do PDF com os parâmetros do mock (ex.: ?cidadao=). */
export function linkPdf(urlPdf: string): string {
  return `${urlPdf}${qs()}`;
}

/** Link interno preservando ?cidadao= (mock) e ?tema= entre as páginas. */
export function comParametros(href: string): string {
  if (typeof window === "undefined") return href;
  const atual = new URLSearchParams(window.location.search);
  const url = new URL(href, window.location.origin);
  for (const nome of ["cidadao", "tema"]) {
    const v = atual.get(nome);
    if (v && !url.searchParams.has(nome)) url.searchParams.set(nome, v);
  }
  return `${url.pathname}${url.search}`;
}

/* ------------------------------------------------------------ Públicas */

export interface DesafioCaptcha {
  id: string;
  pergunta: string;
}

/** A consulta foi barrada: precisa de captcha ou o limite estourou. */
export class ErroLimite extends Error {
  constructor(
    mensagem: string,
    public readonly desafio: DesafioCaptcha | null,
  ) {
    super(mensagem);
    this.name = "ErroLimite";
  }
}

async function requisitarPublica<T>(url: string, tokenCaptcha?: string): Promise<T> {
  try {
    return await requisitar<T>(url, tokenCaptcha ? { headers: { "x-captcha-token": tokenCaptcha } } : {});
  } catch (e) {
    if (e instanceof ErroApi && e.status === 429) {
      const corpo = (e.corpo ?? {}) as { captcha?: DesafioCaptcha | null };
      throw new ErroLimite(e.message, e.codigo === "CAPTCHA_OBRIGATORIO" ? (corpo.captcha ?? null) : null);
    }
    throw e;
  }
}

export async function consultarProtocolo(protocolo: string, tokenCaptcha?: string): Promise<ConsultaPublica> {
  const r = await requisitarPublica<{ consulta: ConsultaPublica }>(
    `/api/publico/consulta/${encodeURIComponent(protocolo)}`,
    tokenCaptcha,
  );
  return r.consulta;
}

export function validarCodigo(codigo: string, tokenCaptcha?: string): Promise<ResultadoValidacao> {
  return requisitarPublica<ResultadoValidacao>(`/api/publico/validar/${encodeURIComponent(codigo)}`, tokenCaptcha);
}
