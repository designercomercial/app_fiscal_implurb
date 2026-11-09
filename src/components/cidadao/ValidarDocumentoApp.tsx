"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { CalendarX, QrCode, SearchX, ShieldCheck, ShieldX } from "lucide-react";
import {
  dataBr,
  formatarCodigoValidacao,
  normalizarCodigoValidacao,
  type DocumentoValidado,
  type ResultadoValidacao,
} from "@/domain/processo";
import { ErroApi } from "@/client/api";
import { ErroLimite, validarCodigo, type DesafioCaptcha as Desafio } from "@/client/processos";
import { Alerta } from "../ui/Alerta";
import { Button } from "../ui/Button";
import { CardSkeleton, SeloTom } from "./Comum";
import { DesafioCaptcha } from "./DesafioCaptcha";
import { LeitorQr, leituraQrDisponivel } from "./LeitorQr";
import { mensagemErroConexao } from "./MeusProcessosApp";

export const TEXTO_CODIGO_NAO_ENCONTRADO = "Este código não corresponde a nenhum documento emitido pelo IMPLURB.";

type Estado =
  | { fase: "inicial" }
  | { fase: "carregando" }
  | { fase: "pronto"; codigo: string; resultado: ResultadoValidacao }
  | { fase: "captcha"; codigo: string; desafio: Desafio; mensagem: string; enviando: boolean }
  | { fase: "limite"; mensagem: string }
  | { fase: "erro"; codigo: string; mensagem: string };

function sincronizarUrl(codigo: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("codigo", codigo);
    window.history.replaceState(null, "", url);
  } catch {
    /* ignora */
  }
}

export function ValidarDocumentoApp() {
  const [campo, setCampo] = useState("");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "inicial" });
  const [temCamera, setTemCamera] = useState(false);
  const [leitorAberto, setLeitorAberto] = useState(false);
  const idCampo = useId();
  const idAjuda = useId();
  const idErro = useId();

  const validar = useCallback(async (codigo: string, token?: string) => {
    setEstado((atual) => (token && atual.fase === "captcha" ? { ...atual, enviando: true } : { fase: "carregando" }));
    sincronizarUrl(codigo);
    try {
      setEstado({ fase: "pronto", codigo, resultado: await validarCodigo(codigo, token) });
    } catch (e) {
      if (e instanceof ErroLimite) {
        setEstado(
          e.desafio
            ? { fase: "captcha", codigo, desafio: e.desafio, mensagem: e.message, enviando: false }
            : { fase: "limite", mensagem: e.message },
        );
      } else {
        const mensagem = e instanceof ErroApi ? e.message : mensagemErroConexao(e, "a validação").mensagem;
        setEstado({ fase: "erro", codigo, mensagem });
      }
    }
  }, []);

  // O QR Code do documento aponta para /validar?codigo=XXXX: já mostra o resultado.
  useEffect(() => {
    setTemCamera(leituraQrDisponivel());
    const inicial = new URLSearchParams(window.location.search).get("codigo");
    const normal = inicial ? normalizarCodigoValidacao(inicial) : "";
    if (normal) {
      setCampo(formatarCodigoValidacao(normal));
      void validar(normal);
    }
  }, [validar]);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const normal = normalizarCodigoValidacao(campo);
    if (normal.length < 6) {
      setErroCampo("Digite o código impresso no documento, como LF-7KQ3-M9XA-2P.");
      return;
    }
    setErroCampo(null);
    void validar(normal);
  };

  const aoLerQr = useCallback(
    (codigo: string) => {
      setLeitorAberto(false);
      setCampo(formatarCodigoValidacao(codigo));
      void validar(codigo);
    },
    [validar],
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-app pb-10">
      <header className="border-b border-line-subtle bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold leading-tight text-fg-strong" style={{ fontFamily: "var(--font-display)" }}>
          Validar alvará
        </h1>
        <p className="mt-1 text-base text-fg-muted">
          Confira se um alvará, Habite-se ou licença foi emitido pelo IMPLURB e se continua valendo.
        </p>

        <form onSubmit={aoEnviar} className="mt-4" noValidate>
          <label htmlFor={idCampo} className="mb-1 block text-base font-medium text-fg-strong">
            Código de validação
          </label>
          <div className="flex gap-2">
            <input
              id={idCampo}
              value={campo}
              onChange={(e) => {
                setCampo(e.target.value.toUpperCase());
                setErroCampo(null);
              }}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Ex.: LF-7KQ3-M9XA-2P"
              aria-invalid={erroCampo ? true : undefined}
              aria-describedby={erroCampo ? idErro : idAjuda}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-base text-fg placeholder:font-sans placeholder:text-fg-subtle"
            />
            <Button
              type="submit"
              variante="primary"
              className="min-h-12"
              carregando={estado.fase === "carregando"}
              icone={<ShieldCheck aria-hidden className="size-5 shrink-0" strokeWidth={2} />}
            >
              Validar
            </Button>
          </div>
          {erroCampo ? (
            <p id={idErro} role="alert" className="mt-1 text-base font-medium text-danger">
              {erroCampo}
            </p>
          ) : (
            <p id={idAjuda} className="mt-1 text-base text-fg-muted">
              O código fica no rodapé do documento, ao lado do QR Code.
            </p>
          )}
          {temCamera ? (
            <Button
              className="mt-3"
              larguraTotal
              onClick={() => setLeitorAberto(true)}
              icone={<QrCode aria-hidden className="size-5 shrink-0" strokeWidth={2} />}
            >
              Ler QR Code com a câmera
            </Button>
          ) : null}
        </form>
      </header>

      <main className="space-y-4 px-4 pt-4" aria-busy={estado.fase === "carregando"}>
        {estado.fase === "carregando" ? (
          <>
            <p className="sr-only" role="status">
              Validando
            </p>
            <CardSkeleton testId="validacao-skeleton" />
          </>
        ) : null}

        {estado.fase === "pronto" ? <ResultadoValidacaoView codigo={estado.codigo} resultado={estado.resultado} /> : null}

        {estado.fase === "captcha" ? (
          <DesafioCaptcha
            desafio={estado.desafio}
            mensagem={estado.mensagem}
            carregando={estado.enviando}
            aoResolver={(token) => void validar(estado.codigo, token)}
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
            testId="erro-validacao"
            titulo="Não foi possível validar"
            acao={<Button onClick={() => void validar(estado.codigo)}>Tentar novamente</Button>}
          >
            {estado.mensagem}
          </Alerta>
        ) : null}
      </main>

      {temCamera ? <LeitorQr aberto={leitorAberto} aoFechar={() => setLeitorAberto(false)} aoLer={aoLerQr} /> : null}
    </div>
  );
}

function DadosDocumento({ d }: { d: DocumentoValidado }) {
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
      <dt className="text-fg-muted">Documento</dt>
      <dd className="text-fg">{d.tipo}</dd>
      <dt className="text-fg-muted">Número</dt>
      <dd className="font-mono text-fg">{d.numero}</dd>
      <dt className="text-fg-muted">Emitido em</dt>
      <dd className="text-fg">{dataBr(d.emitido_em)}</dd>
      <dt className="text-fg-muted">Validade</dt>
      <dd className="text-fg">{d.validade ? `até ${dataBr(d.validade)}` : "sem prazo de validade"}</dd>
      <dt className="text-fg-muted">Bairro da obra</dt>
      <dd className="text-fg">{d.bairro_obra}</dd>
      <dt className="text-fg-muted">Responsável técnico</dt>
      <dd className="text-fg">{d.responsavel_tecnico}</dd>
    </dl>
  );
}

export function ResultadoValidacaoView({ codigo, resultado: r }: { codigo: string; resultado: ResultadoValidacao }) {
  const base = "rounded-xl border bg-surface p-4";
  const cabecalho = (
    <p className="text-base text-fg-muted">
      Código <span className="whitespace-nowrap font-mono text-fg">{formatarCodigoValidacao(codigo)}</span>
    </p>
  );

  if (r.resultado === "valido") {
    return (
      <section data-testid="resultado-validacao" data-resultado="valido" className={`${base} border-success-line`} aria-live="polite">
        {cabecalho}
        <div className="mt-2">
          <SeloTom tom="success" Icone={ShieldCheck}>
            Documento válido
          </SeloTom>
        </div>
        <p className="mt-2 text-base text-fg">Este documento foi emitido pelo IMPLURB e está valendo.</p>
        <DadosDocumento d={r.documento} />
      </section>
    );
  }
  if (r.resultado === "vencido") {
    return (
      <section data-testid="resultado-validacao" data-resultado="vencido" className={`${base} border-warning-line`} aria-live="polite">
        {cabecalho}
        <div className="mt-2">
          <SeloTom tom="warning" Icone={CalendarX}>
            Documento vencido
          </SeloTom>
        </div>
        <p className="mt-2 text-base font-semibold text-fg-strong">Este documento venceu em {dataBr(r.documento.validade)}.</p>
        <DadosDocumento d={r.documento} />
      </section>
    );
  }
  if (r.resultado === "cancelado_ou_suspenso") {
    const cancelado = r.situacao === "cancelado";
    return (
      <section data-testid="resultado-validacao" data-resultado="cancelado_ou_suspenso" className={`${base} border-danger-line`} aria-live="polite">
        {cabecalho}
        <div className="mt-2">
          <SeloTom tom="danger" Icone={ShieldX}>
            {cancelado ? "Documento cancelado" : "Documento suspenso"}
          </SeloTom>
        </div>
        <p className="mt-2 text-base font-semibold text-fg-strong">
          {cancelado
            ? "Este documento foi cancelado pelo IMPLURB e não vale mais."
            : "Este documento está suspenso pelo IMPLURB e não vale enquanto durar a suspensão."}
        </p>
        <p className="mt-1 text-base text-fg-muted">Para saber mais, procure o IMPLURB.</p>
      </section>
    );
  }
  return (
    <section data-testid="resultado-validacao" data-resultado="nao_encontrado" className={`${base} border-danger-line`} aria-live="polite">
      {cabecalho}
      <div className="mt-2">
        <SeloTom tom="danger" Icone={SearchX}>
          Não encontrado
        </SeloTom>
      </div>
      <p className="mt-2 text-base font-semibold text-fg-strong">{TEXTO_CODIGO_NAO_ENCONTRADO}</p>
      <p className="mt-1 text-base text-fg-muted">Confira se digitou o código exatamente como está no documento.</p>
    </section>
  );
}
