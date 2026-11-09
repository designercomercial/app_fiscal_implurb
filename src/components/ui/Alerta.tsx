import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CircleCheck, Info } from "lucide-react";

export type TomAlerta = "info" | "success" | "warning" | "danger" | "brand";

const TOM: Record<TomAlerta, { caixa: string; icone: string; Icone: typeof Info }> = {
  info: { caixa: "bg-info-subtle border-info-line", icone: "text-info", Icone: Info },
  success: { caixa: "bg-success-subtle border-success-line", icone: "text-success", Icone: CircleCheck },
  warning: { caixa: "bg-warning-subtle border-warning-line", icone: "text-warning", Icone: AlertTriangle },
  danger: { caixa: "bg-danger-subtle border-danger-line", icone: "text-danger", Icone: AlertCircle },
  brand: { caixa: "bg-brand-subtle border-brand", icone: "text-brand-fg", Icone: Info },
};

interface PropsAlerta {
  tom?: TomAlerta;
  titulo?: ReactNode;
  children?: ReactNode;
  icone?: ReactNode;
  acao?: ReactNode;
  role?: "status" | "alert" | "note";
  className?: string;
  testId?: string;
}

export function Alerta({ tom = "info", titulo, children, icone, acao, role, className = "", testId }: PropsAlerta) {
  const t = TOM[tom];
  return (
    <div role={role} data-testid={testId} className={`flex gap-3 rounded-xl border p-3 ${t.caixa} ${className}`}>
      <span className={`mt-0.5 shrink-0 ${t.icone}`}>
        {icone ?? <t.Icone aria-hidden className="size-5" strokeWidth={2} />}
      </span>
      <div className="min-w-0 flex-1 text-base text-fg">
        {titulo ? <p className="font-semibold text-fg-strong">{titulo}</p> : null}
        {children ? <div className={titulo ? "mt-0.5" : ""}>{children}</div> : null}
        {acao ? <div className="mt-2">{acao}</div> : null}
      </div>
    </div>
  );
}
