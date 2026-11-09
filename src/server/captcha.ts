import { randomInt, randomUUID } from "node:crypto";

/**
 * Captcha das páginas públicas.
 *
 * >>> PONTO DE TROCA <<<
 * O serviço de captcha está [A DEFINIR: Cloudflare Turnstile, hCaptcha ou reCAPTCHA].
 * A rota só usa `VerificadorCaptcha`. Para trocar:
 *  - `verificar(token, ip)` chama a API de verificação do serviço escolhido;
 *  - `gerarDesafio()` devolve `null` e a página exibe o widget do serviço.
 *
 * Mock atual: pergunta de soma simples, guardada em memória, uso único, válida por 5 minutos.
 * O token enviado pela página é "id:resposta" no cabeçalho `x-captcha-token`.
 */

export interface DesafioCaptcha {
  id: string;
  pergunta: string;
}

export interface VerificadorCaptcha {
  gerarDesafio(): Promise<DesafioCaptcha | null>;
  verificar(token: string | null, ip: string): Promise<boolean>;
}

const VALIDADE_MS = 5 * 60_000;

export class CaptchaMock implements VerificadorCaptcha {
  private respostas = new Map<string, { resposta: string; expira: number }>();

  async gerarDesafio(): Promise<DesafioCaptcha> {
    const a = randomInt(2, 10);
    const b = randomInt(2, 10);
    const id = randomUUID();
    this.respostas.set(id, { resposta: String(a + b), expira: Date.now() + VALIDADE_MS });
    return { id, pergunta: `Quanto é ${a} + ${b}?` };
  }

  async verificar(token: string | null): Promise<boolean> {
    if (!token) return false;
    const [id, resposta] = token.split(":");
    const d = this.respostas.get(id);
    if (!d) return false;
    this.respostas.delete(id); // uso único: errou, pede outro desafio
    return d.expira > Date.now() && d.resposta === (resposta ?? "").trim();
  }

  /** Somente testes: resposta de um desafio. */
  respostaDe(id: string): string | undefined {
    return this.respostas.get(id)?.resposta;
  }
}

const g = globalThis as unknown as { __lfCaptcha?: CaptchaMock };

export function getCaptcha(): VerificadorCaptcha & Partial<Pick<CaptchaMock, "respostaDe">> {
  g.__lfCaptcha ??= new CaptchaMock();
  return g.__lfCaptcha;
}
