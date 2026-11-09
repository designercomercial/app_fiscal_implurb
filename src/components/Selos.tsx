import type { ReactNode } from "react";
import {
  AlertCircle,
  Ban,
  CalendarDays,
  ChevronDown,
  ChevronsUp,
  Circle,
  CircleCheck,
  ClipboardList,
  Clock,
  Equal,
  Navigation,
} from "lucide-react";
import {
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  type Acao,
  type Prioridade,
  type StatusAcao,
} from "@/domain/acao";
import { dataCurta } from "@/domain/datas";
import { situacaoPrazoDaAcao } from "@/domain/prazo";

/* Selos sempre com ícone + texto: nunca dependem só de cor. */

const ICONE = "size-4 shrink-0";

function Selo({ classes, icone, children, testId }: { classes: string; icone: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-semibold leading-tight ${classes}`}
    >
      {icone}
      <span>{children}</span>
    </span>
  );
}

const PRIORIDADE: Record<Prioridade, { classes: string; Icone: typeof Circle }> = {
  alta: { classes: "bg-danger-subtle text-danger border-danger-line", Icone: ChevronsUp },
  media: { classes: "bg-warning-subtle text-warning border-warning-line", Icone: Equal },
  baixa: { classes: "bg-info-subtle text-info border-info-line", Icone: ChevronDown },
};

export function SeloPrioridade({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADE[prioridade];
  return (
    <Selo testId="selo-prioridade" classes={p.classes} icone={<p.Icone aria-hidden className={ICONE} strokeWidth={2} />}>
      <span className="sr-only">Prioridade </span>
      {ROTULO_PRIORIDADE[prioridade]}
    </Selo>
  );
}

const STATUS: Record<StatusAcao, { classes: string; Icone: typeof Circle }> = {
  pendente: { classes: "bg-subtle text-fg-muted border-line-subtle", Icone: Circle },
  em_deslocamento: { classes: "bg-info-subtle text-info border-info-line", Icone: Navigation },
  em_execucao: { classes: "bg-brand-subtle text-brand-fg border-brand", Icone: ClipboardList },
  concluida: { classes: "bg-success-subtle text-success border-success-line", Icone: CircleCheck },
  nao_realizada: { classes: "bg-subtle text-fg-muted border-line", Icone: Ban },
};

export function SeloStatus({ status }: { status: StatusAcao }) {
  const s = STATUS[status];
  return (
    <Selo testId="selo-status" classes={s.classes} icone={<s.Icone aria-hidden className={ICONE} strokeWidth={2} />}>
      <span className="sr-only">Status: </span>
      {ROTULO_STATUS[status]}
    </Selo>
  );
}

export function SeloPrazo({ acao, hoje }: { acao: Pick<Acao, "prazo" | "status">; hoje: string }) {
  const situacao = situacaoPrazoDaAcao(acao, hoje);
  if (situacao === "atrasada") {
    return (
      <Selo
        testId="selo-prazo"
        classes="bg-danger-subtle text-danger border-danger-line"
        icone={<AlertCircle aria-hidden className={ICONE} strokeWidth={2} />}
      >
        Atrasada · prazo {dataCurta(acao.prazo)}
      </Selo>
    );
  }
  if (situacao === "vence_hoje") {
    return (
      <Selo
        testId="selo-prazo"
        classes="bg-warning-subtle text-warning border-warning-line"
        icone={<Clock aria-hidden className={ICONE} strokeWidth={2} />}
      >
        Vence hoje
      </Selo>
    );
  }
  return (
    <span data-testid="selo-prazo" className="inline-flex items-center gap-1 text-base text-fg-muted">
      <CalendarDays aria-hidden className={ICONE} strokeWidth={2} />
      Prazo {dataCurta(acao.prazo)}
    </span>
  );
}
