"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import type { DesafioCaptcha as Desafio } from "@/client/processos";
import { Button } from "../ui/Button";

/**
 * Pergunta do captcha MOCK. Com Turnstile/hCaptcha/reCAPTCHA, este componente passa a
 * renderizar o widget do serviço e chamar `aoResolver(token)` com o token dele.
 */
export function DesafioCaptcha({
  desafio,
  mensagem,
  carregando,
  aoResolver,
}: {
  desafio: Desafio;
  mensagem: string;
  carregando: boolean;
  aoResolver: (token: string) => void;
}) {
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const idCampo = useId();
  const idErro = useId();
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setResposta("");
    campo.current?.focus();
  }, [desafio.id]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!resposta.trim()) {
      setErro("Digite a resposta.");
      return;
    }
    setErro(null);
    aoResolver(`${desafio.id}:${resposta.trim()}`);
  };

  return (
    <form onSubmit={enviar} noValidate data-testid="captcha" className="rounded-xl border border-warning-line bg-warning-subtle p-4">
      <p className="flex items-start gap-2 font-semibold text-fg-strong">
        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={2} />
        Confirme que você não é um robô
      </p>
      <p className="mt-1 text-base text-fg" role="status">
        {mensagem}
      </p>
      <label htmlFor={idCampo} className="mt-3 block text-base font-medium text-fg-strong">
        {desafio.pergunta}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          ref={campo}
          id={idCampo}
          inputMode="numeric"
          autoComplete="off"
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          className="min-h-12 w-24 rounded-lg border border-line bg-surface px-3 text-base text-fg"
        />
        <Button type="submit" variante="primary" className="min-h-12 flex-1" carregando={carregando}>
          Confirmar
        </Button>
      </div>
      {erro ? (
        <p id={idErro} role="alert" className="mt-1 text-base font-medium text-danger">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
