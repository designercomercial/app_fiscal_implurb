"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowLeft, Ban } from "lucide-react";
import {
  MOTIVOS_NAO_REALIZADA,
  ROTULO_MOTIVO,
  ROTULO_TIPO,
  type Acao,
  type MotivoNaoRealizada,
} from "@/domain/acao";
import { TAMANHO_MAX_MOTIVO_OUTRO, validarTransicao } from "@/domain/status";
import { Button } from "./ui/Button";
import { Alerta } from "./ui/Alerta";
import { Painel } from "./ui/Painel";

interface PropsDialogo {
  acao: Acao | null;
  offline: boolean;
  aoCancelar: () => void;
  /** Deve lançar erro (com mensagem) se o servidor recusar. */
  aoConfirmar: (acao: Acao, motivo: MotivoNaoRealizada, motivoOutro?: string) => Promise<void>;
}

type Etapa = "motivo" | "confirmar";

/**
 * "Não consegui realizar": etapa 1 escolhe o motivo; etapa 2 pede confirmação.
 * Abre no lugar do detalhe (nunca um modal sobre outro).
 */
export function DialogoNaoRealizada({ acao, offline, aoCancelar, aoConfirmar }: PropsDialogo) {
  const [etapa, setEtapa] = useState<Etapa>("motivo");
  const [motivo, setMotivo] = useState<MotivoNaoRealizada | null>(null);
  const [outro, setOutro] = useState("");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idGrupo = useId();
  const idErro = useId();
  const idOutro = useId();

  // Sempre começa limpo ao abrir para outra ação.
  useEffect(() => {
    setEtapa("motivo");
    setMotivo(null);
    setOutro("");
    setErroCampo(null);
    setErroEnvio(null);
    setEnviando(false);
  }, [acao?.codigo]);

  if (!acao) return null;

  const continuar = (e: FormEvent) => {
    e.preventDefault();
    const r = validarTransicao(acao.status, "nao_realizada", { motivo_nao_realizada: motivo, motivo_outro: outro });
    if (!r.ok) {
      setErroCampo(r.codigo === "MOTIVO_OBRIGATORIO" ? "Escolha um motivo." : r.mensagem);
      return;
    }
    setErroCampo(null);
    setEtapa("confirmar");
  };

  const confirmar = async () => {
    if (!motivo) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await aoConfirmar(acao, motivo, motivo === "outro" ? outro.trim() : undefined);
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível registrar. Tente novamente.");
      setEnviando(false);
    }
  };

  const rotuloMotivo = motivo ? ROTULO_MOTIVO[motivo] : "";

  return (
    <Painel
      aberto
      tipo="dialogo"
      role={etapa === "confirmar" ? "alertdialog" : "dialog"}
      aoFechar={enviando ? () => {} : aoCancelar}
      testId="dialogo-nao-realizada"
      titulo={etapa === "motivo" ? "Não consegui realizar" : "Confirmar ação não realizada?"}
      subtitulo={
        <>
          {ROTULO_TIPO[acao.tipo]} · <span className="whitespace-nowrap font-mono">{acao.codigo}</span>
        </>
      }
      rodape={
        etapa === "motivo" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={aoCancelar}>Cancelar</Button>
            <Button variante="primary" type="submit" form="form-motivo">
              Continuar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setEtapa("motivo")}
              disabled={enviando}
              icone={<ArrowLeft aria-hidden className="size-5" strokeWidth={2} />}
            >
              Voltar
            </Button>
            <Button
              variante="danger"
              onClick={confirmar}
              carregando={enviando}
              disabled={offline}
              icone={<Ban aria-hidden className="size-5" strokeWidth={2} />}
            >
              Confirmar
            </Button>
          </div>
        )
      }
    >
      {etapa === "motivo" ? (
        <form id="form-motivo" onSubmit={continuar} noValidate>
          <fieldset aria-describedby={erroCampo ? idErro : undefined}>
            <legend id={idGrupo} className="mb-2 text-base font-semibold text-fg-strong">
              Por que a ação não foi realizada?
            </legend>
            <div className="space-y-2">
              {MOTIVOS_NAO_REALIZADA.map((m, i) => {
                const marcado = motivo === m;
                return (
                  <label
                    key={m}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-base ${
                      marcado ? "border-brand bg-brand-subtle text-fg-strong" : "border-line-subtle bg-surface text-fg"
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={m}
                      checked={marcado}
                      onChange={() => {
                        setMotivo(m);
                        setErroCampo(null);
                      }}
                      data-foco-inicial={i === 0 ? "" : undefined}
                      className="size-5 shrink-0 accent-[var(--bg-brand)]"
                    />
                    {ROTULO_MOTIVO[m]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {motivo === "outro" ? (
            <div className="mt-3">
              <label htmlFor={idOutro} className="mb-1 block text-base font-medium text-fg-strong">
                Descreva o motivo
              </label>
              <textarea
                id={idOutro}
                value={outro}
                onChange={(e) => {
                  setOutro(e.target.value);
                  setErroCampo(null);
                }}
                maxLength={TAMANHO_MAX_MOTIVO_OUTRO}
                rows={3}
                aria-invalid={erroCampo ? true : undefined}
                aria-describedby={erroCampo ? idErro : undefined}
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-subtle"
                placeholder="Ex.: proprietário pediu reagendamento"
              />
              <p className="mt-1 text-right text-base text-fg-muted">
                {outro.length}/{TAMANHO_MAX_MOTIVO_OUTRO}
              </p>
            </div>
          ) : null}

          {erroCampo ? (
            <p id={idErro} role="alert" className="mt-3 text-base font-medium text-danger">
              {erroCampo}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-base text-fg">
            A ação <span className="font-mono font-semibold">{acao.codigo}</span> será registrada como{" "}
            <strong>não realizada</strong> pelo motivo <strong>“{rotuloMotivo}”</strong>
            {motivo === "outro" && outro.trim() ? <> ({outro.trim()})</> : null}. Ela volta para a fila do dia seguinte.
          </p>
          {offline ? (
            <Alerta tom="warning" role="status">
              Sem internet. Conecte-se para confirmar.
            </Alerta>
          ) : null}
          {erroEnvio ? (
            <Alerta tom="danger" role="alert">
              {erroEnvio}
            </Alerta>
          ) : null}
        </div>
      )}
    </Painel>
  );
}
