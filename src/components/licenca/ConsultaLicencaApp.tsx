"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Search, SearchX, WifiOff } from "lucide-react";
import { hojeManaus, horaManaus, dataHoraManaus } from "@/domain/datas";
import {
  filtrarLicencas,
  idLicenca,
  interpretarBusca,
  LIMITE_RESULTADOS,
  paraResumo,
  ROTULO_TIPO_BUSCA,
  TAMANHO_MINIMO_BUSCA,
  type LicencaResumo,
  type RespostaBuscaLicencas,
  type TipoBusca,
} from "@/domain/licenca";
import { ErroApi } from "@/client/api";
import { copiarTexto } from "@/client/clipboard";
import { buscarLicencas, lerRecentes, obterLicenca, salvarRecente, type LicencaSalva } from "@/client/licencas";
import { Alerta } from "../ui/Alerta";
import { Button } from "../ui/Button";
import { CardLicenca } from "./CardLicenca";
import { DetalheLicenca, type EstadoDetalhe } from "./DetalheLicenca";

type EstadoBusca =
  | { fase: "inicial" }
  | { fase: "carregando"; termo: string }
  | { fase: "pronto"; termo: string; tipo: TipoBusca; resultados: LicencaResumo[]; truncado: boolean; local: boolean }
  | { fase: "erro"; termo: string; mensagem: string };

function mensagemErro(e: unknown): string {
  if (e instanceof ErroApi) return e.message;
  return "Não foi possível conectar ao Libera Fácil. Verifique sua internet e tente novamente.";
}

function quandoSalvo(ms: number): string {
  return hojeManaus(new Date(ms)) === hojeManaus() ? `às ${horaManaus(ms)}` : `em ${dataHoraManaus(ms)}`;
}

/** Mantém ?licenca= na URL (voltar/compartilhar), preservando os demais parâmetros. */
function sincronizarUrl(id: string | null) {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("licenca", id);
    else url.searchParams.delete("licenca");
    window.history.replaceState(null, "", url);
  } catch {
    /* ignora */
  }
}

export function ConsultaLicencaApp() {
  const [termo, setTermo] = useState("");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [busca, setBusca] = useState<EstadoBusca>({ fase: "inicial" });
  const [detalhe, setDetalhe] = useState<EstadoDetalhe>({ fase: "fechado" });
  const [recentes, setRecentes] = useState<LicencaSalva[]>([]);
  const [offline, setOffline] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const timerAviso = useRef<number | undefined>(undefined);
  const idCampo = useId();
  const idAjuda = useId();
  const idErro = useId();
  const hoje = hojeManaus();

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    window.clearTimeout(timerAviso.current);
    timerAviso.current = window.setTimeout(() => setAviso(null), 5000);
  }, []);

  const abrirDetalhe = useCallback(async (id: string) => {
    sincronizarUrl(id);
    const salva = lerRecentes().find((x) => idLicenca(x.licenca) === id || x.licenca.numero_processo === id);
    if (!navigator.onLine) {
      setDetalhe(
        salva
          ? { fase: "pronto", id, licenca: salva.licenca, salvoEm: salva.salvoEm }
          : { fase: "erro", id, mensagem: "Você está sem internet e esta licença não foi consultada antes neste aparelho." },
      );
      return;
    }
    setDetalhe({ fase: "carregando", id });
    try {
      const licenca = await obterLicenca(id);
      setRecentes(salvarRecente(licenca));
      setDetalhe({ fase: "pronto", id, licenca, salvoEm: null });
    } catch (e) {
      // Falhou a rede, mas há dados salvos: mostra com o aviso de horário.
      if (!(e instanceof ErroApi) && salva) {
        setDetalhe({ fase: "pronto", id, licenca: salva.licenca, salvoEm: salva.salvoEm });
        return;
      }
      setDetalhe({ fase: "erro", id, mensagem: mensagemErro(e) });
    }
  }, []);

  // Inicialização: recentes, estado da conexão e ?licenca= vindo de outra página (ex.: Ações do dia).
  useEffect(() => {
    setRecentes(lerRecentes());
    const atualizar = () => setOffline(!navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    const inicial = new URLSearchParams(window.location.search).get("licenca");
    if (inicial) void abrirDetalhe(inicial.toUpperCase());
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
      window.clearTimeout(timerAviso.current);
    };
  }, [abrirDetalhe]);

  const executarBusca = async (texto: string) => {
    const interpretada = interpretarBusca(texto);
    if (!interpretada) {
      setErroCampo(`Digite pelo menos ${TAMANHO_MINIMO_BUSCA} caracteres.`);
      return;
    }
    setErroCampo(null);
    const t = texto.trim();

    // Sem internet: procura nas licenças já consultadas neste aparelho.
    if (!navigator.onLine) {
      const locais = filtrarLicencas(
        lerRecentes().map((r) => r.licenca),
        interpretada,
      );
      setBusca({ fase: "pronto", termo: t, tipo: interpretada.tipo, resultados: locais.map(paraResumo), truncado: false, local: true });
      return;
    }

    setBusca({ fase: "carregando", termo: t });
    try {
      const r: RespostaBuscaLicencas = await buscarLicencas(t);
      // Número exato com um único resultado: abre direto o detalhe.
      if (r.tipo_busca !== "endereco" && r.resultados.length === 1) {
        const unico = r.resultados[0];
        const exato =
          unico.numero_alvara === interpretada.valor ||
          unico.numero_processo.replace(/\D/g, "") === interpretada.valor.replace(/\D/g, "");
        if (exato) void abrirDetalhe(idLicenca(unico));
      }
      setBusca({ fase: "pronto", termo: r.termo, tipo: r.tipo_busca, resultados: r.resultados, truncado: r.truncado, local: false });
    } catch (e) {
      setBusca({ fase: "erro", termo: t, mensagem: mensagemErro(e) });
    }
  };

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    void executarBusca(termo);
  };

  const limpar = () => {
    setBusca({ fase: "inicial" });
    setTermo("");
    setErroCampo(null);
  };

  const copiar = async (texto: string, rotulo: string) => {
    const ok = await copiarTexto(texto);
    mostrarAviso(ok ? `Número do ${rotulo} copiado.` : `Não foi possível copiar. Anote o número: ${texto}`);
  };

  const fecharDetalhe = () => {
    sincronizarUrl(null);
    setDetalhe({ fase: "fechado" });
  };

  const tipoAoDigitar = interpretarBusca(termo)?.tipo;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-app pb-24">
      <header className="border-b border-line-subtle bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold leading-tight text-fg-strong" style={{ fontFamily: "var(--font-display)" }}>
          Consultar licença de obra
        </h1>
        <p className="mt-1 text-base text-fg-muted">Confira se a obra tem alvará válido e o que foi aprovado.</p>

        <form role="search" onSubmit={aoEnviar} className="mt-4" noValidate>
          <label htmlFor={idCampo} className="mb-1 block text-base font-medium text-fg-strong">
            Alvará, processo ou endereço
          </label>
          <div className="flex gap-2">
            <input
              id={idCampo}
              type="search"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setErroCampo(null);
              }}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Ex.: ALV-2026-00412"
              aria-invalid={erroCampo ? true : undefined}
              aria-describedby={erroCampo ? idErro : idAjuda}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base text-fg placeholder:text-fg-subtle"
            />
            <Button
              type="submit"
              variante="primary"
              className="min-h-12"
              carregando={busca.fase === "carregando"}
              icone={<Search aria-hidden className="size-5 shrink-0" strokeWidth={2} />}
            >
              Buscar
            </Button>
          </div>
          {erroCampo ? (
            <p id={idErro} role="alert" className="mt-1 text-base font-medium text-danger">
              {erroCampo}
            </p>
          ) : (
            <p id={idAjuda} className="mt-1 text-base text-fg-muted" aria-live="polite">
              {tipoAoDigitar ? `Buscar por ${ROTULO_TIPO_BUSCA[tipoAoDigitar]}.` : "Digite o número ou parte do endereço."}
            </p>
          )}
        </form>
      </header>

      {offline ? (
        <div className="px-4 pt-4">
          <Alerta tom="warning" role="status" testId="aviso-offline-licenca" icone={<WifiOff aria-hidden className="size-5" strokeWidth={2} />}>
            Você está sem internet. A busca usa só as licenças já consultadas neste aparelho.
          </Alerta>
        </div>
      ) : null}

      <main className="px-4 pt-4" aria-busy={busca.fase === "carregando"}>
        {busca.fase === "inicial" ? <Recentes recentes={recentes} hoje={hoje} aoAbrir={abrirDetalhe} /> : null}

        {busca.fase === "carregando" ? (
          <>
            <p className="sr-only" role="status">
              Buscando licenças
            </p>
            <ul className="space-y-3">
              {[0, 1, 2].map((i) => (
                <li key={i} aria-hidden data-testid="card-licenca-skeleton" className="h-40 rounded-xl border border-line-subtle bg-surface p-4">
                  <div className="space-y-3 motion-safe:animate-pulse">
                    <div className="h-7 w-24 rounded-md bg-muted" />
                    <div className="h-6 w-2/3 rounded bg-muted" />
                    <div className="h-5 w-5/6 rounded bg-muted" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {busca.fase === "erro" ? (
          <Alerta
            tom="danger"
            role="alert"
            testId="erro-busca"
            titulo="Não foi possível buscar"
            acao={<Button onClick={() => void executarBusca(busca.termo)}>Tentar novamente</Button>}
          >
            {busca.mensagem}
          </Alerta>
        ) : null}

        {busca.fase === "pronto" ? (
          <section aria-labelledby="titulo-resultados">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="titulo-resultados" className="text-base text-fg-muted" role="status">
                {busca.resultados.length === 0
                  ? "Nenhum resultado"
                  : `${busca.resultados.length}${busca.truncado ? "+" : ""} ${
                      busca.resultados.length === 1 ? "licença encontrada" : "licenças encontradas"
                    }`}
                {busca.local ? " no aparelho" : ""}
              </h2>
              <Button
                variante="ghost"
                className="shrink-0 whitespace-nowrap"
                onClick={limpar}
                icone={<ArrowLeft aria-hidden className="size-5" strokeWidth={2} />}
              >
                Nova busca
              </Button>
            </div>

            {busca.resultados.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center" data-testid="busca-vazia">
                <SearchX aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
                <p className="mt-3 text-lg text-fg">
                  Nenhuma licença encontrada para “{busca.termo}”.
                </p>
                <p className="mt-1 text-base text-fg-muted">
                  {busca.local
                    ? "Sem internet, só aparecem licenças já consultadas neste aparelho."
                    : "Confira o número ou tente pelo endereço (ex.: nome da rua e bairro)."}
                </p>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Licenças encontradas">
                {busca.resultados.map((l) => (
                  <li key={idLicenca(l)}>
                    <CardLicenca licenca={l} hoje={hoje} aoAbrir={abrirDetalhe} />
                  </li>
                ))}
              </ul>
            )}
            {busca.truncado ? (
              <p className="mt-3 text-base text-fg-muted">
                Mostrando os {LIMITE_RESULTADOS} primeiros. Refine a busca com o número ou o bairro.
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      <DetalheLicenca
        estado={detalhe}
        hoje={hoje}
        offline={offline}
        aoFechar={fecharDetalhe}
        aoTentarDeNovo={(id) => void abrirDetalhe(id)}
        aoCopiar={(t, r) => void copiar(t, r)}
      />

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {aviso ? (
          <p data-testid="aviso" className="max-w-xl rounded-lg bg-inverse px-4 py-3 text-base text-fg-inverse shadow-[var(--shadow-lg)]">
            {aviso}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Recentes({ recentes, hoje, aoAbrir }: { recentes: LicencaSalva[]; hoje: string; aoAbrir: (id: string) => void }) {
  if (recentes.length === 0) {
    return (
      <div className="px-2 py-8 text-center" data-testid="busca-inicial">
        <Search aria-hidden className="mx-auto size-10 text-fg-subtle" strokeWidth={2} />
        <p className="mt-3 text-base text-fg-muted">Exemplos de busca:</p>
        <ul className="mt-2 space-y-1 text-base text-fg">
          <li className="font-mono">ALV-{hoje.slice(0, 4)}-00412</li>
          <li className="font-mono">{hoje.slice(0, 4)}.000.4587</li>
          <li>Rua Pará, Adrianópolis</li>
        </ul>
      </div>
    );
  }
  return (
    <section aria-labelledby="titulo-recentes">
      <h2 id="titulo-recentes" className="mb-3 text-base font-semibold text-fg-strong">
        Consultas recentes
      </h2>
      <ul className="space-y-3">
        {recentes.map((r) => (
          <li key={r.licenca.numero_processo}>
            <CardLicenca licenca={paraResumo(r.licenca)} hoje={hoje} aoAbrir={aoAbrir} nota={`Consultada ${quandoSalvo(r.salvoEm)}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
