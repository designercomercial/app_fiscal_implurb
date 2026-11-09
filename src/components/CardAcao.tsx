import { ChevronRight, MapPin } from "lucide-react";
import { ROTULO_TIPO, type Acao } from "@/domain/acao";
import { SeloPrazo, SeloPrioridade, SeloStatus } from "./Selos";

interface PropsCard {
  acao: Acao;
  hoje: string;
  mostrarOrdemRota?: boolean;
  aoAbrir: (codigo: string) => void;
}

export function CardAcao({ acao, hoje, mostrarOrdemRota, aoAbrir }: PropsCard) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(acao.codigo)}
      aria-haspopup="dialog"
      data-testid="card-acao"
      data-codigo={acao.codigo}
      className="group flex w-full items-stretch gap-2 rounded-xl border border-line-subtle bg-surface p-4 text-left transition-colors hover:border-line active:bg-subtle"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {mostrarOrdemRota ? (
            <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-md bg-inverse px-1.5 text-sm font-semibold text-fg-inverse">
              <span className="sr-only">Parada </span>
              {acao.ordem_rota}
            </span>
          ) : null}
          <SeloPrioridade prioridade={acao.prioridade} />
          <SeloStatus status={acao.status} />
        </div>

        <div>
          <p className="text-lg font-semibold leading-snug text-fg-strong">{ROTULO_TIPO[acao.tipo]}</p>
          <p className="font-mono text-base text-fg-muted">{acao.codigo}</p>
        </div>

        <p className="flex items-start gap-1.5 text-base text-fg">
          <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" strokeWidth={2} />
          <span className="min-w-0 break-words">
            {acao.endereco}
            <span className="text-fg-muted"> · {acao.bairro}</span>
          </span>
        </p>

        <SeloPrazo acao={acao} hoje={hoje} />
      </div>
      <ChevronRight aria-hidden className="size-6 shrink-0 self-center text-fg-subtle" strokeWidth={2} />
    </button>
  );
}

export function CardSkeleton() {
  return (
    <div aria-hidden data-testid="card-skeleton" className="rounded-xl border border-line-subtle bg-surface p-4">
      <div className="space-y-3 motion-safe:animate-pulse">
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded-md bg-muted" />
          <div className="h-7 w-24 rounded-md bg-muted" />
        </div>
        <div className="h-6 w-3/4 rounded bg-muted" />
        <div className="h-5 w-1/2 rounded bg-muted" />
        <div className="h-5 w-5/6 rounded bg-muted" />
        <div className="h-5 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}
