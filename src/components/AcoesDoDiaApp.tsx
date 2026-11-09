"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Acao, MotivoNaoRealizada } from "@/domain/acao";
import { hojeManaus } from "@/domain/datas";
import { filtrarPorAba, ordenar, type Aba, type Ordenacao } from "@/domain/lista";
import {
  mensagemCodigoCopiado,
  mensagemCopiaManual,
  montarLinkFormulario,
} from "@/domain/formulario-sasi";
import { ErroApi, ErroRede } from "@/client/api";
import { copiarTexto } from "@/client/clipboard";
import { useAcoesDoDia } from "@/client/use-acoes-do-dia";
import { BarraFiltros, ID_PAINEL_LISTA, idAba } from "./BarraFiltros";
import { CabecalhoDia } from "./CabecalhoDia";
import { CardAcao, CardSkeleton } from "./CardAcao";
import { DetalheAcao, type MensagemFormulario, type Operacao } from "./DetalheAcao";
import { DialogoNaoRealizada } from "./DialogoNaoRealizada";
import { AvisoConexao, EstadoErro, EstadoVazio } from "./Estados";

function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroRede) return "Sem conexão. A mudança não foi registrada. Tente novamente.";
  if (e instanceof ErroApi) {
    if (e.codigo === "CONFLITO_STATUS") return "Esta ação foi atualizada em outro lugar. Confira o status atual.";
    return e.message;
  }
  return "Não foi possível registrar. Tente novamente.";
}

export function AcoesDoDiaApp() {
  const { fase, dados, offline, falhaAoAtualizar, ultimaAtualizacao, atualizando, mensagemErro, recarregar, mudarStatus } =
    useAcoesDoDia();

  const [aba, setAba] = useState<Aba>("pendentes");
  const [ordem, setOrdem] = useState<Ordenacao>("prioridade");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [emNaoRealizada, setEmNaoRealizada] = useState<string | null>(null);
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [mensagemFormulario, setMensagemFormulario] = useState<MensagemFormulario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const timerAviso = useRef<number | undefined>(undefined);

  const hoje = dados?.data ?? hojeManaus();
  const acoes = dados?.acoes ?? [];

  const visiveis = useMemo(() => ordenar(filtrarPorAba(acoes, aba), ordem, hoje), [acoes, aba, ordem, hoje]);
  const contagem = useMemo(
    () =>
      dados
        ? {
            pendentes: filtrarPorAba(acoes, "pendentes").length,
            concluidas: filtrarPorAba(acoes, "concluidas").length,
            todas: acoes.length,
          }
        : null,
    [acoes, dados],
  );

  const acaoSelecionada = selecionada ? acoes.find((a) => a.codigo === selecionada) ?? null : null;
  const acaoNaoRealizada = emNaoRealizada ? acoes.find((a) => a.codigo === emNaoRealizada) ?? null : null;

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    window.clearTimeout(timerAviso.current);
    timerAviso.current = window.setTimeout(() => setAviso(null), 5000);
  }, []);
  useEffect(() => () => window.clearTimeout(timerAviso.current), []);

  // Service worker só em produção: em desenvolvimento ele atrapalharia o recarregamento.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const abrir = (codigo: string) => {
    setErroDetalhe(null);
    setSelecionada(codigo);
  };
  const fechar = () => {
    setSelecionada(null);
    setErroDetalhe(null);
  };

  /** Abre o formulário no app; sem link definido, copia o código e orienta o fiscal. */
  const abrirFormulario = useCallback(async (acao: Acao, copia?: Promise<boolean>) => {
    const link = montarLinkFormulario(acao);
    if (link) {
      window.location.href = link;
      return;
    }
    const copiado = await (copia ?? copiarTexto(acao.codigo));
    setMensagemFormulario({
      codigo: acao.codigo,
      copiado,
      texto: copiado ? mensagemCodigoCopiado(acao) : mensagemCopiaManual(acao),
    });
  }, []);

  const estouACaminho = async (acao: Acao) => {
    setOperacao("a_caminho");
    setErroDetalhe(null);
    try {
      await mudarStatus(acao, { status: "em_deslocamento" });
      mostrarAviso("Status atualizado: a caminho.");
    } catch (e) {
      setErroDetalhe(mensagemDeErro(e));
    } finally {
      setOperacao(null);
    }
  };

  const iniciarVistoria = async (acao: Acao) => {
    setOperacao("iniciar");
    setErroDetalhe(null);
    // A cópia começa no próprio toque (exigência do navegador para a área de transferência).
    const copia = montarLinkFormulario(acao) ? undefined : copiarTexto(acao.codigo);
    try {
      const salva = await mudarStatus(acao, { status: "em_execucao" });
      await abrirFormulario(salva, copia);
    } catch (e) {
      setErroDetalhe(mensagemDeErro(e));
    } finally {
      setOperacao(null);
    }
  };

  const confirmarNaoRealizada = async (acao: Acao, motivo: MotivoNaoRealizada, motivoOutro?: string) => {
    try {
      await mudarStatus(acao, { status: "nao_realizada", motivo_nao_realizada: motivo, motivo_outro: motivoOutro });
    } catch (e) {
      throw new Error(mensagemDeErro(e));
    }
    setEmNaoRealizada(null);
    setSelecionada(null);
    mostrarAviso("Ação registrada como não realizada.");
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-app pb-24">
      <CabecalhoDia
        data={hoje}
        fiscal={dados?.fiscal ?? null}
        resumo={dados?.resumo ?? null}
        atualizando={atualizando}
        aoAtualizar={() => void recarregar()}
      />

      {fase === "pronto" && (offline || falhaAoAtualizar) ? (
        <AvisoConexao offline={offline} ultimaAtualizacao={ultimaAtualizacao} aoTentar={() => void recarregar()} tentando={atualizando} />
      ) : null}

      {fase !== "erro" ? (
        <BarraFiltros aba={aba} aoMudarAba={setAba} contagem={contagem} ordem={ordem} aoMudarOrdem={setOrdem} />
      ) : null}

      <main
        id={ID_PAINEL_LISTA}
        role={fase === "erro" ? undefined : "tabpanel"}
        aria-labelledby={fase === "erro" ? undefined : idAba(aba)}
        aria-busy={fase === "carregando"}
        className="px-4 pt-4"
      >
        {fase === "carregando" ? (
          <>
            <p className="sr-only" role="status">
              Carregando ações do dia
            </p>
            <ul className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <li key={i}>
                  <CardSkeleton />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {fase === "erro" ? (
          <EstadoErro mensagem={mensagemErro} offline={offline} aoTentar={() => void recarregar()} tentando={atualizando} />
        ) : null}

        {fase === "pronto" && visiveis.length === 0 ? <EstadoVazio aba={aba} totalDoDia={acoes.length} /> : null}

        {fase === "pronto" && visiveis.length > 0 ? (
          <ul className="space-y-3" aria-label="Ações">
            {visiveis.map((a) => (
              <li key={a.codigo}>
                <CardAcao acao={a} hoje={hoje} mostrarOrdemRota={ordem === "rota"} aoAbrir={abrir} />
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      <DetalheAcao
        acao={emNaoRealizada ? null : acaoSelecionada}
        hoje={hoje}
        offline={offline}
        operacao={operacao}
        mensagemFormulario={mensagemFormulario}
        erro={erroDetalhe}
        aoFechar={fechar}
        aoEstouACaminho={estouACaminho}
        aoIniciarVistoria={iniciarVistoria}
        aoAbrirFormulario={(a) => void abrirFormulario(a)}
        aoNaoRealizada={(a) => {
          setErroDetalhe(null);
          setEmNaoRealizada(a.codigo);
        }}
      />

      <DialogoNaoRealizada
        acao={acaoNaoRealizada}
        offline={offline}
        aoCancelar={() => setEmNaoRealizada(null)}
        aoConfirmar={confirmarNaoRealizada}
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
