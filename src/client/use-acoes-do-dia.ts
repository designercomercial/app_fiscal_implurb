"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calcularResumo, type Acao, type CorpoAlterarStatus, type RespostaAcoesDoDia } from "@/domain/acao";
import { buscarAcoesDoDia, enviarStatus, ErroApi, ErroRede } from "./api";
import { lerListaEmCache, salvarListaEmCache } from "./cache-offline";

export const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000;

export type Fase = "carregando" | "pronto" | "erro";

export interface EstadoAcoesDoDia {
  fase: Fase;
  dados: RespostaAcoesDoDia | null;
  /** Sem internet (navigator.onLine = false ou última tentativa falhou por rede). */
  offline: boolean;
  /** A última atualização falhou, mas há uma lista anterior sendo exibida. */
  falhaAoAtualizar: boolean;
  /** ms desde epoch da última lista recebida do servidor. */
  ultimaAtualizacao: number | null;
  atualizando: boolean;
  mensagemErro: string | null;
}

function chaveFiscal(): string {
  if (typeof window === "undefined") return "padrao";
  return new URLSearchParams(window.location.search).get("fiscal") ?? "padrao";
}

function comResumo(dados: RespostaAcoesDoDia, acoes: Acao[]): RespostaAcoesDoDia {
  return { ...dados, acoes, resumo: calcularResumo(acoes) };
}

export function useAcoesDoDia() {
  const [estado, setEstado] = useState<EstadoAcoesDoDia>({
    fase: "carregando",
    dados: null,
    offline: false,
    falhaAoAtualizar: false,
    ultimaAtualizacao: null,
    atualizando: false,
    mensagemErro: null,
  });
  const ref = useRef(estado);
  ref.current = estado;
  const emVoo = useRef(false);

  const carregar = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    setEstado((s) => ({ ...s, atualizando: true }));
    try {
      const dados = await buscarAcoesDoDia();
      const agora = Date.now();
      salvarListaEmCache({ resposta: dados, salvoEm: agora, chaveFiscal: chaveFiscal() });
      setEstado({
        fase: "pronto",
        dados,
        offline: false,
        falhaAoAtualizar: false,
        ultimaAtualizacao: agora,
        atualizando: false,
        mensagemErro: null,
      });
    } catch (e) {
      // "Sem internet" só quando o aparelho está offline; servidor fora do ar é erro de conexão.
      const semRede = typeof navigator !== "undefined" && !navigator.onLine;
      const mensagem =
        e instanceof ErroApi
          ? e.message
          : e instanceof ErroRede
            ? "Não foi possível conectar ao Libera Fácil. Verifique sua internet e tente novamente."
            : "Erro inesperado. Tente novamente.";
      setEstado((s) => {
        // Já há lista na tela? Mantém e avisa.
        if (s.dados) {
          return { ...s, offline: semRede, falhaAoAtualizar: true, atualizando: false, mensagemErro: mensagem };
        }
        // Sem lista na tela: tenta a última lista guardada no aparelho.
        const cache = lerListaEmCache(chaveFiscal());
        if (cache) {
          return {
            fase: "pronto",
            dados: cache.resposta,
            offline: semRede,
            falhaAoAtualizar: true,
            ultimaAtualizacao: cache.salvoEm,
            atualizando: false,
            mensagemErro: mensagem,
          };
        }
        return { ...s, fase: "erro", offline: semRede, atualizando: false, mensagemErro: mensagem };
      });
    } finally {
      emVoo.current = false;
    }
  }, []);

  // Carga inicial, atualização automática (página visível) e reação a online/offline.
  useEffect(() => {
    void carregar();

    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, INTERVALO_ATUALIZACAO_MS);

    const aoMudarVisibilidade = () => {
      const ultima = ref.current.ultimaAtualizacao;
      if (
        document.visibilityState === "visible" &&
        (ultima === null || Date.now() - ultima >= INTERVALO_ATUALIZACAO_MS)
      ) {
        void carregar();
      }
    };
    const aoFicarOnline = () => {
      setEstado((s) => ({ ...s, offline: false }));
      void carregar();
    };
    const aoFicarOffline = () => setEstado((s) => ({ ...s, offline: true }));

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);
    if (!navigator.onLine) aoFicarOffline();

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
    };
  }, [carregar]);

  const substituirAcao = useCallback((nova: Acao) => {
    setEstado((s) => {
      if (!s.dados) return s;
      const acoes = s.dados.acoes.map((a) => (a.codigo === nova.codigo ? nova : a));
      const dados = comResumo(s.dados, acoes);
      if (s.ultimaAtualizacao) {
        salvarListaEmCache({ resposta: dados, salvoEm: s.ultimaAtualizacao, chaveFiscal: chaveFiscal() });
      }
      return { ...s, dados };
    });
  }, []);

  /**
   * Muda o status com atualização otimista. Em caso de erro, volta ao estado anterior
   * (ou ao estado atual informado pelo servidor) e repassa o erro para a tela.
   */
  const mudarStatus = useCallback(
    async (acao: Acao, corpo: Omit<CorpoAlterarStatus, "status_anterior">): Promise<Acao> => {
      const otimista: Acao = {
        ...acao,
        status: corpo.status,
        motivo_nao_realizada: corpo.motivo_nao_realizada ?? null,
        motivo_outro: corpo.motivo_outro ?? null,
      };
      substituirAcao(otimista);
      try {
        const salva = await enviarStatus(acao.codigo, { ...corpo, status_anterior: acao.status });
        substituirAcao(salva);
        return salva;
      } catch (e) {
        substituirAcao(e instanceof ErroApi && e.acaoAtual ? e.acaoAtual : acao);
        throw e;
      }
    },
    [substituirAcao],
  );

  return { ...estado, recarregar: carregar, mudarStatus };
}
