"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Circle,
  CircleCheck,
  CircleDot,
  Clock,
  Download,
  FileText,
  MessageSquareWarning,
  Receipt,
  RefreshCw,
  Send,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { hojeManaus } from "@/domain/datas";
import {
  dataBr,
  dataHoraBr,
  formatarCodigoValidacao,
  montarLinhaDoTempo,
  moeda,
  ROTULO_PAPEL,
  ROTULO_SITUACAO_GUIA,
  ROTULO_TIPO,
  textoDias,
  textoMeuPapel,
  textoPrazo,
  type EtapaLinhaDoTempo,
  type Guia,
  type Processo,
} from "@/domain/processo";
import { ErroApi } from "@/client/api";
import { comParametros, linkPdf, obterProcesso } from "@/client/processos";
import { Button, LinkBotao, classesBotao } from "../ui/Button";
import {
  AvisoCobranca,
  AvisoFlutuante,
  BlocoSkeleton,
  BotaoCanal,
  IndicadorComQuem,
  SeloStatusProcesso,
  SeloTom,
  useAviso,
} from "./Comum";
import { mensagemErroConexao } from "./MeusProcessosApp";

export const TEXTO_QUEM_TEM_ACESSO =
  "Só estas pessoas podem acompanhar este processo. Se você não reconhece alguém, use o canal Denunciar Cobrança Indevida.";

type Estado =
  | { fase: "carregando" }
  | { fase: "pronto"; processo: Processo }
  | { fase: "nao_encontrado"; mensagem: string }
  | { fase: "erro"; mensagem: string };

const ICONE = "size-5 shrink-0";

export function DetalheProcessoApp({ protocolo }: { protocolo: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [linkVoltar, setLinkVoltar] = useState("/cidadao/meus-processos");
  const { aviso, mostrar } = useAviso();

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", processo: await obterProcesso(protocolo) });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 404) setEstado({ fase: "nao_encontrado", mensagem: e.message });
      else setEstado({ fase: "erro", mensagem: mensagemErroConexao(e, "o processo").mensagem });
    }
  }, [protocolo]);

  useEffect(() => {
    setLinkVoltar(comParametros("/cidadao/meus-processos"));
    void carregar();
  }, [carregar]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-app pb-10">
      <nav className="border-b border-line-subtle bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))]" aria-label="Navegação">
        <Link href={linkVoltar} className={classesBotao("ghost", "md")}>
          <ArrowLeft aria-hidden className={ICONE} strokeWidth={2} />
          Meus processos
        </Link>
      </nav>

      {estado.fase === "carregando" ? <DetalheSkeleton /> : null}

      {estado.fase === "erro" || estado.fase === "nao_encontrado" ? (
        <main className="flex flex-col items-center px-6 py-12 text-center" role="alert" data-testid="estado-erro">
          <AlertCircle aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
          <p className="mt-3 text-lg font-semibold text-fg-strong">
            {estado.fase === "nao_encontrado" ? "Processo não encontrado" : "Não foi possível carregar"}
          </p>
          <p className="mt-1 text-base text-fg-muted">{estado.mensagem}</p>
          {estado.fase === "erro" ? (
            <Button variante="primary" tamanho="lg" className="mt-5" onClick={() => void carregar()} icone={<RefreshCw aria-hidden className={ICONE} strokeWidth={2} />}>
              Tentar novamente
            </Button>
          ) : (
            <LinkBotao href={linkVoltar} variante="primary" tamanho="lg" className="mt-5">
              Ver meus processos
            </LinkBotao>
          )}
        </main>
      ) : null}

      {estado.fase === "pronto" ? <Detalhe processo={estado.processo} aoAvisar={mostrar} /> : null}

      <AvisoFlutuante texto={aviso} />
    </div>
  );
}

function Detalhe({ processo: p, aoAvisar }: { processo: Processo; aoAvisar: (t: string) => void }) {
  const hoje = hojeManaus();
  const pendenciasAbertas = p.pendencias.filter((x) => x.situacao === "aberta");
  const pendenciasAnteriores = p.pendencias.filter((x) => x.situacao !== "aberta");
  // Um único botão principal por tela: a ação que o momento do processo pede.
  const principal =
    p.status === "pendente_documentacao" ? "pendencia" : p.status === "aguardando_pagamento" ? "guias" : p.status === "documento_emitido" ? "documento" : null;
  const passouDoPrazo = p.com_quem_esta === "orgao" && p.prazo_etapa_dias > 0 && p.dias_na_etapa > p.prazo_etapa_dias;

  return (
    <main data-testid="detalhe-processo">
      {/* 1. Cabeçalho */}
      <header className="border-b border-line-subtle bg-surface px-4 pb-4 pt-3">
        <SeloStatusProcesso status={p.status} tipo={p.tipo} />
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-fg-strong" style={{ fontFamily: "var(--font-display)" }}>
          {ROTULO_TIPO[p.tipo]}
        </h1>
        <p className="mt-1 text-base text-fg-muted">
          Protocolo <span className="whitespace-nowrap font-mono text-fg">{p.protocolo}</span>
        </p>
        <p className="text-base text-fg">
          {p.endereco_obra} · {p.bairro_obra}
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
          <dt className="text-fg-muted">Setor atual</dt>
          <dd className="text-fg" data-testid="setor-atual">
            {p.setor_atual}
          </dd>
          {p.com_quem_esta === "orgao" && p.prazo_etapa_dias > 0 ? (
            <>
              <dt className="text-fg-muted">Prazo da etapa</dt>
              <dd className="text-fg">até {textoDias(p.prazo_etapa_dias)}</dd>
            </>
          ) : null}
          <dt className="text-fg-muted">Aberto em</dt>
          <dd className="text-fg">{dataBr(p.aberto_em)}</dd>
        </dl>
        <div className="mt-3">
          <IndicadorComQuem processo={{ ...p, prazo_acao_cidadao: primeiroPrazo(p) }} />
        </div>
        {passouDoPrazo ? (
          <p className="mt-2 flex items-start gap-2 text-base text-fg" data-testid="prazo-excedido">
            <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={2} />
            Esta etapa passou do prazo previsto. Você não precisa fazer nada nem pagar nada por isso.
          </p>
        ) : null}
        <p className="mt-3 flex items-center gap-1 text-base text-fg-muted">
          <UserRound aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          {textoMeuPapel(p.meu_papel)}
        </p>
      </header>

      <div className="space-y-4 px-4 pt-4">
        {/* 2. Linha do tempo */}
        <Secao titulo="Andamento" id="andamento">
          <LinhaDoTempo etapas={montarLinhaDoTempo(p)} />
        </Secao>

        {/* 3. Pendências */}
        <Secao titulo="Pendências" id="pendencias" testId="secao-pendencias">
          {pendenciasAbertas.length === 0 ? (
            <p className="text-base text-fg-muted" data-testid="sem-pendencias">
              Nenhuma pendência aberta. Se alguém disser que há uma pendência para liberar este processo, confira aqui antes de pagar qualquer coisa.
            </p>
          ) : (
            <ul className="space-y-3">
              {pendenciasAbertas.map((x) => (
                <li key={x.id} data-testid="pendencia-aberta" className="rounded-lg border border-warning-line bg-warning-subtle p-3">
                  <SeloTom tom="warning" Icone={MessageSquareWarning}>
                    Pendência aberta
                  </SeloTom>
                  <p className="mt-2 text-base text-fg">{x.texto}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-base">
                    <dt className="text-fg-muted">Emitida em</dt>
                    <dd className="text-fg">{dataBr(x.emitida_em)}</dd>
                    <dt className="text-fg-muted">Responda até</dt>
                    <dd className="font-semibold text-fg-strong">
                      {dataBr(x.prazo_resposta)} ({textoPrazo(x.prazo_resposta, hoje)})
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {pendenciasAbertas.length > 0 ? (
            <div className="mt-3">
              <BotaoCanal
                canal="responder_pendencia"
                protocolo={p.protocolo}
                variante={principal === "pendencia" ? "primary" : "secondary"}
                icone={<Send aria-hidden className={ICONE} strokeWidth={2} />}
                aoAvisar={aoAvisar}
              >
                Responder pendência
              </BotaoCanal>
            </div>
          ) : null}
          {pendenciasAnteriores.length > 0 ? (
            <details className="mt-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-medium text-brand-fg">
                Pendências já resolvidas ({pendenciasAnteriores.length})
              </summary>
              <ul className="mt-1 space-y-2">
                {pendenciasAnteriores.map((x) => (
                  <li key={x.id} className="rounded-lg border border-line-subtle p-3 text-base">
                    <p className="text-fg">{x.texto}</p>
                    <p className="mt-1 text-fg-muted">
                      Emitida em {dataBr(x.emitida_em)} · {x.situacao === "atendida" ? "Atendida" : "Respondida, em análise"}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Secao>

        {/* 4. Taxas */}
        <Secao titulo="Taxas" id="taxas" testId="secao-taxas">
          {p.guias.length === 0 ? (
            <p className="text-base text-fg-muted">Nenhuma guia emitida para este processo.</p>
          ) : (
            <>
              <ul className="divide-y divide-line-subtle">
                {p.guias.map((g, i) => (
                  <LinhaGuia key={i} guia={g} />
                ))}
              </ul>
              <div className="mt-3">
                <BotaoCanal
                  canal="emitir_guia"
                  protocolo={p.protocolo}
                  variante={principal === "guias" ? "primary" : "secondary"}
                  icone={<Receipt aria-hidden className={ICONE} strokeWidth={2} />}
                  aoAvisar={aoAvisar}
                >
                  Ver guias
                </BotaoCanal>
              </div>
            </>
          )}
        </Secao>

        {/* 5. Documentos emitidos */}
        <Secao titulo="Documentos emitidos" id="documentos" testId="secao-documentos">
          {p.documentos_emitidos.length === 0 ? (
            <p className="text-base text-fg-muted">O documento aparece aqui quando for emitido.</p>
          ) : (
            <ul className="space-y-3">
              {p.documentos_emitidos.map((d) => (
                <li key={d.numero} data-testid="documento-emitido">
                  <p className="flex items-center gap-2 text-base font-semibold text-fg-strong">
                    <FileText aria-hidden className={`${ICONE} text-fg-muted`} strokeWidth={2} />
                    {d.tipo}
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-base">
                    <dt className="text-fg-muted">Número</dt>
                    <dd className="font-mono text-fg">{d.numero}</dd>
                    <dt className="text-fg-muted">Emitido em</dt>
                    <dd className="text-fg">{dataBr(d.emitido_em)}</dd>
                    <dt className="text-fg-muted">Validade</dt>
                    <dd className="text-fg">{d.validade ? `até ${dataBr(d.validade)}` : "sem prazo de validade"}</dd>
                    <dt className="text-fg-muted">Código</dt>
                    <dd className="break-all font-mono text-fg">{formatarCodigoValidacao(d.codigo_validacao)}</dd>
                  </dl>
                  <LinkBotao
                    href={linkPdf(d.url_pdf)}
                    download={`${d.numero}.pdf`}
                    variante={principal === "documento" ? "primary" : "secondary"}
                    larguraTotal
                    className="mt-3"
                    icone={<Download aria-hidden className={ICONE} strokeWidth={2} />}
                  >
                    Baixar PDF
                  </LinkBotao>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* 6. Quem tem acesso */}
        <Secao titulo="Quem tem acesso a este processo" id="acesso" testId="secao-acesso">
          <ul className="divide-y divide-line-subtle">
            {p.participantes.map((x, i) => (
              <li key={i} className="py-2" data-testid="participante">
                <p className="flex items-start gap-2 text-base text-fg-strong">
                  <Users aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" strokeWidth={2} />
                  <span>
                    <span className="font-semibold">{x.nome}</span>
                    {x.voce ? <span className="text-fg-muted"> (você)</span> : null}
                    <span className="block text-fg-muted">
                      {ROTULO_PAPEL[x.papel]} · <span className="whitespace-nowrap font-mono">{x.documento_mascarado}</span>
                    </span>
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-base text-fg" data-testid="aberto-por">
            Pedido feito por <strong className="font-semibold">{p.aberto_por.nome}</strong> ({ROTULO_PAPEL[p.aberto_por.papel].toLowerCase()}).
          </p>
          <p className="mt-2 text-base text-fg-muted">{TEXTO_QUEM_TEM_ACESSO}</p>
          <div className="mt-3">
            <BotaoCanal
              canal="denunciar_cobranca"
              protocolo={p.protocolo}
              variante="secondary"
              icone={<ShieldAlert aria-hidden className={ICONE} strokeWidth={2} />}
              aoAvisar={aoAvisar}
            >
              Denunciar cobrança indevida
            </BotaoCanal>
          </div>
        </Secao>

        {/* 7. Aviso fixo */}
        <AvisoCobranca />
      </div>
    </main>
  );
}

function primeiroPrazo(p: Processo): string | null {
  if (p.status === "pendente_documentacao") {
    return p.pendencias.filter((x) => x.situacao === "aberta").map((x) => x.prazo_resposta).sort()[0] ?? null;
  }
  if (p.status === "aguardando_pagamento") {
    return p.guias.filter((g) => g.situacao !== "paga").map((g) => g.vencimento).sort()[0] ?? null;
  }
  return null;
}

function Secao({ titulo, id, testId, children }: { titulo: string; id: string; testId?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`titulo-${id}`} data-testid={testId} className="rounded-xl border border-line-subtle bg-surface p-4">
      <h2 id={`titulo-${id}`} className="mb-3 text-lg font-semibold text-fg-strong">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const SITUACAO_GUIA = {
  em_aberto: { tom: "warning", Icone: Clock },
  paga: { tom: "success", Icone: CircleCheck },
  vencida: { tom: "danger", Icone: AlertCircle },
} as const;

function LinhaGuia({ guia: g }: { guia: Guia }) {
  const s = SITUACAO_GUIA[g.situacao];
  return (
    <li className="py-2" data-testid="guia">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-base font-medium text-fg-strong">{g.descricao}</p>
        <SeloTom tom={s.tom} Icone={s.Icone}>
          {ROTULO_SITUACAO_GUIA[g.situacao]}
        </SeloTom>
      </div>
      <p className="text-base text-fg">
        <span className="font-semibold tabular-nums">{moeda(g.valor)}</span>
        <span className="text-fg-muted"> · vencimento {dataBr(g.vencimento)}</span>
      </p>
    </li>
  );
}

const MARCADOR: Record<EtapaLinhaDoTempo["situacao"], { Icone: typeof Circle; classe: string; rotulo: string }> = {
  concluida: { Icone: CircleCheck, classe: "text-brand-fg", rotulo: "Concluída" },
  atual: { Icone: CircleDot, classe: "text-info", rotulo: "Etapa atual" },
  futura: { Icone: Circle, classe: "text-fg-subtle", rotulo: "Próxima etapa" },
};

export function LinhaDoTempo({ etapas }: { etapas: EtapaLinhaDoTempo[] }) {
  return (
    <ol className="relative" data-testid="linha-do-tempo">
      {etapas.map((e, i) => {
        const m = MARCADOR[e.situacao];
        const ultima = i === etapas.length - 1;
        return (
          <li key={i} data-testid="etapa" data-situacao={e.situacao} className="relative flex gap-3 pb-4 last:pb-0">
            {!ultima ? <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-0.5 bg-line" /> : null}
            <m.Icone aria-hidden className={`relative mt-0.5 size-6 shrink-0 bg-surface ${m.classe}`} strokeWidth={2} />
            <div className="min-w-0">
              <p className={`text-base ${e.situacao === "futura" ? "text-fg-muted" : "font-semibold text-fg-strong"}`}>
                <span className="sr-only">{m.rotulo}: </span>
                {e.rotulo}
                {e.situacao === "atual" ? (
                  <span className="ml-2 inline-block rounded-md border border-info-line bg-info-subtle px-1.5 text-sm font-semibold text-info" aria-hidden>
                    Agora
                  </span>
                ) : null}
              </p>
              {e.data_hora ? <p className="text-base text-fg-muted">{dataHoraBr(e.data_hora)}</p> : null}
              {e.situacao === "futura" ? <p className="text-base text-fg-subtle">Prevista</p> : null}
              {e.descricao ? <p className="text-base text-fg">{e.descricao}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DetalheSkeleton() {
  return (
    <div aria-busy="true" data-testid="detalhe-skeleton">
      <p className="sr-only" role="status">
        Carregando o processo
      </p>
      <div aria-hidden className="space-y-3 border-b border-line-subtle bg-surface px-4 pb-4 pt-3 motion-safe:animate-pulse">
        <BlocoSkeleton className="h-7 w-40 rounded-md" />
        <BlocoSkeleton className="h-8 w-3/4" />
        <BlocoSkeleton className="h-5 w-1/2" />
        <BlocoSkeleton className="h-5 w-2/3" />
        <BlocoSkeleton className="h-10 w-full rounded-lg" />
      </div>
      <div aria-hidden className="space-y-4 px-4 pt-4 motion-safe:animate-pulse">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line-subtle bg-surface p-4">
            <BlocoSkeleton className="h-6 w-32" />
            <BlocoSkeleton className="h-5 w-full" />
            <BlocoSkeleton className="h-5 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
