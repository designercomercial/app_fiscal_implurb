"use client";

import type { ReactNode } from "react";
import { Copy, HardHat, Map as IconeMapa, RefreshCw, ScrollText, User, WifiOff } from "lucide-react";
import { dataHoraManaus, hojeManaus, horaManaus } from "@/domain/datas";
import {
  dataBr,
  ROTULO_SITUACAO,
  ROTULO_TIPO_OBRA,
  ROTULO_USO,
  situacaoLicenca,
  textoValidade,
  type Licenca,
} from "@/domain/licenca";
import { linkGoogleMaps } from "@/domain/mapas";
import { Alerta } from "../ui/Alerta";
import { Button, LinkBotao } from "../ui/Button";
import { Painel } from "../ui/Painel";
import { ESTILO_SITUACAO, SeloSituacao } from "./SeloSituacao";

export type EstadoDetalhe =
  | { fase: "fechado" }
  | { fase: "carregando"; id: string }
  | { fase: "erro"; id: string; mensagem: string }
  | { fase: "pronto"; id: string; licenca: Licenca; /** dados salvos no aparelho (sem internet) */ salvoEm: number | null };

interface PropsDetalhe {
  estado: EstadoDetalhe;
  hoje: string;
  offline: boolean;
  aoFechar: () => void;
  aoTentarDeNovo: (id: string) => void;
  aoCopiar: (texto: string, rotulo: string) => void;
}

const fmtArea = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DetalheLicenca({ estado, hoje, offline, aoFechar, aoTentarDeNovo, aoCopiar }: PropsDetalhe) {
  if (estado.fase === "fechado") return null;
  const licenca = estado.fase === "pronto" ? estado.licenca : null;

  const titulo = licenca
    ? `${ROTULO_TIPO_OBRA[licenca.tipo_obra]} ${ROTULO_USO[licenca.uso].toLowerCase()}`
    : "Licença de obra";
  const subtitulo = (
    <span className="whitespace-nowrap font-mono">
      {licenca ? (licenca.numero_alvara ?? `Processo ${licenca.numero_processo}`) : estado.id}
    </span>
  );

  return (
    <Painel
      aberto
      aoFechar={aoFechar}
      testId="detalhe-licenca"
      titulo={titulo}
      subtitulo={subtitulo}
      rodape={licenca ? <Rodape licenca={licenca} aoCopiar={aoCopiar} /> : null}
    >
      {estado.fase === "carregando" ? <EsqueletoDetalhe /> : null}
      {estado.fase === "erro" ? (
        <Alerta
          tom="danger"
          role="alert"
          testId="erro-licenca"
          icone={offline ? <WifiOff aria-hidden className="size-5" strokeWidth={2} /> : undefined}
          acao={
            <Button onClick={() => aoTentarDeNovo(estado.id)} icone={<RefreshCw aria-hidden className="size-5" strokeWidth={2} />}>
              Tentar novamente
            </Button>
          }
        >
          {estado.mensagem}
        </Alerta>
      ) : null}
      {estado.fase === "pronto" ? <Conteudo licenca={estado.licenca} hoje={hoje} salvoEm={estado.salvoEm} /> : null}
    </Painel>
  );
}

function Conteudo({ licenca: l, hoje, salvoEm }: { licenca: Licenca; hoje: string; salvoEm: number | null }) {
  const situacao = situacaoLicenca(l, hoje);
  const estilo = ESTILO_SITUACAO[situacao];
  const quando = salvoEm
    ? hojeManaus(new Date(salvoEm)) === hojeManaus()
      ? horaManaus(salvoEm)
      : dataHoraManaus(salvoEm)
    : null;

  return (
    <div className="space-y-4">
      {quando ? (
        <Alerta tom="warning" role="status" testId="aviso-dados-salvos" icone={<WifiOff aria-hidden className="size-5" strokeWidth={2} />}>
          Você está sem internet. Exibindo dados de {quando}.
        </Alerta>
      ) : null}

      <Alerta
        tom={estilo.tom}
        testId="situacao-licenca"
        icone={<estilo.Icone aria-hidden className="size-6" strokeWidth={2} />}
        titulo={<span className="text-lg">Licença {ROTULO_SITUACAO[situacao].toLowerCase()}</span>}
      >
        <p className="text-base">{textoValidade(l, hoje)}</p>
      </Alerta>

      <Secao titulo="Licença" icone={<ScrollText aria-hidden className="size-5" strokeWidth={2} />}>
        <Campo rotulo="Alvará" mono>{l.numero_alvara ?? "Ainda não emitido"}</Campo>
        <Campo rotulo="Processo" mono>{l.numero_processo}</Campo>
        <Campo rotulo="Situação"><SeloSituacao situacao={situacao} /></Campo>
        <Campo rotulo="Tipo de obra">{ROTULO_TIPO_OBRA[l.tipo_obra]}</Campo>
        <Campo rotulo="Uso">{ROTULO_USO[l.uso]}</Campo>
        {l.data_emissao ? <Campo rotulo="Emissão">{dataBr(l.data_emissao)}</Campo> : null}
        {l.validade ? <Campo rotulo="Validade">{dataBr(l.validade)}</Campo> : null}
        <Campo rotulo="Endereço">
          {l.endereco}
          <br />
          <span className="text-fg-muted">{l.bairro}, Manaus</span>
        </Campo>
      </Secao>

      <Secao titulo={l.numero_alvara ? "O que foi aprovado" : "O que foi pedido"}>
        <Campo rotulo="Área">{fmtArea.format(l.area_aprovada_m2)} m²</Campo>
        <Campo rotulo="Pavimentos">{l.pavimentos}</Campo>
        {l.condicionantes.length > 0 ? (
          <Campo rotulo="Condicionantes">
            <ul className="list-disc space-y-1 pl-5">
              {l.condicionantes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Campo>
        ) : null}
      </Secao>

      <Secao titulo="Responsáveis" icone={<User aria-hidden className="size-5" strokeWidth={2} />}>
        <Campo rotulo="Proprietário">
          {l.proprietario.nome}
          <br />
          <span className="font-mono text-fg-muted">{l.proprietario.documento_mascarado}</span>
        </Campo>
        <Campo rotulo="Responsável técnico">
          {l.responsavel_tecnico ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <HardHat aria-hidden className="size-4 text-fg-muted" strokeWidth={2} />
                {l.responsavel_tecnico.nome}
              </span>
              <br />
              <span className="text-fg-muted">
                {l.responsavel_tecnico.conselho} {l.responsavel_tecnico.registro} · {l.responsavel_tecnico.art_rrt}
              </span>
            </>
          ) : (
            <span className="text-fg-muted">Não informado</span>
          )}
        </Campo>
      </Secao>

      {l.historico.length > 0 ? (
        <section aria-labelledby="titulo-historico">
          <h3 id="titulo-historico" className="mb-2 text-base font-semibold text-fg-strong">
            Histórico
          </h3>
          <ol className="space-y-3 border-l-2 border-line-subtle pl-4" data-testid="historico-licenca">
            {[...l.historico].reverse().map((h, i) => (
              <li key={`${h.data}-${i}`}>
                <p className="text-base text-fg-muted">{dataBr(h.data)}</p>
                <p className="text-base font-medium text-fg-strong">{h.evento}</p>
                {h.descricao ? <p className="text-base text-fg">{h.descricao}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="text-base text-fg-subtle">Atualizado no Libera Fácil em {dataHoraManaus(l.atualizado_em)}.</p>
    </div>
  );
}

function Rodape({ licenca, aoCopiar }: { licenca: Licenca; aoCopiar: (texto: string, rotulo: string) => void }) {
  const numero = licenca.numero_alvara ?? licenca.numero_processo;
  const rotulo = licenca.numero_alvara ? "Copiar número do alvará" : "Copiar número do processo";
  return (
    <div className="space-y-2">
      <Button
        variante="primary"
        tamanho="lg"
        larguraTotal
        icone={<Copy aria-hidden className="size-5 shrink-0" strokeWidth={2} />}
        onClick={() => aoCopiar(numero, licenca.numero_alvara ? "alvará" : "processo")}
      >
        {rotulo}
      </Button>
      <LinkBotao
        larguraTotal
        href={linkGoogleMaps(licenca)}
        target="_blank"
        rel="noopener noreferrer"
        icone={<IconeMapa aria-hidden className="size-5 shrink-0" strokeWidth={2} />}
      >
        Abrir no mapa
      </LinkBotao>
    </div>
  );
}

function Secao({ titulo, icone, children }: { titulo: string; icone?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-base font-semibold text-fg-strong">
        {icone ? <span className="text-fg-muted">{icone}</span> : null}
        {titulo}
      </h3>
      <dl className="divide-y divide-line-subtle rounded-xl border border-line-subtle">{children}</dl>
    </section>
  );
}

function Campo({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="px-3 py-2.5">
      <dt className="text-base text-fg-muted">{rotulo}</dt>
      <dd className={`break-words text-base text-fg-strong ${mono ? "font-mono" : ""}`}>{children}</dd>
    </div>
  );
}

function EsqueletoDetalhe() {
  return (
    <div aria-hidden className="space-y-4 motion-safe:animate-pulse" data-testid="detalhe-licenca-carregando">
      <div className="h-20 rounded-xl bg-muted" />
      <div className="h-48 rounded-xl bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
    </div>
  );
}
