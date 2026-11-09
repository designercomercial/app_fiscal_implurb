import { getCaptcha } from "./captcha";
import { json } from "./http";
import { getLimitador, ipDaRequisicao } from "./limite-consultas";
import { ErroProcesso } from "./processos-service";

export function cidadaoNaoAutenticado() {
  return json(
    { erro: { codigo: "NAO_AUTENTICADO", mensagem: "Sua sessão expirou. Feche e abra de novo o Meus Processos." } },
    401,
  );
}

export function respostaErroProcesso(e: unknown) {
  if (e instanceof ErroProcesso) return json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.httpStatus);
  console.error(e);
  return json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado. Tente novamente." } }, 500);
}

/**
 * Limite por IP e captcha das rotas públicas.
 * Devolve uma resposta 429 quando a consulta deve parar, ou null para seguir.
 */
export async function protegerRotaPublica(request: Request, nome: "consulta" | "validacao"): Promise<Response | null> {
  const ip = ipDaRequisicao(request);
  const captcha = getCaptcha();
  const token = request.headers.get("x-captcha-token");
  const captchaValido = token ? await captcha.verificar(token, ip) : false;
  const decisao = getLimitador(nome).verificar(`${nome}:${ip}`, Date.now(), captchaValido);
  if (decisao.permitido) return null;

  if (decisao.motivo === "captcha") {
    return json(
      {
        erro: {
          codigo: "CAPTCHA_OBRIGATORIO",
          mensagem: token
            ? "Resposta incorreta. Responda a esta nova pergunta."
            : "Foram feitas muitas consultas seguidas. Para continuar, responda à pergunta abaixo.",
        },
        captcha: await captcha.gerarDesafio(),
      },
      429,
    );
  }
  const minutos = Math.ceil(decisao.tentarEmSegundos / 60);
  const r = json(
    {
      erro: {
        codigo: "LIMITE_EXCEDIDO",
        mensagem: `Limite de consultas atingido. Tente de novo em ${minutos === 1 ? "1 minuto" : `${minutos} minutos`}.`,
      },
    },
    429,
  );
  r.headers.set("Retry-After", String(decisao.tentarEmSegundos));
  return r;
}
