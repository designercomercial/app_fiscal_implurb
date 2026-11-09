"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FolderOpen, RefreshCw, UserRound, WifiOff } from "lucide-react";
import {
  dataHoraBr,
  filtrarPorAba,
  ordenarProcessos,
  ROTULO_TIPO,
  textoMeuPapel,
  type AbaProcessos,
  type ProcessoResumo,
  type RespostaMeusProcessos,
} from "@/domain/processo";
import { ErroApi } from "@/client/api";
import { buscarMeusProcessos, comParametros } from "@/client/processos";
import { Abas } from "../ui/Abas";
import { Button } from "../ui/Button";
import { CardSkeleton, IndicadorComQuem, SeloStatusProcesso } from "./Comum";

export const TEXTO_SEM_PROCESSOS = "Você ainda não tem processos. Para abrir um pedido, use o botão Licenciamento.";

const ABAS: { id: AbaProcessos; rotulo: string }[] = [
  { id: "andamento", rotulo: "Em andamento" },
  { id: "concluidos", rotulo: "Concluídos" },
  { id: "todos", rotulo: "Todos" },
];
const ID_PAINEL = "painel-processos";

type Estado =
  | { fase: "carregando" }
  | { fase: "pronto"; dados: RespostaMeusProcessos }
  | { fase: "erro"; mensagem: string; offline: boolean };

export function mensagemErroConexao(e: unknown, oQue: string): { mensagem: string; offline: boolean } {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (e instanceof ErroApi) return { mensagem: e.message, offline: false };
  return {
    mensagem: offline
      ? "Você está sem internet. Conecte-se e tente novamente."
      : `Não foi possível carregar ${oQue}. Verifique sua conexão e tente novamente.`,
    offline,
  };
}

export function MeusProcessosApp() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aba, setAba] = useState<AbaProcessos>("andamento");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", dados: await buscarMeusProcessos() });
    } catch (e) {
      setEstado({ fase: "erro", ...mensagemErroConexao(e, "seus processos") });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const processos = estado.fase === "pronto" ? estado.dados.processos : [];
  const contagem = useMemo(
    () => ({
      andamento: filtrarPorAba(processos, "andamento").length,
      concluidos: filtrarPorAba(processos, "concluidos").length,
      todos: processos.length,
    }),
    [processos],
  );
  const visiveis = useMemo(() => ordenarProcessos(filtrarPorAba(processos, aba)), [processos, aba]);
  const primeiroNome = estado.fase === "pronto" ? estado.dados.cidadao.nome.split(" ")[0] : null;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-app pb-10">
      <header className="border-b border-line-subtle bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold leading-tight text-fg-strong" style={{ fontFamily: "var(--font-display)" }}>
          Meus processos
        </h1>
        <p className="mt-1 text-base text-fg-muted">
          {primeiroNome ? `Olá, ${primeiroNome}. ` : ""}Aqui você vê o mesmo andamento que os servidores do IMPLURB veem.
        </p>
      </header>

      {estado.fase === "pronto" && processos.length > 0 ? (
        <div className="px-4 pt-4">
          <Abas abas={ABAS} ativa={aba} aoMudar={setAba} contagem={contagem} rotulo="Filtrar processos" idPainel={ID_PAINEL} />
        </div>
      ) : null}

      <main className="px-4 pt-4" aria-busy={estado.fase === "carregando"}>
        {estado.fase === "carregando" ? (
          <>
            <p className="sr-only" role="status">
              Carregando seus processos
            </p>
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <CardSkeleton key={i} testId="card-processo-skeleton" />
              ))}
            </div>
          </>
        ) : null}

        {estado.fase === "erro" ? (
          <div className="flex flex-col items-center px-6 py-12 text-center" role="alert" data-testid="estado-erro">
            {estado.offline ? (
              <WifiOff aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
            ) : (
              <RefreshCw aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
            )}
            <p className="mt-3 text-lg font-semibold text-fg-strong">Não foi possível carregar</p>
            <p className="mt-1 text-base text-fg-muted">{estado.mensagem}</p>
            <Button variante="primary" tamanho="lg" className="mt-5" onClick={() => void carregar()} icone={<RefreshCw aria-hidden className="size-5" strokeWidth={2} />}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {estado.fase === "pronto" && processos.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center" data-testid="estado-vazio">
            <FolderOpen aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
            <p className="mt-3 text-lg text-fg">{TEXTO_SEM_PROCESSOS}</p>
          </div>
        ) : null}

        {estado.fase === "pronto" && processos.length > 0 ? (
          <div id={ID_PAINEL} role="tabpanel" aria-labelledby={`aba-${aba}`}>
            {visiveis.length === 0 ? (
              <p className="px-6 py-12 text-center text-base text-fg-muted" data-testid="estado-vazio-filtro">
                {aba === "concluidos" ? "Nenhum processo concluído ainda." : "Nenhum processo em andamento."}
              </p>
            ) : (
              <ul className="space-y-3">
                {visiveis.map((p) => (
                  <li key={p.protocolo}>
                    <CardProcesso processo={p} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function CardProcesso({ processo: p }: { processo: ProcessoResumo }) {
  return (
    <Link
      href={comParametros(`/cidadao/meus-processos/${p.protocolo}`)}
      data-testid="card-processo"
      data-protocolo={p.protocolo}
      className="block rounded-xl border border-line-subtle bg-surface p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-line active:bg-subtle"
    >
      <div className="flex items-start justify-between gap-2">
        <SeloStatusProcesso status={p.status} tipo={p.tipo} />
        <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-subtle" strokeWidth={2} />
      </div>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-fg-strong">{ROTULO_TIPO[p.tipo]}</h2>
      <p className="text-base text-fg-muted">
        Protocolo <span className="whitespace-nowrap font-mono text-fg">{p.protocolo}</span>
      </p>
      <p className="mt-1 text-base text-fg">
        {p.endereco_obra} · {p.bairro_obra}
      </p>
      <div className="mt-3">
        <IndicadorComQuem processo={p} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-subtle pt-3 text-base text-fg-muted">
        <span className="inline-flex items-center gap-1" data-testid="meu-papel">
          <UserRound aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          {textoMeuPapel(p.meu_papel)}
        </span>
        <span>Atualizado em {dataHoraBr(p.atualizado_em)}</span>
      </div>
    </Link>
  );
}
