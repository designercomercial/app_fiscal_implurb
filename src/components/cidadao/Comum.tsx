"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  Building2,
  CalendarCheck,
  CircleCheck,
  CircleX,
  FileCheck,
  FileSearch,
  Inbox,
  Landmark,
  ListFilter,
  Receipt,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import {
  dataBr,
  rotuloStatus,
  tomStatus,
  textoIndicador,
  type ProcessoResumo,
  type StatusProcesso,
  type TipoProcesso,
  type TomStatus,
} from "@/domain/processo";
import {
  montarLinkCanal,
  mensagemCopiaManualCanal,
  mensagemProtocoloCopiado,
  type CanalCidadao,
} from "@/domain/canais-cidadao";
import { copiarTexto } from "@/client/clipboard";
import { Selo } from "../Selos";
import { Alerta } from "../ui/Alerta";
import { Button, LinkBotao, type VarianteBotao } from "../ui/Button";

/* ------------------------------------------------------------- Selos */

export const CLASSES_TOM: Record<TomStatus, string> = {
  info: "bg-info-subtle text-info border-info-line",
  warning: "bg-warning-subtle text-warning border-warning-line",
  success: "bg-success-subtle text-success border-success-line",
  danger: "bg-danger-subtle text-danger border-danger-line",
  neutro: "bg-subtle text-fg-muted border-line",
};

const ICONE_STATUS: Record<StatusProcesso, LucideIcon> = {
  recebido: Inbox,
  em_triagem: ListFilter,
  em_analise_tecnica: FileSearch,
  pendente_documentacao: AlertTriangle,
  em_aprovacao: Stamp,
  aguardando_pagamento: Receipt,
  vistoria_agendada: CalendarCheck,
  deferido: CircleCheck,
  indeferido: CircleX,
  documento_emitido: FileCheck,
  arquivado: Archive,
};

export function iconeStatus(status: StatusProcesso): LucideIcon {
  return ICONE_STATUS[status];
}

/** Selo de status: sempre ícone + texto (nunca só cor). */
export function SeloStatusProcesso({ status, tipo }: { status: StatusProcesso; tipo: TipoProcesso }) {
  const Icone = ICONE_STATUS[status];
  return (
    <Selo testId="selo-status-processo" classes={CLASSES_TOM[tomStatus(status)]} icone={<Icone aria-hidden className="size-4 shrink-0" strokeWidth={2} />}>
      <span className="sr-only">Situação: </span>
      {rotuloStatus(status, tipo)}
    </Selo>
  );
}

export function SeloTom({ tom, Icone, children, testId }: { tom: TomStatus; Icone: LucideIcon; children: ReactNode; testId?: string }) {
  return (
    <Selo testId={testId} classes={CLASSES_TOM[tom]} icone={<Icone aria-hidden className="size-4 shrink-0" strokeWidth={2} />}>
      {children}
    </Selo>
  );
}

/* ------------------------------------------------- Com quem está */

export function textoAcaoCidadao(p: Pick<ProcessoResumo, "status" | "prazo_acao_cidadao">): string | null {
  if (!p.prazo_acao_cidadao) return null;
  if (p.status === "pendente_documentacao") return `Responda à pendência até ${dataBr(p.prazo_acao_cidadao)}.`;
  if (p.status === "aguardando_pagamento") return `Pague a guia até ${dataBr(p.prazo_acao_cidadao)}.`;
  return null;
}

/** "Aguardando você" em destaque ou "Com o IMPLURB há X dias". */
export function IndicadorComQuem({
  processo,
}: {
  processo: Pick<ProcessoResumo, "com_quem_esta" | "dias_na_etapa" | "status" | "prazo_acao_cidadao">;
}) {
  const texto = textoIndicador(processo);
  if (!texto) return null;
  if (processo.com_quem_esta === "requerente") {
    const acao = textoAcaoCidadao(processo);
    return (
      <div data-testid="indicador-com-quem" data-com-quem="requerente" className="flex gap-2 rounded-lg border border-warning-line bg-warning-subtle px-3 py-2">
        <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={2} />
        <div className="min-w-0">
          <p className="font-semibold text-warning">{texto}</p>
          {acao ? <p className="text-base text-fg">{acao}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <p data-testid="indicador-com-quem" data-com-quem="orgao" className="flex items-center gap-2 text-base text-fg">
      <Building2 aria-hidden className="size-5 shrink-0 text-fg-muted" strokeWidth={2} />
      {texto}
    </p>
  );
}

/* --------------------------------------------------- Aviso fixo */

export const TEXTO_AVISO_COBRANCA =
  "O IMPLURB só cobra taxas por guia oficial, que aparece neste app. Nenhuma pendência é cobrada fora daqui.";

export function AvisoCobranca() {
  return (
    <Alerta tom="info" role="note" testId="aviso-cobranca" icone={<Landmark aria-hidden className="size-5" strokeWidth={2} />}>
      {TEXTO_AVISO_COBRANCA}
    </Alerta>
  );
}

/* ---------------------------------------------- Aviso flutuante */

export function useAviso() {
  const [aviso, setAviso] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mostrar = useCallback((texto: string) => {
    setAviso(texto);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAviso(null), 6000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { aviso, mostrar };
}

export function AvisoFlutuante({ texto }: { texto: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {texto ? (
        <p data-testid="aviso" className="max-w-xl rounded-lg bg-inverse px-4 py-3 text-base text-fg-inverse shadow-[var(--shadow-lg)]">
          {texto}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------- Botão que abre um canal */

/**
 * Abre o canal do App do Cidadão com o protocolo. Enquanto o formato do link não estiver
 * definido com a SASI, copia o protocolo e explica onde colar.
 */
export function BotaoCanal({
  canal,
  protocolo,
  variante,
  icone,
  children,
  aoAvisar,
}: {
  canal: CanalCidadao;
  protocolo: string;
  variante: VarianteBotao;
  icone: ReactNode;
  children: ReactNode;
  aoAvisar: (texto: string) => void;
}) {
  const link = montarLinkCanal(canal, protocolo);
  if (link) {
    return (
      <LinkBotao href={link} variante={variante} icone={icone} larguraTotal>
        {children}
      </LinkBotao>
    );
  }
  return (
    <Button
      variante={variante}
      icone={icone}
      larguraTotal
      onClick={async () => {
        const ok = await copiarTexto(protocolo);
        aoAvisar(ok ? mensagemProtocoloCopiado(canal) : mensagemCopiaManualCanal(canal, protocolo));
      }}
    >
      {children}
    </Button>
  );
}

/* ------------------------------------------------------ Skeleton */

export function BlocoSkeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-muted ${className}`} />;
}

export function CardSkeleton({ testId = "skeleton" }: { testId?: string }) {
  return (
    <div aria-hidden data-testid={testId} className="rounded-xl border border-line-subtle bg-surface p-4">
      <div className="space-y-3 motion-safe:animate-pulse">
        <BlocoSkeleton className="h-7 w-36 rounded-md" />
        <BlocoSkeleton className="h-6 w-2/3" />
        <BlocoSkeleton className="h-5 w-5/6" />
        <BlocoSkeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
