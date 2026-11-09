"use client";

import type { ReactNode } from "react";
import { Ban, ClipboardList, Info, Map as IconeMapa, Megaphone, Navigation, Play, Route, WifiOff } from "lucide-react";
import {
  ROTULO_MOTIVO,
  ROTULO_ORIGEM,
  ROTULO_TIPO,
  type Acao,
} from "@/domain/acao";
import { dataCurta, dataHoraManaus } from "@/domain/datas";
import { linkGoogleMaps, linkWaze } from "@/domain/mapas";
import { acaoPrincipalPorStatus, podeMarcarNaoRealizada } from "@/domain/status";
import { CANAL_POR_TIPO } from "@/domain/formulario-sasi";
import { SeloPrazo, SeloPrioridade, SeloStatus } from "./Selos";
import { Button, LinkBotao } from "./ui/Button";
import { Alerta } from "./ui/Alerta";
import { Painel } from "./ui/Painel";

export type Operacao = "a_caminho" | "iniciar" | "formulario";

export interface MensagemFormulario {
  codigo: string;
  texto: string;
  copiado: boolean;
}

interface PropsDetalhe {
  acao: Acao | null;
  hoje: string;
  offline: boolean;
  operacao: Operacao | null;
  mensagemFormulario: MensagemFormulario | null;
  erro: string | null;
  aoFechar: () => void;
  aoEstouACaminho: (a: Acao) => void;
  aoIniciarVistoria: (a: Acao) => void;
  aoAbrirFormulario: (a: Acao) => void;
  aoNaoRealizada: (a: Acao) => void;
}

const ICONE_BTN = "size-5 shrink-0";

export function DetalheAcao(props: PropsDetalhe) {
  const { acao, aoFechar } = props;
  return (
    <Painel
      aberto={acao !== null}
      aoFechar={aoFechar}
      testId="detalhe-acao"
      titulo={acao ? ROTULO_TIPO[acao.tipo] : ""}
      subtitulo={acao ? <span className="font-mono">{acao.codigo}</span> : null}
      rodape={acao ? <AcoesDoDetalhe {...props} acao={acao} /> : null}
    >
      {acao ? <ConteudoDetalhe acao={acao} hoje={props.hoje} mensagem={props.mensagemFormulario} erro={props.erro} /> : null}
    </Painel>
  );
}

function ConteudoDetalhe({ acao, hoje, mensagem, erro }: { acao: Acao; hoje: string; mensagem: MensagemFormulario | null; erro: string | null }) {
  const msg = mensagem && mensagem.codigo === acao.codigo ? mensagem : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <SeloPrioridade prioridade={acao.prioridade} />
        <SeloStatus status={acao.status} />
        <SeloPrazo acao={acao} hoje={hoje} />
      </div>

      <div aria-live="polite" className="space-y-3 empty:hidden">
        {erro ? (
          <Alerta tom="danger" role="alert" testId="erro-detalhe">
            {erro}
          </Alerta>
        ) : null}
        {msg ? (
          <Alerta tom="info" titulo={msg.copiado ? "Código copiado" : "Copie o código"} testId="mensagem-formulario">
            <p>{msg.texto}</p>
            <p className="mt-2 select-all rounded-md border border-line-subtle bg-surface px-3 py-2 text-center font-mono text-xl font-semibold text-fg-strong">
              {acao.codigo}
            </p>
          </Alerta>
        ) : null}
      </div>

      {acao.orientacao_chefia ? (
        <Alerta
          tom="brand"
          titulo="Orientação da chefia"
          testId="orientacao-chefia"
          icone={<Megaphone aria-hidden className="size-5" strokeWidth={2} />}
        >
          <p className="text-lg leading-snug text-fg-strong">{acao.orientacao_chefia}</p>
        </Alerta>
      ) : null}

      {acao.status === "concluida" ? (
        <Alerta tom="success" titulo="Ação concluída">
          O Libera Fácil recebeu o formulário de vistoria desta ação.
        </Alerta>
      ) : null}
      {acao.status === "nao_realizada" ? (
        <Alerta tom="warning" titulo="Ação não realizada" icone={<Ban aria-hidden className="size-5" strokeWidth={2} />}>
          Motivo: {acao.motivo_nao_realizada ? ROTULO_MOTIVO[acao.motivo_nao_realizada] : "não informado"}
          {acao.motivo_outro ? ` (${acao.motivo_outro})` : ""}. A ação volta para a fila do dia seguinte.
        </Alerta>
      ) : null}

      <dl className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
        <Campo rotulo="Endereço">
          {acao.endereco}
          <br />
          <span className="text-fg-muted">{acao.bairro}, Manaus</span>
        </Campo>
        {acao.ponto_referencia ? <Campo rotulo="Ponto de referência">{acao.ponto_referencia}</Campo> : null}
        <Campo rotulo="Prazo">{dataCurta(acao.prazo)}</Campo>
        <Campo rotulo="Origem">{ROTULO_ORIGEM[acao.origem]}</Campo>
        {acao.nome_proprietario ? <Campo rotulo="Proprietário">{acao.nome_proprietario}</Campo> : null}
        {acao.numero_processo ? <Campo rotulo="Processo" mono>{acao.numero_processo}</Campo> : null}
        {acao.numero_alvara ? <Campo rotulo="Alvará" mono>{acao.numero_alvara}</Campo> : null}
        <Campo rotulo="Formulário no app">{CANAL_POR_TIPO[acao.tipo].nome}</Campo>
        <Campo rotulo="Ordem na rota">{acao.ordem_rota}ª parada</Campo>
        <Campo rotulo="Atualizado em">{dataHoraManaus(acao.atualizado_em)}</Campo>
      </dl>
    </div>
  );
}

function Campo({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="px-3 py-2.5">
      <dt className="text-base text-fg-muted">{rotulo}</dt>
      <dd className={`text-base text-fg-strong break-words ${mono ? "font-mono" : ""}`}>{children}</dd>
    </div>
  );
}

function AcoesDoDetalhe({
  acao,
  offline,
  operacao,
  aoEstouACaminho,
  aoIniciarVistoria,
  aoAbrirFormulario,
  aoNaoRealizada,
}: PropsDetalhe & { acao: Acao }) {
  const principal = acaoPrincipalPorStatus(acao.status);
  const ocupado = operacao !== null;

  return (
    <div className="space-y-2">
      {offline && principal && principal !== "abrir_formulario" ? (
        <p className="flex items-center gap-2 text-base text-fg-muted" role="status">
          <WifiOff aria-hidden className={ICONE_BTN} strokeWidth={2} />
          Sem internet. Conecte-se para mudar o status.
        </p>
      ) : null}

      {principal === "estou_a_caminho" ? (
        <Button
          variante="primary"
          tamanho="lg"
          larguraTotal
          disabled={offline || ocupado}
          carregando={operacao === "a_caminho"}
          icone={<Navigation aria-hidden className={ICONE_BTN} strokeWidth={2} />}
          onClick={() => aoEstouACaminho(acao)}
        >
          Estou a caminho
        </Button>
      ) : null}
      {principal === "iniciar_vistoria" ? (
        <Button
          variante="primary"
          tamanho="lg"
          larguraTotal
          disabled={offline || ocupado}
          carregando={operacao === "iniciar"}
          icone={<Play aria-hidden className={ICONE_BTN} strokeWidth={2} />}
          onClick={() => aoIniciarVistoria(acao)}
        >
          Iniciar vistoria
        </Button>
      ) : null}
      {principal === "abrir_formulario" ? (
        <Button
          variante="primary"
          tamanho="lg"
          larguraTotal
          disabled={ocupado}
          icone={<ClipboardList aria-hidden className={ICONE_BTN} strokeWidth={2} />}
          onClick={() => aoAbrirFormulario(acao)}
        >
          Abrir formulário
        </Button>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <LinkBotao
          tamanho="compacto"
          href={linkGoogleMaps(acao)}
          target="_blank"
          rel="noopener noreferrer"
          icone={<IconeMapa aria-hidden className={ICONE_BTN} strokeWidth={2} />}
        >
          Abrir no mapa
        </LinkBotao>
        <LinkBotao
          tamanho="compacto"
          href={linkWaze(acao)}
          target="_blank"
          rel="noopener noreferrer"
          icone={<Route aria-hidden className={ICONE_BTN} strokeWidth={2} />}
        >
          Abrir no Waze
        </LinkBotao>
      </div>

      {podeMarcarNaoRealizada(acao.status) ? (
        <Button
          variante="danger-outline"
          larguraTotal
          disabled={offline || ocupado}
          icone={<Ban aria-hidden className={ICONE_BTN} strokeWidth={2} />}
          onClick={() => aoNaoRealizada(acao)}
        >
          Não consegui realizar
        </Button>
      ) : null}

      {principal === "abrir_formulario" ? (
        <p className="flex items-center gap-2 pt-1 text-base text-fg-muted">
          <Info aria-hidden className={ICONE_BTN} strokeWidth={2} />
          Ao enviar o formulário, a ação é concluída automaticamente.
        </p>
      ) : null}
    </div>
  );
}
