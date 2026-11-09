import { NextResponse } from "next/server";
import { ErroServico } from "./acoes-service";

const SEM_CACHE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: SEM_CACHE });
}

export function naoAutenticado() {
  return json({ erro: { codigo: "NAO_AUTENTICADO", mensagem: "Sessão expirada. Entre novamente." } }, 401);
}

export function respostaDeErro(e: unknown) {
  if (e instanceof ErroServico) {
    return json(
      { erro: { codigo: e.codigo, mensagem: e.message }, ...(e.acaoAtual ? { acao: e.acaoAtual } : {}) },
      e.httpStatus,
    );
  }
  console.error(e);
  return json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado. Tente novamente." } }, 500);
}
