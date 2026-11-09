import { ChevronRight, MapPin } from "lucide-react";
import {
  idLicenca,
  ROTULO_TIPO_OBRA,
  ROTULO_USO,
  situacaoLicenca,
  textoValidade,
  type LicencaResumo,
} from "@/domain/licenca";
import { SeloSituacao } from "./SeloSituacao";

interface PropsCard {
  licenca: LicencaResumo;
  hoje: string;
  aoAbrir: (id: string) => void;
  /** Ex.: "Consultada às 10:32" (consultas recentes). */
  nota?: string;
}

export function CardLicenca({ licenca, hoje, aoAbrir, nota }: PropsCard) {
  const id = idLicenca(licenca);
  const situacao = situacaoLicenca(licenca, hoje);
  return (
    <button
      type="button"
      onClick={() => aoAbrir(id)}
      aria-haspopup="dialog"
      data-testid="card-licenca"
      data-id={id}
      className="flex w-full items-stretch gap-2 rounded-xl border border-line-subtle bg-surface p-4 text-left transition-colors hover:border-line active:bg-subtle"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <SeloSituacao situacao={situacao} />
        <div>
          <p className="whitespace-nowrap font-mono text-lg font-semibold text-fg-strong">
            {licenca.numero_alvara ?? "Sem alvará"}
          </p>
          <p className="text-base text-fg-muted">
            {ROTULO_TIPO_OBRA[licenca.tipo_obra]} · {ROTULO_USO[licenca.uso].toLowerCase()} ·{" "}
            <span className="whitespace-nowrap">Processo {licenca.numero_processo}</span>
          </p>
        </div>
        <p className="flex items-start gap-1.5 text-base text-fg">
          <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" strokeWidth={2} />
          <span className="min-w-0 break-words">
            {licenca.endereco}
            <span className="text-fg-muted"> · {licenca.bairro}</span>
          </span>
        </p>
        {situacao === "suspensa" || situacao === "cancelada" ? null : (
          <p className="text-base text-fg-muted">{textoValidade({ ...licenca, motivo_status: null, historico: [] }, hoje)}</p>
        )}
        {nota ? <p className="text-base text-fg-subtle">{nota}</p> : null}
      </div>
      <ChevronRight aria-hidden className="size-6 shrink-0 self-center text-fg-subtle" strokeWidth={2} />
    </button>
  );
}
