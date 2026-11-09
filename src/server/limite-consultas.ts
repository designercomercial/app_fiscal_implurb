/**
 * Proteção contra abuso das páginas públicas (limite por IP + captcha).
 *
 * Regras (consulta por protocolo):
 *  - até 5 consultas a cada 10 minutos sem captcha;
 *  - a partir daí, cada consulta exige captcha; acertar zera a contagem dos 10 minutos;
 *  - teto de 30 consultas por hora, com ou sem captcha (responde "tente em X minutos").
 *
 * Em memória (um servidor). Com vários servidores, troque por Redis ou similar.
 * Atenção: operadoras móveis compartilham IP (CGNAT). Ajuste os números com dados reais.
 */

export interface ConfigLimite {
  semCaptcha: number;
  janelaCaptchaMs: number;
  maximo: number;
  janelaMaximaMs: number;
}

export const LIMITE_CONSULTA: ConfigLimite = {
  semCaptcha: 5,
  janelaCaptchaMs: 10 * 60_000,
  maximo: 30,
  janelaMaximaMs: 60 * 60_000,
};

/** Validação de documento: códigos longos e aleatórios, então só o teto (sem captcha). */
export const LIMITE_VALIDACAO: ConfigLimite = {
  semCaptcha: Number.POSITIVE_INFINITY,
  janelaCaptchaMs: 10 * 60_000,
  maximo: 60,
  janelaMaximaMs: 60 * 60_000,
};

export type Decisao =
  | { permitido: true }
  | { permitido: false; motivo: "captcha" }
  | { permitido: false; motivo: "limite"; tentarEmSegundos: number };

interface Registro {
  /** consultas aceitas (teto por hora) */
  todas: number[];
  /** consultas desde o último captcha (gatilho do captcha) */
  desdeCaptcha: number[];
}

export class LimitadorConsultas {
  private registros = new Map<string, Registro>();
  constructor(private readonly config: ConfigLimite) {}

  /**
   * Decide se a consulta pode seguir e, se puder, registra.
   * `captchaValido`: a requisição trouxe um captcha correto.
   */
  verificar(chave: string, agora: number, captchaValido: boolean): Decisao {
    const c = this.config;
    const r = this.registros.get(chave) ?? { todas: [], desdeCaptcha: [] };
    r.todas = r.todas.filter((t) => agora - t < c.janelaMaximaMs);
    r.desdeCaptcha = r.desdeCaptcha.filter((t) => agora - t < c.janelaCaptchaMs);
    this.registros.set(chave, r);

    if (r.todas.length >= c.maximo) {
      const tentarEm = Math.ceil((r.todas[0] + c.janelaMaximaMs - agora) / 1000);
      return { permitido: false, motivo: "limite", tentarEmSegundos: Math.max(1, tentarEm) };
    }
    if (captchaValido) r.desdeCaptcha = [];
    else if (r.desdeCaptcha.length >= c.semCaptcha) return { permitido: false, motivo: "captcha" };

    r.todas.push(agora);
    r.desdeCaptcha.push(agora);
    return { permitido: true };
  }

  limpar() {
    this.registros.clear();
  }
}

const g = globalThis as unknown as { __lfLimites?: Record<string, LimitadorConsultas> };

export function getLimitador(nome: "consulta" | "validacao"): LimitadorConsultas {
  g.__lfLimites ??= {};
  g.__lfLimites[nome] ??= new LimitadorConsultas(nome === "consulta" ? LIMITE_CONSULTA : LIMITE_VALIDACAO);
  return g.__lfLimites[nome];
}

export function reiniciarLimites() {
  for (const l of Object.values(g.__lfLimites ?? {})) l.limpar();
}

/** IP do cliente. Atrás de proxy, confie só no cabeçalho que o SEU proxy define. */
export function ipDaRequisicao(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}
