import { AlertCircle, Ban, CircleCheck, CirclePause, Clock, Hourglass } from "lucide-react";
import { ROTULO_SITUACAO, type SituacaoLicenca } from "@/domain/licenca";
import type { TomAlerta } from "../ui/Alerta";
import { Selo } from "../Selos";

/** Situação da licença: sempre ícone + texto. */
export const ESTILO_SITUACAO: Record<SituacaoLicenca, { classes: string; tom: TomAlerta; Icone: typeof Clock }> = {
  valida: { classes: "bg-success-subtle text-success border-success-line", tom: "success", Icone: CircleCheck },
  vence_em_breve: { classes: "bg-warning-subtle text-warning border-warning-line", tom: "warning", Icone: Clock },
  vencida: { classes: "bg-danger-subtle text-danger border-danger-line", tom: "danger", Icone: AlertCircle },
  suspensa: { classes: "bg-danger-subtle text-danger border-danger-line", tom: "danger", Icone: CirclePause },
  cancelada: { classes: "bg-danger-subtle text-danger border-danger-line", tom: "danger", Icone: Ban },
  em_analise: { classes: "bg-info-subtle text-info border-info-line", tom: "info", Icone: Hourglass },
};

export function SeloSituacao({ situacao }: { situacao: SituacaoLicenca }) {
  const e = ESTILO_SITUACAO[situacao];
  return (
    <Selo testId="selo-situacao" classes={e.classes} icone={<e.Icone aria-hidden className="size-4 shrink-0" strokeWidth={2} />}>
      <span className="sr-only">Situação: </span>
      {ROTULO_SITUACAO[situacao]}
    </Selo>
  );
}
