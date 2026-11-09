"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { AlertCircle, CircleCheck, Search, SearchX } from "lucide-react";
import {
  dataHoraBr,
  normalizarProtocolo,
  ROTULO_TIPO,
  type ConsultaPublica,
} from "@/domain/processo";
import { ErroApi } from "@/client/api";
import { consultarProtocolo, ErroLimite, type DesafioCaptcha as Desafio } from "@/client/processos";
import { Alerta } from "../ui/Alerta";
import { Button } from "../ui/Button";
import { AvisoCobranca, CardSkeleton, SeloStatusProcesso, SeloTom } from "./Comum";
import { DesafioCaptcha } from "./DesafioCaptcha";
import { mensagemErroConexao } from "./MeusProcessosApp";

export const TEXTO_APOIO_CONSULTA = "Use esta consulta para conferir o andamento informado por terceiros.";
export const TEXTO_PROTOCOLO_NAO_ENCONTRADO = "Não encontramos este protocolo. Confira o número e tente de novo.";

type Estado =
  | { fase: "inicial" }
  | { fase: "carregando"; protocolo: string }
  | { fase: "pronto"; consulta: ConsultaPublica }
  | { fase: "nao_encontrado"; protocolo: string }
  | { fase: "captcha"; protocolo: string; desafio: Desafio; mensagem: string; enviando: boolean }
  | { fase: "limite"; mensagem: string }
  | { fase: "erro"; protocolo: string; mensagem: string };

/** "20260004587" → "2026.000.4587" enquanto digita. */
function mascaraProtocolo(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`;
}

function sincronizarUrl(protocolo: string | null) {
  try {
    const url = new URL(window.location.href);
    if (protocolo) url.searchParams.set("protocolo", protocolo);
    else url.searchParams.delete("protocolo");
    window.history.replaceState(null, "", url);
  } catch {
    /* ignora */
  }
}

export function ConsultaProtocoloApp() {
  const [campo, setCampo] = useState("");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "inicial" });
  const idCampo = useId();
  const idAjuda = useId();
  const idErro = useId();

  const consultar = useCallback(async (protocolo: string, token?: string) => {
    setEstado((atual) =>
      token && atual.fase === "captcha" ? { ...atual, enviando: true } : { fase: "carregando", protocolo },
    );
    sincronizarUrl(protocolo);
    try {
      setEstado({ fase: "pronto", consulta: await consultarProtocolo(protocolo, token) });
    } catch (e) {
      if (e instanceof ErroLimite) {
        setEstado(
          e.desafio
            ? { fase: "captcha", protocolo, desafio: e.desafio, mensagem: e.message, enviando: false }
            : { fase: "limite", mensagem: e.message },
        );
      } else if (e instanceof ErroApi && e.status === 404) {
        setEstado({ fase: "nao_encontrado", protocolo });
      } else {
        setEstado({ fase: "erro", protocolo, mensagem: mensagemErroConexao(e, "a consulta").mensagem });
      }
    }
  }, []);

  // ?protocolo= na URL: consulta direto.
  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("protocolo");
    const normal = inicial ? normalizarProtocolo(inicial) : null;
    if (normal) {
      setCampo(normal);
      void consultar(normal);
    }
  }, [consultar]);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const normal = normalizarProtocolo(campo);
    if (!normal) {
      setErroCampo("Digite os 11 números do protocolo, como 2026.000.4587.");
      return;
    }
    setErroCampo(null);
    void consultar(normal);
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-app pb-10">
      <header className="border-b border-line-subtle bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold leading-tight text-fg-strong" style={{ fontFamily: "var(--font-display)" }}>
          Consultar por protocolo
        </h1>
        <p className="mt-1 text-base text-fg-muted">{TEXTO_APOIO_CONSULTA}</p>

        <form role="search" onSubmit={aoEnviar} className="mt-4" noValidate>
          <label htmlFor={idCampo} className="mb-1 block text-base font-medium text-fg-strong">
            Número do protocolo
          </label>
          <div className="flex gap-2">
            <input
              id={idCampo}
              inputMode="numeric"
              autoComplete="off"
              value={campo}
              onChange={(e) => {
                setCampo(mascaraProtocolo(e.target.value));
                setErroCampo(null);
              }}
              placeholder="Ex.: 2026.000.4587"
              aria-invalid={erroCampo ? true : undefined}
              aria-describedby={erroCampo ? idErro : idAjuda}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-base text-fg placeholder:font-sans placeholder:text-fg-subtle"
            />
            <Button
              type="submit"
              variante="primary"
              className="min-h-12"
              carregando={estado.fase === "carregando"}
              icone={<Search aria-hidden className="size-5 shrink-0" strokeWidth={2} />}
            >
              Consultar
            </Button>
          </div>
          {erroCampo ? (
            <p id={idErro} role="alert" className="mt-1 text-base font-medium text-danger">
              {erroCampo}
            </p>
          ) : (
            <p id={idAjuda} className="mt-1 text-base text-fg-muted">
              O protocolo está no comprovante do pedido.
            </p>
          )}
        </form>
      </header>

      <main className="space-y-4 px-4 pt-4" aria-busy={estado.fase === "carregando"}>
        {estado.fase === "carregando" ? (
          <>
            <p className="sr-only" role="status">
              Consultando
            </p>
            <CardSkeleton testId="consulta-skeleton" />
          </>
        ) : null}

        {estado.fase === "pronto" ? <ResultadoConsulta consulta={estado.consulta} /> : null}

        {estado.fase === "nao_encontrado" ? (
          <div className="flex flex-col items-center px-6 py-8 text-center" role="alert" data-testid="consulta-nao-encontrada">
            <SearchX aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
            <p className="mt-3 text-lg text-fg">{TEXTO_PROTOCOLO_NAO_ENCONTRADO}</p>
          </div>
        ) : null}

        {estado.fase === "captcha" ? (
          <DesafioCaptcha
            desafio={estado.desafio}
            mensagem={estado.mensagem}
            carregando={estado.enviando}
            aoResolver={(token) => void consultar(estado.protocolo, token)}
          />
        ) : null}

        {estado.fase === "limite" ? (
          <Alerta tom="danger" role="alert" testId="limite-consultas" titulo="Muitas consultas seguidas">
            {estado.mensagem}
          </Alerta>
        ) : null}

        {estado.fase === "erro" ? (
          <Alerta
            tom="danger"
            role="alert"
            testId="erro-consulta"
            titulo="Não foi possível consultar"
            acao={<Button onClick={() => void consultar(estado.protocolo)}>Tentar novamente</Button>}
          >
            {estado.mensagem}
          </Alerta>
        ) : null}

        {estado.fase !== "carregando" ? <AvisoCobranca /> : null}
      </main>
    </div>
  );
}

function SimNao({ sim, testId }: { sim: boolean; testId: string }) {
  return sim ? (
    <SeloTom tom="warning" Icone={AlertCircle} testId={testId}>
      Sim
    </SeloTom>
  ) : (
    <SeloTom tom="success" Icone={CircleCheck} testId={testId}>
      Não
    </SeloTom>
  );
}

export function ResultadoConsulta({ consulta: c }: { consulta: ConsultaPublica }) {
  return (
    <section aria-labelledby="titulo-consulta" data-testid="resultado-consulta" className="rounded-xl border border-line-subtle bg-surface p-4">
      <h2 id="titulo-consulta" className="text-base text-fg-muted" role="status">
        Protocolo <span className="whitespace-nowrap font-mono text-fg">{c.protocolo}</span>
      </h2>
      <p className="mt-1 text-lg font-semibold text-fg-strong">{ROTULO_TIPO[c.tipo]}</p>
      <div className="mt-2">
        <SeloStatusProcesso status={c.status} tipo={c.tipo} />
      </div>
      <dl className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 text-base">
        <dt className="text-fg-muted">Bairro da obra</dt>
        <dd className="text-right text-fg">{c.bairro_obra}</dd>
        <dt className="text-fg-muted">Última atualização</dt>
        <dd className="text-right text-fg">{dataHoraBr(c.atualizado_em)}</dd>
        <dt className="text-fg-muted">Pendência aberta</dt>
        <dd className="text-right">
          <SimNao sim={c.tem_pendencia_aberta} testId="tem-pendencia" />
        </dd>
        <dt className="text-fg-muted">Guia de taxa em aberto</dt>
        <dd className="text-right">
          <SimNao sim={c.tem_guia_em_aberto} testId="tem-guia" />
        </dd>
      </dl>
      <p className="mt-3 text-base text-fg-muted">
        {c.tem_pendencia_aberta
          ? "A pendência é respondida pelo app, no canal Responder Pendência, sem custo."
          : "Se alguém disser que há uma pendência para liberar este processo, ela não existe."}
      </p>
    </section>
  );
}
