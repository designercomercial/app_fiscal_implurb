import { RefreshCw } from "lucide-react";
import type { FiscalResumo, ResumoDia } from "@/domain/acao";
import { dataPorExtenso } from "@/domain/datas";
import { IconButton } from "./ui/Button";

interface PropsCabecalho {
  data: string;
  fiscal: FiscalResumo | null;
  resumo: ResumoDia | null;
  atualizando: boolean;
  aoAtualizar: () => void;
}

export function CabecalhoDia({ data, fiscal, resumo, atualizando, aoAtualizar }: PropsCabecalho) {
  const pct = resumo && resumo.total > 0 ? Math.round((resumo.concluidas / resumo.total) * 100) : 0;
  return (
    <header className="border-b border-line-subtle bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight text-fg-strong" style={{ fontFamily: "var(--font-display)" }}>
            {dataPorExtenso(data)}
          </h1>
          <p className="mt-1 text-base text-fg-muted">
            {fiscal ? (
              <>
                <span className="font-medium text-fg">{fiscal.nome}</span> · {fiscal.zona}
              </>
            ) : (
              <span className="inline-block h-5 w-48 rounded bg-muted align-middle" aria-hidden />
            )}
          </p>
        </div>
        <IconButton
          aria-label={atualizando ? "Atualizando lista" : "Atualizar lista"}
          onClick={aoAtualizar}
          disabled={atualizando}
          className="border border-line-subtle"
          icone={<RefreshCw aria-hidden className={`size-6 ${atualizando ? "motion-safe:animate-spin" : ""}`} strokeWidth={2} />}
        />
      </div>

      {resumo ? (
        <div className="mt-4" data-testid="resumo-dia">
          <dl className="grid grid-cols-3 gap-2">
            <Indicador rotulo="Ações" valor={resumo.total} />
            <Indicador rotulo="Concluídas" valor={resumo.concluidas} />
            <Indicador rotulo="Pendentes" valor={resumo.pendentes} />
          </dl>
          <div className="mt-3">
            <div className="mb-1 flex justify-between gap-2 text-base text-fg-muted">
              <span id="rotulo-progresso">
                {resumo.concluidas} de {resumo.total} concluídas
              </span>
              {resumo.nao_realizadas > 0 ? (
                <span>
                  {resumo.nao_realizadas} não {resumo.nao_realizadas === 1 ? "realizada" : "realizadas"}
                </span>
              ) : null}
            </div>
            <div
              role="progressbar"
              aria-labelledby="rotulo-progresso"
              aria-valuemin={0}
              aria-valuemax={resumo.total}
              aria-valuenow={resumo.concluidas}
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-subtle px-3 py-2">
      <dt className="text-base text-fg-muted">{rotulo}</dt>
      <dd className="text-2xl font-semibold tabular-nums text-fg-strong">{valor}</dd>
    </div>
  );
}
