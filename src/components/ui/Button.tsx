import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export type VarianteBotao = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
export type TamanhoBotao = "md" | "compacto" | "lg";

const BASE =
  "inline-flex items-center justify-center rounded-lg font-medium text-base leading-tight " +
  "text-center select-none transition-colors disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const VARIANTES: Record<VarianteBotao, string> = {
  primary:
    "bg-brand text-fg-on-brand hover:bg-brand-hover active:bg-brand-active " +
    "disabled:bg-muted disabled:text-fg-subtle",
  secondary:
    "bg-surface text-fg-strong border border-line hover:bg-subtle active:bg-muted " +
    "disabled:text-fg-subtle disabled:border-line-subtle",
  ghost: "text-brand-fg hover:bg-brand-subtle active:bg-brand-subtle disabled:text-fg-subtle",
  danger:
    "bg-danger-solid text-danger-on hover:bg-danger-solid-hover disabled:bg-muted disabled:text-fg-subtle",
  "danger-outline":
    "bg-surface text-danger border border-danger-line hover:bg-danger-subtle " +
    "disabled:text-fg-subtle disabled:border-line-subtle",
};

/* Áreas de toque: md e compacto = 44 px, lg = 52 px. Compacto: botões lado a lado em 360 px. */
const TAMANHOS: Record<TamanhoBotao, string> = {
  md: "min-h-11 gap-2 px-4 py-2",
  compacto: "min-h-11 gap-1.5 px-2 py-2",
  lg: "min-h-13 gap-2 px-5 py-3 text-lg",
};

export function classesBotao(variante: VarianteBotao = "secondary", tamanho: TamanhoBotao = "md", extra = "") {
  return `${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${extra}`.trim();
}

interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: ReactNode;
  carregando?: boolean;
  larguraTotal?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, PropsBotao>(function Button(
  { variante = "secondary", tamanho = "md", icone, carregando, larguraTotal, className = "", children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={classesBotao(variante, tamanho, `${larguraTotal ? "w-full" : ""} ${className}`)}
      {...rest}
    >
      {carregando ? <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin" strokeWidth={2} /> : icone}
      {children}
    </button>
  );
});

interface PropsLinkBotao extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: ReactNode;
  larguraTotal?: boolean;
}

export function LinkBotao({ variante = "secondary", tamanho = "md", icone, larguraTotal, className = "", children, ...rest }: PropsLinkBotao) {
  return (
    <a className={classesBotao(variante, tamanho, `${larguraTotal ? "w-full" : ""} ${className}`)} {...rest}>
      {icone}
      {children}
    </a>
  );
}

interface PropsBotaoIcone extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: botão só com ícone precisa de nome acessível. */
  "aria-label": string;
  icone: ReactNode;
}

export function IconButton({ icone, className = "", type = "button", ...rest }: PropsBotaoIcone) {
  return (
    <button
      type={type}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg-strong active:bg-muted disabled:text-fg-subtle ${className}`}
      {...rest}
    >
      {icone}
    </button>
  );
}
