import { CircleCheck, Inbox, RefreshCw, WifiOff } from "lucide-react";
import { dataHoraManaus, hojeManaus, horaManaus } from "@/domain/datas";
import type { Aba } from "@/domain/lista";
import { Button } from "./ui/Button";
import { Alerta } from "./ui/Alerta";

export const TEXTO_LISTA_VAZIA =
  "Nenhuma ação para hoje. Novas ações aparecem aqui quando forem distribuídas.";

export function EstadoVazio({ aba, totalDoDia }: { aba: Aba; totalDoDia: number }) {
  // O dia tem ações, mas o filtro atual está vazio.
  if (totalDoDia > 0) {
    const texto =
      aba === "pendentes"
        ? "Nenhuma ação pendente. Todas as ações do dia foram tratadas."
        : "Nenhuma ação concluída ainda hoje.";
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center" data-testid="estado-vazio-filtro">
        <CircleCheck aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
        <p className="mt-3 text-base text-fg-muted">{texto}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" data-testid="estado-vazio">
      <Inbox aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
      <p className="mt-3 text-lg text-fg">{TEXTO_LISTA_VAZIA}</p>
    </div>
  );
}

export function EstadoErro({ mensagem, offline, aoTentar, tentando }: { mensagem: string | null; offline: boolean; aoTentar: () => void; tentando: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" role="alert" data-testid="estado-erro">
      {offline ? (
        <WifiOff aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
      ) : (
        <RefreshCw aria-hidden className="size-10 text-fg-subtle" strokeWidth={2} />
      )}
      <p className="mt-3 text-lg font-semibold text-fg-strong">
        {offline ? "Você está sem internet" : "Não foi possível carregar as ações"}
      </p>
      <p className="mt-1 text-base text-fg-muted">
        {offline ? "Conecte-se e tente novamente. Ainda não há uma lista salva neste aparelho." : mensagem}
      </p>
      <Button variante="primary" tamanho="lg" className="mt-5" onClick={aoTentar} carregando={tentando} icone={<RefreshCw aria-hidden className="size-5" strokeWidth={2} />}>
        Tentar novamente
      </Button>
    </div>
  );
}

/** Aviso exibido quando a lista na tela não é a mais recente. */
export function AvisoConexao({
  offline,
  ultimaAtualizacao,
  aoTentar,
  tentando,
}: {
  offline: boolean;
  ultimaAtualizacao: number | null;
  aoTentar: () => void;
  tentando: boolean;
}) {
  // Lista de hoje: só a hora. Lista de outro dia: data e hora, para não enganar.
  const hora = ultimaAtualizacao
    ? hojeManaus(new Date(ultimaAtualizacao)) === hojeManaus()
      ? horaManaus(ultimaAtualizacao)
      : dataHoraManaus(ultimaAtualizacao)
    : "horário desconhecido";
  return (
    <div className="px-4 pt-4">
      <Alerta
        tom="warning"
        role="status"
        testId="aviso-conexao"
        icone={offline ? <WifiOff aria-hidden className="size-5" strokeWidth={2} /> : undefined}
        acao={
          <Button variante="secondary" onClick={aoTentar} carregando={tentando} icone={<RefreshCw aria-hidden className="size-5" strokeWidth={2} />}>
            Tentar novamente
          </Button>
        }
      >
        {offline
          ? `Você está sem internet. Exibindo dados de ${hora}.`
          : `Não foi possível atualizar. Exibindo dados de ${hora}.`}
      </Alerta>
    </div>
  );
}
