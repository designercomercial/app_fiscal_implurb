"use client";

import { useEffect, useRef, useState } from "react";
import { codigoDoQr } from "@/domain/processo";
import { Painel } from "../ui/Painel";

/* BarcodeDetector ainda não está nos tipos do TypeScript. */
interface Detector {
  detect(fonte: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type ConstrutorDetector = new (opcoes: { formats: string[] }) => Detector;

function construtorDetector(): ConstrutorDetector | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector ?? null) as ConstrutorDetector | null;
}

/**
 * Leitura pela câmera é possível neste aparelho/webview?
 * Usa o leitor nativo do navegador (BarcodeDetector). Sem ele, a página mostra só o campo.
 * [CONFIRMAR COM A SASI] se o webview do App do Cidadão libera a câmera (getUserMedia).
 */
export function leituraQrDisponivel(): boolean {
  return !!construtorDetector() && !!navigator.mediaDevices?.getUserMedia;
}

export function LeitorQr({ aberto, aoFechar, aoLer }: { aberto: boolean; aoFechar: () => void; aoLer: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    let fluxo: MediaStream | null = null;
    let timer: number | undefined;
    let ativo = true;

    (async () => {
      const Construtor = construtorDetector();
      if (!Construtor) return;
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        if (ativo) setErro("Não foi possível abrir a câmera. Digite o código impresso no documento.");
        return;
      }
      if (!ativo || !video.current) return;
      video.current.srcObject = fluxo;
      await video.current.play().catch(() => undefined);
      const detector = new Construtor({ formats: ["qr_code"] });
      const ler = async () => {
        if (!ativo || !video.current) return;
        try {
          const achados = await detector.detect(video.current);
          for (const a of achados) {
            const codigo = codigoDoQr(a.rawValue);
            if (codigo) {
              aoLer(codigo);
              return;
            }
          }
          if (achados.length > 0) setErro("Este QR Code não é de um documento do IMPLURB.");
        } catch {
          /* quadro ainda não pronto */
        }
        timer = window.setTimeout(ler, 300);
      };
      void ler();
    })();

    return () => {
      ativo = false;
      window.clearTimeout(timer);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, [aberto, aoLer]);

  return (
    <Painel aberto={aberto} aoFechar={aoFechar} titulo="Ler QR Code" subtitulo="Aponte a câmera para o QR Code impresso no documento." testId="leitor-qr">
      <div className="p-4">
        <video ref={video} muted playsInline className="aspect-square w-full rounded-xl bg-inverse object-cover" aria-label="Imagem da câmera" />
        {erro ? (
          <p role="alert" className="mt-3 text-base font-medium text-danger">
            {erro}
          </p>
        ) : null}
      </div>
    </Painel>
  );
}
